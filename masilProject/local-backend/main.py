from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import jobs, users, recommend, utility

# FastAPI 앱 생성
app = FastAPI(
    title="JobIs Backend API",
    description="시니어 소일거리 추천 서비스 API",
    version="1.0.0",
)

# CORS 미들웨어 설정
origins = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://192.168.68.67:5173",
    "https://192.168.68.67:5173",
    "https://jobis.ngrok.app",
    "https://jobisbe.ngrok.app",
    "http://192.168.68.113:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기능별 라우터 포함
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(users.router, prefix="/api", tags=["Users"]) # engagement는 /api/engagements 이므로 prefix /api
app.include_router(recommend.router, prefix="/api", tags=["Recommendation"])
app.include_router(utility.router, prefix="/api", tags=["Utility"])


@app.get("/", tags=["Root"])
def read_root():
    """서버 상태를 확인하는 기본 엔드포인트입니다."""
    return {"status": "ok", "message": "Welcome to JobIs API"}