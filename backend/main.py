from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).with_name(".env"), override=False)

from auth import router
from travel import router as travel_router
from together import router as together_router

app = FastAPI(title="Yatra API", version="0.1.0")
app.include_router(router)
app.include_router(travel_router)
app.include_router(together_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exception: RequestValidationError):
    errors = [{key: error[key] for key in ("loc", "msg", "type")} for error in exception.errors()]
    return JSONResponse(status_code=422, content={"detail": errors}, headers={"Cache-Control": "no-store"})


@app.exception_handler(psycopg.Error)
async def database_error(request: Request, exception: psycopg.Error):
    return JSONResponse(status_code=503, content={"detail": "Account service is temporarily unavailable."},
                        headers={"Cache-Control": "no-store"})


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}