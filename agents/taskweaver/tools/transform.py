import os
import httpx
from fastapi import HTTPException

TW_SHARED_TOKEN = os.getenv("TW_SHARED_TOKEN", "replace-me")
NODE_URL = os.getenv("NODE_URL", "http://127.0.0.1:8080")

async def move(args: dict):
  try:
    async with httpx.AsyncClient(timeout=30.0) as client:
      resp = await client.post(f"{NODE_URL}/api/tools/transform.move",
                               headers={"X-TW-Token": TW_SHARED_TOKEN, "Content-Type":"application/json"},
                               json=args)
      if resp.status_code >= 400:
        return {"ok": False, "error": {"code":"E_HTTP", "title": f"{resp.status_code}", "hint": await resp.text()}}
      return resp.json()
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))



