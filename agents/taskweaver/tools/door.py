import os
import httpx
from fastapi import HTTPException

TW_SHARED_TOKEN = os.getenv("TW_SHARED_TOKEN", "replace-me")
NODE_URL = os.getenv("NODE_URL", "http://127.0.0.1:8080")

async def place(args: dict):
  # validate arg shape minimally
  width = float(args.get('width', 0.9))
  wallId = args.get('wallId')
  if not wallId:
    return {"ok": False, "error": {"code":"E_BAD_ARGS", "title":"wallId required", "hint":"Provide wallId"}}
  try:
    async with httpx.AsyncClient(timeout=30.0) as client:
      resp = await client.post(f"{NODE_URL}/api/tools/door.place",
                               headers={"X-TW-Token": TW_SHARED_TOKEN, "Content-Type":"application/json"},
                               json={"width": width, "wallId": wallId})
      if resp.status_code >= 400:
        return {"ok": False, "error": {"code":"E_HTTP", "title": f"{resp.status_code}", "hint": await resp.text()}}
      return resp.json()
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))



