import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import webhooks, requests, providers, stats

app = FastAPI(title="Medizoom Backend")

# 1. LOWER THE CORS SHIELD SO NEXT.JS CAN CONNECT
# 1. LOWER THE CORS SHIELD SO ANY DEVICE CAN CONNECT
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # <--- CHANGED THIS TO ALLOW ALL
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. MOUNT ROUTERS
app.include_router(webhooks.router, prefix="/webhook", tags=["Webhooks"])
app.include_router(requests.router, prefix="/api/requests", tags=["Requests"])
app.include_router(providers.router, prefix="/api/providers", tags=["Providers"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])

@app.get("/")
def root():
    return {"status": "Active", "system": "Medizoom Core"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)