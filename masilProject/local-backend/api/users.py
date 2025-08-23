from datetime import date
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client, Client

from core.config import settings
from models.schemas import SessionUpdateRequest, EngagementRequest, UserProfileUpdate, EngagementStatusUpdate

# 클라이언트 초기화
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
router = APIRouter()


@router.post("/update-session")
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


@router.post("/engagements")
def record_engagement(request: EngagementRequest):
    valid_statuses = ['saved', 'applied', 'completed', 'cancelled', 'rejected', 'dismissed']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=422, detail="유효하지 않은 status 값입니다.")

    try:
        response = supabase.from_("user_job_reviews").upsert({
            "user_id": str(request.user_id),
            "job_id": request.job_id,
            "status": request.status
        }, on_conflict="user_id, job_id").execute()
        return {"message": f"'{request.status}' 상태가 성공적으로 기록되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"행동 기록 실패: {str(e)}")


@router.get("/{user_id}/profile")
def get_user_profile(user_id: UUID):
    try:
        # .single()을 제거하고 일반적인 execute()를 사용합니다.
        response = supabase.from_("users").select("*").eq("id", str(user_id)).execute()
        
        # response.data가 비어있는지 직접 확인합니다.
        if not response.data:
            raise HTTPException(status_code=404, detail="해당 ID의 사용자 프로필을 찾을 수 없습니다.")
            
        # 결과는 리스트 형태이므로, 첫 번째 항목을 반환합니다.
        return response.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로필 조회 실패: {str(e)}")
    # try:
    #     response = supabase.from_("users").select("*").eq("id", str(user_id)).single().execute()
    #     if not response.data:
    #         raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")
    #     return response.data
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"프로필 조회 실패: {str(e)}")

@router.get("/{user_id}/profile-history")
def get_user_profile(user_id: UUID):
    try:
        # select 구문에 jobs 테이블과의 조인을 추가합니다.
        # "*, jobs(title, hourly_wage, place, address, start_time, end_time)"
        # 위 구문은 user_job_reviews의 모든 필드(*)와
        # jobs 테이블의 지정된 필드를 함께 조회하라는 의미입니다.
        response = supabase.from_("user_job_reviews").select(
            "*, jobs(title, hourly_wage, place, address, start_time, end_time)"
        ).eq("user_id", str(user_id)).execute()
        
        if not response.data:
            # 데이터가 없는 것은 에러가 아니므로 404 대신 빈 리스트를 반환합니다.
            return []
            
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로필 조회 실패: {str(e)}")


@router.put("/{user_id}/profile")
def update_user_profile(user_id: UUID, profile_update: UserProfileUpdate):
    try:
        update_data = profile_update.model_dump(exclude_unset=True)
        
         # --- 👇 날짜 객체 문자열 변환 로직 추가 ---
        if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], date):
            # date 객체를 "YYYY-MM-DD" 형식의 문자열로 변환합니다.
            update_data['date_of_birth'] = update_data['date_of_birth'].isoformat()
        # --- 👆 로직 추가 끝 ---
        
        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
        response = supabase.from_("users").update(update_data).eq("id", str(user_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없어 수정에 실패했습니다.")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로필 수정 실패: {str(e)}")
    
@router.patch("/engagements/{engagement_id}/status")
def update_engagement_status(engagement_id: int, status_update: EngagementStatusUpdate):
    """(관리자용) 특정 지원 내역(engagement)의 상태를 변경합니다."""
    try:
        update_data = status_update.model_dump()
        
        # .select("*") 부분을 삭제합니다.
        response = supabase.from_("user_job_reviews").update(
            update_data
        ).eq(
            "engagement_id", engagement_id
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Engagement ID {engagement_id}를 찾을 수 없습니다.")
            
        return response.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 업데이트 실패: {str(e)}")
    
@router.get("/engagements/{engagement_id}")
def get_engagement_details(engagement_id: int):
    """(관리자용) 특정 지원 내역(engagement)의 상세 정보를 조회합니다."""
    try:
        # user_job_reviews 테이블과 jobs 테이블을 조인하여 함께 조회합니다.
        response = supabase.from_("user_job_reviews").select(
            "*, "
            "jobs(job_id, title, place, hourly_wage, address, start_time, end_time, work_days, created_at, updated_at, participants, current_participants), "
            "users(id, nickname, gender, date_of_birth, home_address)"
        ).eq(
            "engagement_id", engagement_id
        ).single().execute() # .single()을 사용하여 단 하나의 결과만 객체로 받습니다.

        # response.data가 비어있으면 해당 ID가 없다는 의미입니다.
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Engagement ID {engagement_id}를 찾을 수 없습니다.")
            
        return response.data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지원 정보 조회 실패: {str(e)}")
    
@router.get("/engagements")
def get_all_engagements(
    skip: int = Query(0, ge=0, description="페이지네이션을 위해 건너뛸 항목 수"),
    limit: int = Query(100, ge=1, le=500, description="한 번에 가져올 최대 항목 수")
):
    """(관리자용) 전체 지원 현황 목록을 조회합니다 (페이지네이션 지원)."""
    try:
        # user_job_reviews 테이블과 jobs 테이블을 조인하여 함께 조회합니다.
        # created_at을 기준으로 내림차순 정렬하여 최신 지원이 위로 오도록 합니다.
        response = supabase.from_("user_job_reviews").select(
            "*, jobs(job_id, title, place, hourly_wage, address, start_time, end_time, work_days, created_at, updated_at, participants, current_participants)"
        ).order(
            "created_at", desc=True
        ).range(
            skip, skip + limit - 1
        ).execute()

        # 데이터가 없는 것은 에러가 아니므로 빈 리스트를 반환합니다.
        if not response.data:
            return []
            
        return response.data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"전체 지원 현황 조회 실패: {str(e)}")