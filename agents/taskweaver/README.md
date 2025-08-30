# TaskWeaver Sidecar (FastAPI)

A lightweight sidecar that runs TaskWeaver planning/execution and streams step events to the app.

## Quick start

```
cd agents/taskweaver
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set TW_SHARED_TOKEN and provider API key
uvicorn server:app --host 127.0.0.1 --port 8765 --reload
```

## Env

- TW_SHARED_TOKEN: shared secret for TW⇄Node calls
- PROVIDER: anthropic | openai
- ANTHROPIC_API_KEY / OPENAI_API_KEY: provider key(s)

## Endpoints

- POST /tw/run: start a run
- GET  /tw/events/{runId}: stream SSE events
- POST /tw/tool-call: internal route used by tools to call Node `/api/tools/*`

All calls must include header `X-TW-Token: $TW_SHARED_TOKEN`.

## Tool contracts

Each tool in `tools/*.py` validates minimal JSON and posts to Node `/api/tools/<name>` with the same shared token. Expected result shape:

```json
{ "ok": true, "data": {"id":"..."} }
```

Errors:
```json
{ "ok": false, "error": { "code":"E_BAD_ARGS", "title":"Bad arguments", "hint":"...", "suggestedPatch": {"args":{}} } }
```

Node should map each tool to existing executor APIs.



