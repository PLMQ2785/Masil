import hashlib
import json
import math
import os
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field
from supabase import Client, create_client

# --- 1. 초기화 ---
load_dotenv()

# Supabase 및 OpenAI 클라이언트
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# FastAPI 앱
app = FastAPI()

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173", # https 로컬호스트
        "http://192.168.68.67:5173", # http IP 주소
        "https://192.168.68.67:5173", # 👈 이 줄을 추가하세요.
        "https://jobis.ngrok.app",
        "https://jobisbe.ngrok.app"
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Pydantic 데이터 모델 ---
class Job(BaseModel):
    title: str
    participants: Optional[int] = None
    hourly_wage: int
    place: str
    address: Optional[str] = None
    work_days: Optional[str] = Field(None, max_length=7)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    client: Optional[str] = None
    description: Optional[str] = None
    job_latitude: float
    job_longitude: float

class Review(BaseModel):
    user_id: UUID
    rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = None
    status: str

class RecommendRequest(BaseModel):
    user_id: UUID
    query: str

class ApplyRequest(BaseModel):
    user_id: UUID
    
class SessionUpdateRequest(BaseModel):
    user_id: UUID
    session_id: UUID

# --- 3. 유틸리티 함수 (AI-1, AI-2 스크립트에서 가져옴) ---
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# (기타 compute_time_overlap, llm_enrich_batch 등 필요한 유틸 함수들을 여기에 추가합니다)

# --- 4. API 엔드포인트 ---

# [Jobs CRUD]
@app.post("/api/jobs")
def create_job(job: Job):
    text_to_embed = f"제목: {job.title}\n내용: {job.description}\n장소: {job.place}\n클라이언트: {job.client}"
    try:
        embedding_response = client.embeddings.create(input=[text_to_embed], model="text-embedding-3-small")
        embedding_vector = embedding_response.data[0].embedding
        job_data = job.model_dump()
        job_data["embedding"] = embedding_vector
        response = supabase.from_("jobs").insert(job_data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 생성 실패: {str(e)}")

@app.get("/api/jobs")
def get_jobs(user_id: Optional[UUID] = None, limit: int = 100):
    """
    user_id 쿼리 파라미터가 있으면 개인화된 추천 목록을 반환하고,
    없으면 관리자 페이지를 위한 전체 일자리 목록을 반환합니다.
    """
    try:
        # --- 1. 개인화 추천 로직 (user_id가 있을 경우) ---
        if user_id:
            # 1a. 사용자 프로필 조회 (기준 위치, 선호 직무 등)
            user_response = supabase.from_("users").select(
                "home_latitude, home_longitude, preferred_jobs"
            ).eq("id", str(user_id)).single().execute()
            
            user_profile = user_response.data
            if not user_profile or user_profile.get("home_latitude") is None:
                raise HTTPException(status_code=404, detail="사용자 프로필 또는 기준 위치 정보가 없습니다.")

            user_lat = user_profile["home_latitude"]
            user_lon = user_profile["home_longitude"]
            preferred_jobs = user_profile.get("preferred_jobs", [])

            # 1b. 사용자의 기준 위치 주변 일자리 검색 (1차 필터링)
            nearby_jobs_response = supabase.rpc('nearby_jobs_full', {
                'user_lat': user_lat,
                'user_lon': user_lon,
                'radius_meters': 10000, # 10km 반경
                'result_limit': limit
            }).execute()
            
            nearby_jobs_data = nearby_jobs_response.data
            if not nearby_jobs_data:
                return []

            # 1c. 재정렬 (Reranking): 선호 직무와의 관련성 점수 계산
            recommended_jobs = []
            for job in nearby_jobs_data:
                title = job.get("title", "")
                
                # 간단한 점수 계산: 선호 직무 키워드가 제목에 포함되면 1점씩 추가
                preference_score = 0
                if preferred_jobs:
                    for pref in preferred_jobs:
                        if pref in title:
                            preference_score += 1
                
                # 거리 점수 (가까울수록 높음)
                distance = haversine_km(user_lat, user_lon, job['job_latitude'], job['job_longitude'])
                distance_score = 1 - (distance / 10) if distance <= 10 else 0

                # 최종 점수 (선호도 50%, 거리 50%)
                job['match_score'] = round((preference_score * 0.5) + (distance_score * 0.5), 4)
                recommended_jobs.append(job)

            # 최종 점수가 높은 순으로 정렬
            recommended_jobs.sort(key=lambda x: x['match_score'], reverse=True)

            return recommended_jobs

        # --- 2. 전체 조회 로직 (user_id가 없을 경우) ---
        else:
            response = supabase.from_("jobs").select("*").order("created_at", desc=True).limit(limit).execute()
            return response.data

    except Exception as e:
        error_traceback = traceback.format_exc()
        raise HTTPException(status_code=500, detail=error_traceback)


@app.get("/api/jobs/{job_id}")
def get_job_by_id(job_id: int):
    try:
        response = supabase.from_("jobs").select("*").eq("job_id", job_id).single().execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ID {job_id} 조회 실패: {str(e)}")

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job: Job):
    text_to_embed = f"제목: {job.title}\n내용: {job.description}\n장소: {job.place}\n클라이언트: {job.client}"
    try:
        embedding_response = client.embeddings.create(input=[text_to_embed], model="text-embedding-3-small")
        embedding_vector = embedding_response.data[0].embedding
        job_data = job.model_dump()
        job_data["embedding"] = embedding_vector
        job_data["updated_at"] = "now()"
        response = supabase.from_("jobs").update(job_data).eq("job_id", job_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 수정 실패: {str(e)}")

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int):
    try:
        response = supabase.from_("jobs").delete().eq("job_id", job_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail=f"ID {job_id}를 찾을 수 없습니다.")
        return {"message": f"ID {job_id}가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 삭제 실패: {str(e)}")

# [지원하기]
@app.post("/api/jobs/{job_id}/apply")
def apply_for_job(job_id: int, request: ApplyRequest):
    try:
        # 1. 지원 마감 여부 확인 (기존과 동일)
        job_response = supabase.from_("jobs").select("participants, current_participants").eq("job_id", job_id).single().execute()
        job = job_response.data
        if not job:
            raise HTTPException(status_code=404, detail="해당 일자리를 찾을 수 없습니다.")
        if job.get('participants') is not None and job.get('current_participants', 0) >= job.get('participants'):
            raise HTTPException(status_code=400, detail="모집이 마감되었습니다.")

        # 2. 사용자의 지원 기록 생성 (기존과 동일)
        review_data = {"job_id": job_id, "user_id": str(request.user_id), "status": "applied"}
        supabase.from_("user_job_reviews").upsert(review_data).execute()
        
        # 3. DB 함수를 호출하여 지원자 수를 안전하게 1 증가
        supabase.rpc('increment_applicants', {'job_id_to_update': job_id}).execute()

        return {"message": "지원이 성공적으로 완료되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지원 처리 중 오류 발생: {str(e)}")


# [Reviews CRUD]
@app.post("/api/jobs/{job_id}/reviews")
def create_review_for_job(job_id: int, review: Review):
    try:
        review_data = review.model_dump()
        review_data["job_id"] = job_id
        review_data["user_id"] = str(review.user_id)
        supabase.from_("user_job_reviews").insert(review_data).execute()
        
        agg_response = supabase.from_("user_job_reviews").select("rating", count="exact").eq("job_id", job_id).execute()
        ratings = [item['rating'] for item in agg_response.data if item.get('rating') is not None]
        new_review_count = agg_response.count
        new_avg_rating = sum(ratings) / len(ratings) if ratings else 0

        supabase.from_("jobs").update({
            # "average_rating": new_avg_rating,
            # "review_count": new_review_count
        }).eq("job_id", job_id).execute()
        
        return {"message": "리뷰가 성공적으로 등록되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리뷰 등록 실패: {str(e)}")

@app.get("/api/jobs/{job_id}/reviews")
def get_reviews_for_job(job_id: int):
    try:
        response = supabase.from_("user_job_reviews").select("*").eq("job_id", job_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리뷰 조회 실패: {str(e)}")


# [Users Utility]
class SessionUpdateRequest(BaseModel):
    user_id: UUID
    session_id: UUID

@app.post("/api/users/update-session")
def update_user_session(request: SessionUpdateRequest):
    try:
        response = supabase.from_("users").update({
            "latest_session_id": str(request.session_id)
        }).eq("id", str(request.user_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="해당 사용자를 찾을 수 없습니다.")
        return {"message": "세션이 성공적으로 업데이트되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 업데이트 실패: {str(e)}")


# [Geocoding Utility]
@app.get("/api/geocode")
def geocode_address(address: str = Query(..., min_length=1)):
    api_key_id = os.getenv('NAVER_API_KEY_ID')
    api_key = os.getenv('NAVER_API_KEY')
    if not api_key_id or not api_key: raise HTTPException(status_code=500, detail="API 키가 서버에 설정되지 않았습니다.")
    
    url = f"https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
    headers = {"X-NCP-APIGW-API-KEY-ID": api_key_id, "X-NCP-APIGW-API-KEY": api_key}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "OK" and data.get("addresses"):
            coords = data["addresses"][0]
            return {"latitude": float(coords["y"]), "longitude": float(coords["x"])}
        else:
            raise HTTPException(status_code=404, detail="해당 주소의 좌표를 찾을 수 없습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Naver API 통신 오류: {str(e)}")


# [Recommendation RAG API]
@app.post("/api/recommend")
def recommend_jobs(request: RecommendRequest):
    """(동기 최종본) 사용자 질문을 받아 RAG 파이프라인을 실행하고 추천 결과를 반환합니다."""
    try:
        # --- 1단계: 사용자 컨텍스트 조회 ---
        user_response = supabase.from_("users").select("*").eq("id", str(request.user_id)).single().execute()
        user_ctx = user_response.data
        if not user_ctx:
            raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")

        # --- 2단계: 쿼리 임베딩 ---
        embedding_response = client.embeddings.create(input=[request.query], model="text-embedding-3-small")
        query_embedding = embedding_response.data[0].embedding

        # --- 3단계: 후보군 검색 (Retrieval) ---
        candidates_response = supabase.rpc('match_jobs', {
            'query_embedding': query_embedding,
            'match_threshold': 0.3, # 실제 서비스에서는 이 값을 튜닝해야 합니다.
            'match_count': 50
        }).execute()
        
        retrieved_jobs = candidates_response.data
        if not retrieved_jobs:
            return {"answer": "죄송하지만, 요청과 유사한 소일거리를 찾지 못했습니다.", "jobs": []}

        retrieved_ids = [job['job_id'] for job in retrieved_jobs]
        similarity_map = {job['job_id']: job['similarity'] for job in retrieved_jobs}
        
        full_candidates_response = supabase.from_("jobs").select("*").in_("job_id", retrieved_ids).execute()
        candidates = full_candidates_response.data

        # --- 4단계: 필터링 및 재정렬 (Filtering & Reranking) ---
        reranked_jobs = []
        for job in candidates:
            # 거리 계산
            distance_km = haversine_km(
                user_ctx.get('home_latitude'), user_ctx.get('home_longitude'),
                job.get('job_latitude'), job.get('job_longitude')
            )
            # TODO: AI-1의 상세 계산 로직 (시간 겹침, 임금 정규화 등)을 여기에 추가합니다.
            
            # 최종 점수 계산 (예시: 의미유사도 70%, 거리 30%)
            distance_score = 1 - (distance_km / 20) if distance_km <= 20 else 0 # 20km를 최대 거리로 가정
            match_score = similarity_map.get(job['job_id'], 0) * 0.7 + distance_score * 0.3
            
            job['match_score'] = round(match_score, 4)
            job['distance_km'] = round(distance_km, 2)
            reranked_jobs.append(job)
            
        reranked_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
        top_5_jobs = reranked_jobs[:5]

        if not top_5_jobs:
            return {"answer": "조건에 맞는 소일거리를 찾지 못했습니다.", "jobs": []}

        # --- 5단계: 최종 답변 생성 (Generation) ---
        context = "\n\n".join([f"- 제목: {job['title']} (ID: {job['job_id']})\n- 내용: {job['description']}" for job in top_5_jobs])
        prompt = f"""당신은 시니어에게 일자리를 추천하는 AI 비서입니다. 아래 [정보]를 바탕으로, 사용자의 [질문]에 대해 자연스러운 한 문장으로 답변해주세요. 답변 마지막에는 추천하는 일자리 중 가장 점수가 높은 것 하나의 제목을 언급해주세요.

                        [정보]
                        {context}

                        [질문]
                        {request.query}"""

        chat_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        answer = chat_response.choices[0].message.content

        # --- 6단계: 최종 결과 반환 ---
        return {"answer": answer, "jobs": top_5_jobs}
        
    except Exception as e:
        error_traceback = traceback.format_exc()
        raise HTTPException(status_code=500, detail=error_traceback)

# --- RAG 파이프라인 ---
def run_rag_pipeline(user_id: UUID, query: str) -> dict:
    # 1. 사용자 컨텍스트 조회
    user_response = supabase.from_("users").select("*").eq("id", str(user_id)).single().execute()
    user_ctx = user_response.data
    if not user_ctx:
        raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")

    # 2. 쿼리 임베딩
    embedding_response = client.embeddings.create(input=[query], model="text-embedding-3-small")
    query_embedding = embedding_response.data[0].embedding

    # 3. 후보군 검색 (Retrieval)
    candidates_response = supabase.rpc('match_jobs', {'query_embedding': query_embedding, 'match_threshold': 0.3, 'match_count': 50}).execute()
    retrieved_jobs = candidates_response.data
    if not retrieved_jobs:
        return {"answer": "죄송하지만, 요청과 유사한 소일거리를 찾지 못했습니다.", "jobs": []}

    retrieved_ids = [job['job_id'] for job in retrieved_jobs]
    similarity_map = {job['job_id']: job['similarity'] for job in retrieved_jobs}
    
    full_candidates_response = supabase.from_("jobs").select("*").in_("job_id", retrieved_ids).execute()
    candidates = full_candidates_response.data

    # 4. 필터링 및 재정렬 (Filtering & Reranking)
    reranked_jobs = []
    for job in candidates:
        distance_km = haversine_km(user_ctx.get('home_latitude'), user_ctx.get('home_longitude'), job.get('job_latitude'), job.get('job_longitude'))
        distance_score = 1 - (distance_km / 20) if distance_km <= 20 else 0
        match_score = similarity_map.get(job['job_id'], 0) * 0.7 + distance_score * 0.3
        job['match_score'] = round(match_score, 4)
        job['distance_km'] = round(distance_km, 2)
        reranked_jobs.append(job)
        
    reranked_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    top_5_jobs = reranked_jobs[:5]
    if not top_5_jobs:
        return {"answer": "조건에 맞는 소일거리를 찾지 못했습니다.", "jobs": []}

    # 5. 최종 답변 생성 (Generation)
    context = "\n\n".join([f"- 제목: {job['title']}\n- 내용: {job['description']}" for job in top_5_jobs])
    prompt = f"당신은 시니어에게 일자리를 추천하는 AI 비서입니다. 아래 [정보]를 바탕으로, 사용자의 [질문] '{query}'에 대해 자연스러운 한 문장으로 답변해주세요."
    chat_response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}])
    answer = chat_response.choices[0].message.content

    return {"answer": answer, "jobs": top_5_jobs}


# [AI 추천]
@app.post("/api/recommend")
def recommend_jobs_text(request: RecommendRequest):
    """텍스트 쿼리를 받아 RAG 파이프라인을 실행합니다."""
    try:
        return run_rag_pipeline(request.user_id, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recommend-voice")
def recommend_jobs_voice(user_id: UUID = Form(...), audio_file: UploadFile = File(...)):
    """오디오 파일을 받아 텍스트로 변환 후, RAG 파이프라인을 실행합니다."""
    try:
        # transcript = client.audio.transcriptions.create(model="whisper-1", file=audio_file.file, response_format="text")
         # 👇 --- 이 부분을 수정합니다 --- 👇
        # Whisper API가 이해할 수 있는 (파일명, 파일내용) 튜플 형태로 전달
        transcript_response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio_file.filename, audio_file.file.read()),
            response_format="text"
        )
        # 👆 --- 수정 끝 --- 👆

        # transcript_response가 이제 응답 객체이므로, 실제 텍스트를 가져와야 합니다.
        # (라이브러리 버전에 따라 다를 수 있으나, 일반적으로 아래와 같습니다.)
        query_text = transcript_response.strip()
        print(f"🎤 Whisper STT 결과: \"{query_text}\"")
        return run_rag_pipeline(user_id, query_text)
    except Exception as e:
        error_traceback = traceback.format_exc()
        raise HTTPException(status_code=500, detail=error_traceback)