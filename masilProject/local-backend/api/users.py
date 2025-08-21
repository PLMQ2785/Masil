from uuid import UUID
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client

from core.config import settings
from models.schemas import SessionUpdateRequest, EngagementRequest, UserProfileUpdate

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
        response = supabase.from_("users").select("*").eq("id", str(user_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로필 조회 실패: {str(e)}")


@router.put("/{user_id}/profile")
def update_user_profile(user_id: UUID, profile_update: UserProfileUpdate):
    try:
        update_data = profile_update.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
        response = supabase.from_("users").update(update_data).eq("id", str(user_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없어 수정에 실패했습니다.")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로필 수정 실패: {str(e)}")