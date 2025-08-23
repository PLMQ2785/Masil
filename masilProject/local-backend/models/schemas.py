from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum

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
    exclude_ids: Optional[List[int]] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None

class ApplyRequest(BaseModel):
    user_id: UUID

class SessionUpdateRequest(BaseModel):
    user_id: UUID
    session_id: UUID

class EngagementRequest(BaseModel):
    user_id: UUID
    job_id: int
    status: str

class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, pattern="^(M|F)$")
    date_of_birth: Optional[date] = None
    home_address: Optional[str] = Field(None, max_length=120)
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None
    preferred_jobs: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    availability_json: Optional[Dict[str, Any]] = None
    work_history: Optional[str] = None
    ability_physical: Optional[int] = Field(None, ge=1, le=3)
    preferred_environment: Optional[str] = Field(None)
    max_travel_time_min: Optional[int] = Field(None, gt=0)
    
# status 필드에 허용되는 값들을 Enum으로 정의
class EngagementStatus(str, Enum):
    SAVED = 'saved'
    APPLIED = 'applied'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    REJECTED = 'rejected'
    DISMISSED = 'dismissed'

# API 요청 본문(body)의 형식을 정의하는 Pydantic 모델
class EngagementStatusUpdate(BaseModel):
    status: EngagementStatus