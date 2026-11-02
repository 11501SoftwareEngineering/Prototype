from fastapi import APIRouter

from app.api.v1.routes import admin_teachers, auth, health, student_sessions, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin_teachers.router)
api_router.include_router(student_sessions.router)
