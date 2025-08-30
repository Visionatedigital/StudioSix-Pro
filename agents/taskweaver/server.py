import os
import asyncio
import json
from collections import deque, defaultdict
from typing import Dict, Deque, Any

from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
import httpx

# NOTE: This is a minimal TaskWeaver-like shim. Replace with real taskweaver session when available.

load_dotenv()

TW_SHARED_TOKEN = os.getenv("TW_SHARED_TOKEN", "replace-me")
NODE_URL = os.getenv("NODE_URL", "http://127.0.0.1:8080")

app = FastAPI(title="TaskWeaver Sidecar")

# In-memory event queues per run
RUN_QUEUES: Dict[str, Deque[Dict[str, Any]]] = defaultdict(lambda: deque(maxlen=500))

async def enqueue(run_id: str, event: Dict[str, Any]):
    RUN_QUEUES[run_id].append(event)

async def auth_or_403(token: str):
    if token != TW_SHARED_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden: bad token")

@app.post("/tw/run")
async def tw_run(request: Request, x_tw_token: str = Header(None)):
    await auth_or_403(x_tw_token)
    body = await request.json()
    run_id = body.get("runId")
    goal = body.get("goal")
    context = body.get("context", {})
    model = body.get("model")
    max_steps = body.get("maxSteps", 12)

    if not run_id or not goal:
        raise HTTPException(status_code=400, detail="runId and goal required")

    # Seed plan event (mock planner)
    await enqueue(run_id, {"type":"plan", "summary":f"Plan for: {goal}", "steps":["document.commitCheckpoint"]})

    # Start background task to simulate planning/execution cueing the client
    async def background_loop():
        try:
            step = {"tool":"document.commitCheckpoint", "args":{}}
            # Signal client to execute
            await enqueue(run_id, {"type":"act", "status":"start", "tool": step["tool"], "args": step["args"]})
            # Wait briefly for client to respond via /tw/tool-result, but don't block indefinitely
            await asyncio.sleep(0.5)
            await enqueue(run_id, {"type":"done", "status":"success"})
        except Exception as e:
            await enqueue(run_id, {"type":"error", "code":"E_RUNTIME", "title":"Runtime error", "hint": str(e)})

    asyncio.create_task(background_loop())
    return JSONResponse({"runId": run_id})

@app.get("/tw/events/{run_id}")
async def tw_events(run_id: str, request: Request, x_tw_token: str = Header(None)):
    await auth_or_403(x_tw_token)

    async def event_generator():
        queue = RUN_QUEUES[run_id]
        # initial heartbeat
        yield {"event":"heartbeat", "data":"ok"}
        while True:
            if await request.is_disconnected():
                break
            while queue:
                event = queue.popleft()
                yield {"event": event.get("type", "message"), "data": json.dumps(event)}
            await asyncio.sleep(0.2)

    return EventSourceResponse(event_generator())

@app.post("/tw/tool-call")
async def tw_tool_call(request: Request, x_tw_token: str = Header(None)):
    await auth_or_403(x_tw_token)
    body = await request.json()
    name = body.get("name")
    args = body.get("args", {})
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{NODE_URL}/api/tools/{name}",
                                  headers={"X-TW-Token": TW_SHARED_TOKEN, "Content-Type":"application/json"},
                                  json=args)
        return JSONResponse(await resp.aread(), status_code=resp.status_code)

@app.post("/tw/tool-result")
async def tw_tool_result(request: Request, x_tw_token: str = Header(None)):
    await auth_or_403(x_tw_token)
    body = await request.json()
    run_id = body.get("runId")
    tool = body.get("tool")
    result = body.get("result")
    if not run_id or not tool:
        raise HTTPException(status_code=400, detail="runId and tool required")
    await enqueue(run_id, {"type":"act", "status":"result", "tool": tool, "result": result or {"ok": True}})
    return JSONResponse({"ok": True})
