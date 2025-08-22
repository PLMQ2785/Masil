import traceback
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from supabase import create_client, Client
from openai import OpenAI
import json
from datetime import date

from core.config import settings
from models.schemas import RecommendRequest
from services.geo import haversine_km, estimate_travel_min
from services.time_calculator import compute_time_overlap_metrics, format_work_days
from services.recommend_calculator import compute_pay_norm
from services.recommend_calculator import calculate_final_score

# 클라이언트 초기화
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
client = OpenAI(api_key=settings.OPENAI_API_KEY)
router = APIRouter()

# --- RAG 파이프라인 및 헬퍼 함수 ---

# --- 유틸리티 함수 추가 ---
def calculate_age(birthdate_str: str) -> Optional[int]:
    if not birthdate_str: return None
    try:
        birthdate = date.fromisoformat(birthdate_str)
        today = date.today()
        # 생일이 지났는지 여부를 반영하여 정확한 만 나이 계산
        age = today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
        return age
    except (ValueError, TypeError):
        return None

def format_availability(availability_json) -> str:
    if not availability_json or not isinstance(availability_json, dict):
        return "정보 없음"
    
    available_days = []
    for day, slots in availability_json.items():
        if slots: # 시간대가 하나라도 있으면
            available_days.append(day)
    
    return ', '.join(available_days) if available_days else "정보 없음"

def build_prompt_for_reason(candidate, user_info, query):
    prompt = f"""당신은 AI 추천 전문가입니다. 사용자는 '{query}'라고 질문했습니다. 아래 [일자리 정보]를 보고, 이 일자리가 왜 사용자에게 좋은 추천인지 그 이유를 한 문장으로 간결하게 설명해주세요.
                그리고 답변에 간단한 이유, 이동시간, 시간 겹침 비율, 임금 분위 여부 등을 반드시 포함하시오.
                <예시>
                실내·가벼움에 적합하고, 이동 17분, 시간 겹침 14%, 임금 지역 상위 30%입니다.
                </예시>

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
    
    ab_test_flag = "llm"

    # 1. 사용자 컨텍스트 및 히스토리 조회
    user_response = supabase.from_("users").select("*").eq("id", str(user_id)).single().execute()
    user_ctx = user_response.data
    if not user_ctx:
        raise HTTPException(status_code=404, detail="사용자 정보를 찾을 수 없습니다.")
    
    # DB에서 가져온 JSON 문자열을 Python 객체로 파싱합니다.
    for key in ["preferred_jobs", "interests", "availability_json"]:
        value = user_ctx.get(key)
        if isinstance(value, str):
            try:
                # JSON 파싱 시도
                user_ctx[key] = json.loads(value)
            except json.JSONDecodeError:
                # 파싱 실패 시, 콤마로 구분된 문자열을 리스트로 변환 (예비 처리)
                print(f"Warning: '{key}' 필드가 유효한 JSON이 아니므로 문자열로 처리합니다: {value}")
                user_ctx[key] = [item.strip() for item in value.split(',')]
    # --- 👆 수정 끝 ---
    
    # --- 👇 1단계: 쿼리 재작성 (Query Rewriting) - 신규 추가 ---
    rewrite_prompt = f"""
        당신은 시니어 사용자의 일자리 검색어를 벡터 검색에 최적화된 형태로 재작성하는 전문가입니다.
        사용자의 [질문]과 [사용자 프로필]을 종합적으로 고려하여, 사용자의 숨은 의도까지 파악한 구체적인 검색어를 만들어주세요.

        [사용자 프로필]
        - 나이: {calculate_age(user_ctx.get('date_of_birth'))}세
        - 선호 직무: {user_ctx.get('preferred_jobs')}
        - 선호 환경: {user_ctx.get('preferred_environment')}
        - 근무 가능 요일: {format_availability(user_ctx.get('availability_json'))}

        [실제 재작성 요청]
        - 사용자 질문: {query}
        - 재작성된 쿼리:
        """
    
    rewrite_response = client.chat.completions.create(
        model="gpt-5-nano", # 재작성은 가벼운 모델로도 충분합니다.
        messages=[{"role": "user", "content": rewrite_prompt}],
    )
    
    rewritten_query = rewrite_response.choices[0].message.content.strip()
    print(f"--- 쿼리 재작성 완료 ---\n원본: {query}\n재작성: {rewritten_query}\n-------------------------")
    query = rewritten_query  # 재작성된 쿼리로 업데이트
    # --- 👆 신규 단계 끝 ---
    
    
    history_response = supabase.from_("user_job_reviews").select("job_id, status").eq("user_id", str(user_id)).execute()
    user_history = history_response.data or []
    accepted_ids = {item['job_id'] for item in user_history if item['status'] in ['applied', 'completed', 'saved']}
    rejected_ids = {item['job_id'] for item in user_history if item['status'] in ['rejected']}

    # 2. 쿼리 임베딩

    
     # --- 👇 2. 쿼리 임베딩 (수정된 부분) ---
     
         # 나이 계산
    age = calculate_age(user_ctx.get('date_of_birth'))
    
    # 숫자/JSON 코드를 텍스트로 변환 (LLM이 이해하기 쉽도록)
    ability_map = {1: '상', 2: '중', 3: '하'}
    ability_text = ability_map.get(user_ctx.get('ability_physical'))
    availability_summary = format_availability(user_ctx.get('availability_json'))
     
    # 2a. 임베딩을 위한 종합 텍스트 생성
    profile_info = f"""
        - 나이: {f'{age}세' if age else '정보 없음'}
        - 주소: {user_ctx.get('home_address') or '정보 없음'}
        - 근무 가능 요일: {availability_summary}
        - 신체 능력 수준: {ability_text or '정보 없음'}
        - 선호 환경: {user_ctx.get('preferred_environment') or '무관'}
        - 최대 이동 가능 시간: {f"{user_ctx.get('max_travel_time_min')}분" if user_ctx.get('max_travel_time_min') else '정보 없음'}
        - 선호 직무: {', '.join(user_ctx.get('preferred_jobs') or [])}
        - 관심사: {', '.join(user_ctx.get('interests') or [])}
        - 과거 경험: {user_ctx.get('work_history') or '없음'}
            """
    
    # 긍정적이었던 활동의 제목을 가져와 히스토리 정보 구성 (선택사항이지만 효과적)
    if accepted_ids:
        # 1. select 구문에 'job_id'를 추가합니다.
        accepted_jobs_response = supabase.from_("jobs").select("job_id, title").in_("job_id", list(accepted_ids)).execute()
        
        # 2. LLM이 이해하기 좋은 형태로 텍스트를 조합합니다. (예: "[123] 시니어 복지 보안관")
        accepted_job_texts = [
            f"[{job['job_id']}] {job['title']}" 
            for job in accepted_jobs_response.data
        ]
        history_info = f"- 과거 긍정적 활동: {', '.join(accepted_job_texts)}"
    else:
        history_info = ""
        

        
    # 모든 정보를 하나로 결합
    composite_text_for_embedding = f"""
        [사용자 질문]
        {query}

        [사용자 프로필]
        {profile_info}

        [과거 활동]
        {history_info}
        """
    print("--- 임베딩 생성용 종합 텍스트 ---")
    print(composite_text_for_embedding)
    print("---------------------------------")
        
    # embedding_response = client.embeddings.create(input=[query], model="text-embedding-3-small")
    # query_embedding = embedding_response.data[0].embedding
    
    # 2b. 종합 텍스트를 임베딩
    embedding_response = client.embeddings.create(
        input=[composite_text_for_embedding], # 👈 query 대신 composite_text_for_embedding 사용
        model="text-embedding-3-small"
    )
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
    select_query = (
    "job_id, title, participants, hourly_wage, place, address, work_days, "
    "start_time, end_time, client, description, job_latitude, job_longitude, "
    "created_at, updated_at, current_participants"
    )
    # full_candidates_response = supabase.from_("jobs").select("*").in_("job_id", retrieved_ids).execute()
    full_candidates_response = supabase.from_("jobs").select(select_query).in_("job_id", retrieved_ids).execute()
    candidates = full_candidates_response.data
    
    # --- 👇 강력한 필터(Hard Filter) 추가 ---
    original_candidate_count = len(candidates)
    
    # 예시: 재작성된 쿼리에 '주중'이 포함되면, 주말 근무 일자리 제외
    if '주중' in query and ('주말' not in query):
        candidates = [
            job for job in candidates 
            if job.get('work_days') and (job['work_days'][5] == '0' and job['work_days'][6] == '0')
        ]
    
    # 예시: 재작성된 쿼리에 '실내'가 포함되면, 제목이나 설명에 '실외','야외'가 있는 일자리 제외
    if '실내' in query and ('실외' not in query):
        candidates = [
            job for job in candidates
            if '실외' not in job.get('title','') and '야외' not in job.get('title','') and \
               '실외' not in job.get('description','') and '야외' not in job.get('description','')
        ]

    print(f"--- 강력한 필터 적용: {original_candidate_count}개 -> {len(candidates)}개 후보 ---")
    # --- 👆 필터 추가 끝 👆 ---

    # 4. 필터링 및 재정렬 (Reranking)
    
    if ab_test_flag == "llm":    
            print("--- LLM 기반 점수 계산 실행 ---")

            # LLM에게 전달할 후보군 정보 구성
            # 1. LLM 호출을 반복문 밖에서 딱 한 번만 실행합니다.
            # candidates_for_prompt = [
            #     {key: value for key, value in job.items() if key != 'embedding'}
            #     for job in candidates
            # ]
            
            candidates_for_prompt = []
            for job in candidates:
                job_info = {key: value for key, value in job.items() if key != 'embedding'}
                job_info['work_days_text'] = format_work_days(job.get('work_days'))
                candidates_for_prompt.append(job_info)
            
            
            # LLM에 전달할 프롬프트 설계 (점수 계산 역할 명시)
            scoring_prompt = f"""
                당신은 사용자의 프로필과 선호도에 맞춰 일자리를 추천하는 최고의 AI 전문가입니다.
                [사용자 정보]와 [일자리 후보 목록]을 주의 깊게 읽고, 각 일자리가 사용자의 [질문]에 얼마나 적합한지 평가해주세요.

                [역할]
                1.  [일자리 후보 목록]에 있는 각 일자리에 대해, 사용자와의 적합도를 0.0에서 1.0 사이의 'match_score'로 계산합니다. 점수가 높을수록 더 적합합니다.
                2.  모든 후보에 대한 평가 점수를 아래 [출력 형식]과 완벽하게 일치하는 단일 JSON 객체로 반환합니다.

                [엄격한 규칙]
                - 만약 사용자가 '주중 근무'를 원하는데 일자리의 'work_days_text'에 '토' 또는 '일'이 포함되어 있다면, match_score를 0.2점 이하로 부여해야 합니다.
                - 만약 사용자가 '실내 근무'를 원하는데 일자리의 내용에 '야외 활동'이 명시되어 있다면, match_score를 0.2점 이하로 부여해야 합니다.
                
                [사용자 정보]
                - 나이: {calculate_age(user_ctx.get('date_of_birth'))}세
                - 선호 직무: {user_ctx.get('preferred_jobs')}
                - 관심사: {user_ctx.get('interests')}
                - 과거 경험: {user_ctx.get('work_history')}
                - 최대 이동 가능 시간: {user_ctx.get('max_travel_time_min')}분

                [질문]
                {query}

                [일자리 후보 목록]
                {json.dumps(candidates_for_prompt, indent=2, ensure_ascii=False)}

                [출력 형식]
                {{
                "scores": [
                    {{
                    "job_id": <첫 번째 job_id>,
                    "match_score": <계산된 점수 (예: 0.9258)>
                    }},
                ]
                }}
                """
            scoring_response = client.chat.completions.create(
                    model="gpt-5-nano",
                    messages=[{"role": "user", "content": scoring_prompt}],
                    response_format={"type": "json_object"}
                )
        
            scoring_result = json.loads(scoring_response.choices[0].message.content)
            # 2. LLM의 결과를 score_map에 저장해 둡니다.
            score_map = {item['job_id']: item['match_score'] for item in scoring_result.get('scores', [])}
    
    
    reranked_jobs = []
    
    # 지역별 임금 통계 사전 계산
    by_place: Dict[str, List[Dict[str, Any]]] = {}
    for c in candidates:
        by_place.setdefault(c.get("place", ""), []).append(c)
    
    for job in candidates:
        base_lat = current_latitude if current_latitude is not None else user_ctx.get('home_latitude')
        base_lon = current_longitude if current_longitude is not None else user_ctx.get('home_longitude')
        
        distance_km = haversine_km(base_lat, base_lon, job.get('job_latitude'), job.get('job_longitude')) if base_lat and base_lon else None
        
        time_metrics = compute_time_overlap_metrics(user_ctx.get("availability_json", {}), job.get("work_days"), job.get("start_time"), job.get("end_time"))
        
        history_score = 1.0 if job['job_id'] in accepted_ids else -1.0 if job['job_id'] in rejected_ids else 0
        
        distance_score = (1 - (distance_km / 20)) if distance_km is not None and distance_km <= 20 else 0
        
        # pay_norm_score = compute_pay_norm(region_list, pay)

        # final_score = (
        #     similarity_map.get(job['job_id'], 0) * 0.5 +
        #     distance_score * 0.2 +
        #     time_metrics.get("time_fit", 0.0) * 0.2
        #     # pay_norm_score * 0.1
        # )
        
        # 점수 할당 (A/B 분기)
        if ab_test_flag == "llm":
            # 3. score_map에서 해당 job의 점수를 찾아 할당합니다.
            job['match_score'] = score_map.get(job['job_id'], 0.0)
        else:
            final_score = calculate_final_score(
                    job=job,
                    user_ctx=user_ctx,
                    similarity_map=similarity_map,
                    accepted_ids=accepted_ids,
                    rejected_ids=rejected_ids,
                    region_list=by_place.get(job.get("place", ""), []),
                    all_candidates=candidates,
                    current_latitude=base_lat,
                    current_longitude=base_lon
                )
        
            # job['match_score'] = round(final_score, 4)
            job['match_score'] = final_score['match_score']
            
        job['distance_km'] = round(distance_km, 2) if distance_km is not None else None
        job['travel_min'] = estimate_travel_min(distance_km)
        job['time_fit'] = time_metrics.get("time_fit", 0.0)
        reranked_jobs.append(job)
        
    reranked_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    # --- 👇 최저 점수 필터링 로직 추가 👇 ---
    
    # 2. 점수가 0.2를 초과하는 항목만 최종 후보로 남깁니다.
    qualified_jobs = [
        job for job in reranked_jobs if job.get('match_score', 0) > 0.2
    ]
    
    # --- 👆 로직 추가 끝 👆 ---
    
    # top_k_jobs = reranked_jobs[:k]
    top_k_jobs = qualified_jobs[:k]
    
    if not top_k_jobs:
        return {"answer": "조건에 맞는 소일거리를 찾지 못했습니다.", "jobs": []}
    
    # 5. 추천 이유 생성
    # for job in top_k_jobs:
    #     try:
    #         prompt = build_prompt_for_reason(job, user_ctx, query)
    #         reason_response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}], temperature=0.2)
    #         job['reason'] = reason_response.choices[0].message.content
    #     except Exception:
    #         job['reason'] = generate_fallback_reason(job)
    
    # top_k_for_prompt = [
    #     {key: value for key, value in job.items() if key != 'embedding'}
    #     for job in top_k_jobs
    # ]
    
    # 모든 추천 이유를 한 번에 생성하도록 하는 프롬프트
    top_k_for_prompt = []
    for job in top_k_jobs:
        job_info = {key: value for key, value in job.items() if key != 'embedding'}
        job_info['work_days_text'] = format_work_days(job.get('work_days'))
        top_k_for_prompt.append(job_info)
    
    reason_generation_prompt = f"""
        당신은 AI 추천 전문가입니다. 사용자의 [질문]과 [사용자 정보]를 바탕으로, 아래 [추천 일자리 목록]에 있는 각 일자리에 대해 왜 좋은 추천인지 그 이유를 한 문장으로 간결하게 설명해주세요.

        [사용자 정보]
        - 나이: {calculate_age(user_ctx.get('date_of_birth'))}세
        - 선호 직무: {user_ctx.get('preferred_jobs')}
        - 관심사: {user_ctx.get('interests')}

        [질문]
        {query}

        [추천 일자리 목록]
        {json.dumps(top_k_for_prompt, indent=2, ensure_ascii=False)}

        [출력 형식]
        반드시 아래와 같은 JSON 형식으로만 응답해주세요. 'reasons' 리스트에는 [추천 일자리 목록]과 동일한 순서로 각 job_id와 추천 이유를 포함해야 합니다.
        {{
        "reasons": [
            {{
            "job_id": <첫 번째 job_id>,
            "reason": "<첫 번째 추천 이유 요약>"
            }},
            {{
            "job_id": <두 번째 job_id>,
            "reason": "<두 번째 추천 이유 요약>"
            }}
        ]
        }}
        """
        
    try:
        # LLM을 딱 한 번만 호출합니다.
        reason_response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=[{"role": "user", "content": reason_generation_prompt}],
            response_format={"type": "json_object"}
        )
        
        reason_result = json.loads(reason_response.choices[0].message.content)
        reason_map = {item['job_id']: item['reason'] for item in reason_result.get('reasons', [])}

        # 생성된 이유를 top_k_jobs에 매핑합니다.
        for job in top_k_jobs:
            job['reason'] = reason_map.get(job['job_id'], generate_fallback_reason(job))

    except Exception as e:
        print(f"--- 추천 이유 생성 실패, 폴백(fallback) 로직 실행: {e} ---")
        # LLM 호출 실패 시, 각 job에 대해 간단한 기본 이유를 할당합니다.
        for job in top_k_jobs:
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
    chat_response = client.chat.completions.create(model="gpt-5-nano", messages=[{"role": "user", "content": prompt}])
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