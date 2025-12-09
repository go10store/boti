from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine
from routers import auth, drivers, orders

# Create DB Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Boti API", description="Water Truck Ordering System for Zintan")

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(drivers.router)
app.include_router(orders.router)

# Mount static files (Frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")

from fastapi.responses import RedirectResponse

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/db-test")
async def db_test():
    try:
        from database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "Database Connected Successfully!"}
    except Exception as e:
        return {"status": "Database Error", "details": str(e)}
