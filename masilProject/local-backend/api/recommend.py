import traceback
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from supabase import create_client, Client
from openai import OpenAI

from core.config import settings
from models.schemas import RecommendRequest
from services.geo import haversine_km, estimate_travel_min
from services.time_calculator import compute_time_overlap_metrics

# 클라이언트 초기화
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
client = OpenAI(api_key=settings.OPENAI_API_KEY)
router = APIRouter()


# --- RAG 파이프라인 및 헬퍼 함수 ---

def build_prompt_for_reason(candidate, user_info, query):
    prompt = f"""당신은 AI 추천 전문가입니다. 사용자는 '{query}'라고 질문했습니다. 아래 [일자리 정보]를 보고, 이 일자리가 왜 사용자에게 좋은 추천인지 그 이유를 한 문장으로 간결하게 설명해주세요.

[일자리 정보]
- 제목: {candidate.get('title')}
- 내용: {candidate.get('description')}
- 장소: {candidate.get('place')}
- 시급: {candidate.get('hourly_wage')}원
- 거리: {candidate.get('distance_km')}km"""
    return prompt

def generate_fallback_reason(candidate):
    return f"'{candidate.get('title')}'은(는) 사용자님의 요청과 관련성이 높아 추천합니다."


def run_rag_pipeline(user_id: UUID, query: str, k: int, exclude_ids: Optional[List[int]] = None, current_latitude: Optional[float] = None, current_longitude: Optional[float] = None) -> dict:
    # 1. 사용자 컨텍스트 및 히스토리 조회
    user_response = supabase.from_("users").select("*").eq("id", str(user_id)).single().execute()
    user_ctx = user_response.data
    if not user_ctx:
        raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")
    
    history_response = supabase.from_("user_job_reviews").select("job_id, status").eq("user_id", str(user_id)).execute()
    user_history = history_response.data or []
    accepted_ids = {item['job_id'] for item in user_history if item['status'] in ['applied', 'completed', 'saved']}
    rejected_ids = {item['job_id'] for item in user_history if item['status'] in ['rejected']}

    # 2. 쿼리 임베딩
    embedding_response = client.embeddings.create(input=[query], model="text-embedding-3-small")
    query_embedding = embedding_response.data[0].embedding

    # 3. 후보군 검색 (Retrieval)
    candidates_response = supabase.rpc('match_jobs', {'query_embedding': query_embedding, 'match_threshold': 0.3, 'match_count': 150}).execute()
    retrieved_jobs = candidates_response.data
    if not retrieved_jobs:
        return {"answer": "죄송하지만, 요청과 유사한 소일거리를 찾지 못했습니다.", "jobs": []}

    if exclude_ids:
        retrieved_jobs = [job for job in retrieved_jobs if int(job['job_id']) not in exclude_ids]
    
    if not retrieved_jobs:
        return {"answer": "죄송하지만, 더 이상 추천해드릴 다른 소일거리가 없습니다.", "jobs": []}

    retrieved_ids = [job['job_id'] for job in retrieved_jobs]
    similarity_map = {job['job_id']: job['similarity'] for job in retrieved_jobs}
    full_candidates_response = supabase.from_("jobs").select("*").in_("job_id", retrieved_ids).execute()
    candidates = full_candidates_response.data

    # 4. 필터링 및 재정렬 (Reranking)
    reranked_jobs = []
    for job in candidates:
        base_lat = current_latitude if current_latitude is not None else user_ctx.get('home_latitude')
        base_lon = current_longitude if current_longitude is not None else user_ctx.get('home_longitude')
        
        distance_km = haversine_km(base_lat, base_lon, job.get('job_latitude'), job.get('job_longitude')) if base_lat and base_lon else None
        
        time_metrics = compute_time_overlap_metrics(user_ctx.get("availability_json", {}), job.get("work_days"), job.get("start_time"), job.get("end_time"))
        
        history_score = 1.0 if job['job_id'] in accepted_ids else -1.0 if job['job_id'] in rejected_ids else 0
        
        distance_score = (1 - (distance_km / 20)) if distance_km is not None and distance_km <= 20 else 0

        final_score = (
            similarity_map.get(job['job_id'], 0) * 0.5 +
            distance_score * 0.2 +
            time_metrics.get("time_fit", 0.0) * 0.2 +
            history_score * 0.1
        )
        
        job['match_score'] = round(final_score, 4)
        job['distance_km'] = round(distance_km, 2) if distance_km is not None else None
        job['travel_min'] = estimate_travel_min(distance_km)
        job['time_fit'] = time_metrics.get("time_fit", 0.0)
        reranked_jobs.append(job)
        
    reranked_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    top_k_jobs = reranked_jobs[:k]
    if not top_k_jobs:
        return {"answer": "조건에 맞는 소일거리를 찾지 못했습니다.", "jobs": []}
    
    # 5. 추천 이유 생성
    for job in top_k_jobs:
        try:
            prompt = build_prompt_for_reason(job, user_ctx, query)
            reason_response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}], temperature=0.2)
            job['reason'] = reason_response.choices[0].message.content
        except Exception:
            job['reason'] = generate_fallback_reason(job)

    # 6. 최종 답변 생성
    context = "\n\n".join([f"- 제목: {job['title']}\n- 내용: {job['description']}" for job in top_k_jobs])
    prompt = f"""당신은 시니어 사용자에게 일자리를 추천하는 따뜻하고 친절한 AI 비서 '잡있으'입니다.
                당신의 목표는 아래 [검색된 일자리 정보]와 사용자의 [질문]을 종합하여 개인화된 추천 메시지를 새로 작성하는 것입니다.
                [규칙]
                1. 사람에게 말을 거는 듯한 자연스러운 말투를 사용하세요.
                2. 검색된 정보 중 가장 추천 점수가 높은 일자리 1~2개를 언급하며 그 이유를 간단히 엮어서 설명해주세요.
                3. 사용자의 원래 질문의 핵심(예: '조용한', '컴퓨터')을 답변에 자연스럽게 포함시키세요.
                4. 최종 답변은 2~3 문장으로 완성하세요.
                [검색된 일자리 정보]\n{context}\n[질문]\n{query}\n[추천 메시지]"""
    chat_response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}])
    answer = chat_response.choices[0].message.content

    return {"answer": answer, "jobs": top_k_jobs}


# --- API 엔드포인트 ---

@router.post("/recommend")
def recommend_jobs_text(request: RecommendRequest):
    try:
        return run_rag_pipeline(request.user_id, request.query, 10, request.exclude_ids, request.current_latitude, request.current_longitude)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/stt")
def speech_to_text(audio_file: UploadFile = File(...)):
    try:
        file_content = audio_file.file.read()
        mime_type = "audio/m4a" if audio_file.filename.lower().endswith('.m4a') else audio_file.content_type

        transcript_response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio_file.filename, file_content, mime_type),
            response_format="text"
        )
        return {"text": str(transcript_response).strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=traceback.format_exc())

@router.post("/recommend-voice")
def recommend_jobs_voice(user_id: UUID = Form(...), audio_file: UploadFile = File(...), exclude_ids: Optional[str] = Form(None), current_latitude: Optional[float] = Form(None), current_longitude: Optional[float] = Form(None)):
    try:
        transcript_response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio_file.filename, audio_file.file.read()),
            response_format="text"
        )
        query_text = transcript_response.strip()
        
        exclude_ids_list = [int(id_str) for id_str in exclude_ids.split(',')] if exclude_ids else []
        
        return run_rag_pipeline(user_id, query_text, 5, exclude_ids_list, current_latitude, current_longitude)
    except Exception as e:
        raise HTTPException(status_code=500, detail=traceback.format_exc())