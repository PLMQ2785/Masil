import traceback
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client
from openai import OpenAI

from core.config import settings
from models.schemas import Job, Review, ApplyRequest
from services.geo import haversine_km

# 클라이언트 초기화
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
client = OpenAI(api_key=settings.OPENAI_API_KEY)
router = APIRouter()

@router.post("")
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

@router.get("")
def get_jobs(user_id: Optional[UUID] = None, limit: int = 10):
    try:
        if user_id:
            user_response = supabase.from_("users").select("home_latitude, home_longitude, preferred_jobs").eq("id", str(user_id)).single().execute()
            user_profile = user_response.data
            if not user_profile or user_profile.get("home_latitude") is None:
                raise HTTPException(status_code=404, detail="사용자 프로필 또는 기준 위치 정보가 없습니다.")

            user_lat, user_lon = user_profile["home_latitude"], user_profile["home_longitude"]
            preferred_jobs = user_profile.get("preferred_jobs", [])

            nearby_jobs_response = supabase.rpc('nearby_jobs_full', {
                'user_lat': user_lat, 'user_lon': user_lon, 'radius_meters': 10000, 'result_limit': limit
            }).execute()
            
            if not nearby_jobs_response.data: return []

            recommended_jobs = []
            for job in nearby_jobs_response.data:
                preference_score = sum(1 for pref in preferred_jobs if pref in job.get("title", ""))
                distance = haversine_km(user_lat, user_lon, job['job_latitude'], job['job_longitude'])
                distance_score = 1 - (distance / 10) if distance <= 10 else 0
                job['match_score'] = round((preference_score * 0.5) + (distance_score * 0.5), 4)
                recommended_jobs.append(job)

            recommended_jobs.sort(key=lambda x: x['match_score'], reverse=True)
            return recommended_jobs[:limit]
        else:
            response = supabase.from_("jobs").select("*").order("created_at", desc=True).limit(limit).execute()
            return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=traceback.format_exc())

@router.get("/{job_id}")
def get_job_by_id(job_id: int, user_id: Optional[UUID] = None):
    try:
        # response = supabase.from_("jobs").select("*").eq("job_id", job_id).single().execute()
        # return response.data
        # 1. 일자리 상세 정보 조회 (job_id만 있는 경우)
        job_response = supabase.from_("jobs").select("*").eq("job_id", job_id).single().execute()
        
        if not job_response.data:
            raise HTTPException(status_code=404, detail=f"ID {job_id}를 찾을 수 없습니다.")
            
        job_details = job_response.data
        
        # 기본적으로 지원 상태는 null로 설정
        job_details['user_engagement_status'] = None
        
        # 2. user_id가 제공된 경우, 지원 상태 조회
        if user_id:
            # user_job_reviews 테이블에서 해당 사용자와 일자리의 관계를 찾습니다.
            # .maybe_single()은 결과가 없거나(지원정보 없음) 하나일 때(지원정보 있음) 모두 에러 없이 처리합니다.
            review_response = supabase.from_("user_job_reviews").select("status").eq("job_id", job_id).eq("user_id", str(user_id)).maybe_single().execute()
            
            # 3. 지원 정보가 있는 경우, 상태(status)를 응답에 추가
            if review_response.data:
                job_details['user_engagement_status'] = review_response.data.get('status')
        
        return job_details
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ID {job_id} 조회 실패: {str(e)}")

@router.put("/{job_id}")
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

@router.delete("/{job_id}")
def delete_job(job_id: int):
    try:
        response = supabase.from_("jobs").delete().eq("job_id", job_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail=f"ID {job_id}를 찾을 수 없습니다.")
        return {"message": f"ID {job_id}가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 삭제 실패: {str(e)}")

@router.post("/{job_id}/apply")
def apply_for_job(job_id: int, request: ApplyRequest):
    try:
        job_response = supabase.from_("jobs").select("participants, current_participants").eq("job_id", job_id).single().execute()
        job = job_response.data
        if not job:
            raise HTTPException(status_code=404, detail="해당 일자리를 찾을 수 없습니다.")
        if job.get('participants') is not None and job.get('current_participants', 0) >= job.get('participants'):
            raise HTTPException(status_code=400, detail="모집이 마감되었습니다.")

        review_data = {"job_id": job_id, "user_id": str(request.user_id), "status": "applied"}
        supabase.from_("user_job_reviews").upsert(review_data).execute()
        
        supabase.rpc('increment_applicants', {'job_id_to_update': job_id}).execute()

        return {"message": "지원이 성공적으로 완료되었습니다."}
    except Exception as e:
        if e.code == '23505':
            raise HTTPException(status_code=400, detail="이미 지원한 직무입니다.")
        else:
            raise HTTPException(status_code=500, detail=f"지원 처리 중 오류 발생: {str(e)}")

@router.post("/{job_id}/reviews")
def create_review_for_job(job_id: int, review: Review):
    try:
        review_data = review.model_dump()
        review_data["job_id"] = job_id
        review_data["user_id"] = str(review.user_id)
        supabase.from_("user_job_reviews").insert(review_data).execute()
        return {"message": "리뷰가 성공적으로 등록되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리뷰 등록 실패: {str(e)}")

@router.get("/{job_id}/reviews")
def get_reviews_for_job(job_id: int):
    try:
        response = supabase.from_("user_job_reviews").select("*").eq("job_id", job_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리뷰 조회 실패: {str(e)}")