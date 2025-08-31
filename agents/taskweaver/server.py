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

    # Helper: cheap intent heuristic to decide whether to act or just chat
    def is_actionable(text: str) -> bool:
        if not text:
            return False
        t = text.lower()
        keywords = [
            'create','build','add','draw','make','generate','insert',
            'room','wall','door','window','column','beam','roof','stair','slab',
            'render','token','openings','partition'
        ]
        return any(k in t for k in keywords)

    # 1) Ask backend LLM for a natural-language response (uses your existing /api/ai-chat)
    # Fail-safe: if this call fails, continue with planning for actionable goals only.
    try:
        backend_url = os.getenv("NODE_URL", "http://127.0.0.1:8080")
        payload = {
            "message": goal,
            "model": "gpt-4",
            "mode": "agent",
            "context": context
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(f"{backend_url}/api/ai-chat", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                # Backend returns key "response" (not "message"). Be tolerant to both.
                content = data.get("response") or data.get("message") or "I understand. I'll plan the steps next."
                # Minimal debug so we can verify LLM-first path is active, but avoid spam
                preview = (content or "").strip().replace("\n", " ")[:120]
                print(f"[TW] LLM-first reply OK ({len(content)} chars): {preview}…")
                await enqueue(run_id, {"type": "assistant", "content": content})
            else:
                print(f"[TW] LLM-first call failed: HTTP {resp.status_code}")
    except Exception as e:
        # Fallback assistant line
        print(f"[TW] LLM-first call exception: {e}")
        await enqueue(run_id, {"type": "assistant", "content": "Got it. I'll help with that."})

    # If goal is not actionable, end here (pure chatbot reply)
    if not is_actionable(goal):
        await enqueue(run_id, {"type": "done", "status": "success"})
        return JSONResponse({"runId": run_id})

    # 2) Simple planner: choose a client-executable tool name understood by AICommandExecutor
    chosen_tool = "geometry.createRoom"
    await enqueue(run_id, {"type":"plan", "summary":f"Plan for: {goal}", "steps":[chosen_tool]})

    # Start background task to simulate planning/execution cueing the client
    async def background_loop():
        try:
            # Use the same tool name so the client can execute it locally
            step = {"tool": chosen_tool, "args": {"width":4, "depth":5, "height":2.7}}
            # Signal client to execute
            await enqueue(run_id, {"type":"act", "status":"start", "tool": step["tool"], "args": step["args"]})
            # Wait briefly for client to respond via /tw/tool-result, but don't block indefinitely
            await asyncio.sleep(0.5)
            await enqueue(run_id, {"type":"assistant", "content": "First step completed. Would you like me to partition into two bedrooms and add doors/windows?"})
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
