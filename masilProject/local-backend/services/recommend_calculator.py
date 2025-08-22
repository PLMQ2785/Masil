import math
from typing import Dict, List, Any
from services.geo import haversine_km, estimate_travel_min

# --- Pay Score Calculation ---
def percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals: return 0.0
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c: return sorted_vals[int(k)]
    return sorted_vals[int(f)] * (c - k) + sorted_vals[int(c)] * (k - f)

def compute_pay_norm(cands_in_region: List[Dict[str, Any]], all_cands: List[Dict[str, Any]], wage: float) -> float:
    # 지역 내 후보가 4개 미만이면 전체 후보군을 사용
    wages_source = cands_in_region if len(cands_in_region) >= 4 else all_cands
    wages = sorted([c.get("hourly_wage", 0) for c in wages_source if c.get("hourly_wage") is not None])
    
    if not wages: return 0.5
    
    p25 = percentile(wages, 25)
    p75 = percentile(wages, 75)
    
    if p75 <= p25: return 0.5
    
    norm = (wage - p25) / (p75 - p25)
    return float(min(1.0, max(0.0, round(norm, 2))))

# --- Final Score Calculation ---
def calculate_final_score(job: Dict[str, Any], user_ctx: Dict[str, Any], similarity_map: Dict[int, float], accepted_ids: set, rejected_ids: set, region_list: List[Dict[str, Any]], all_candidates: List[Dict[str, Any]], current_latitude: float = None, current_longitude: float = None) -> Dict[str, Any]:
    """
    하나의 job에 대한 모든 점수를 계산하고 필요한 필드를 반환합니다.
    """
    # 1. 거리 및 이동 시간 계산
    base_lat = current_latitude if current_latitude is not None else user_ctx.get('home_latitude')
    base_lon = current_longitude if current_longitude is not None else user_ctx.get('home_longitude')
    
    distance_km = haversine_km(base_lat, base_lon, job.get('job_latitude'), job.get('job_longitude')) if base_lat and base_lon else None
    travel_min = estimate_travel_min(distance_km) if distance_km is not None else None

    # 2. 시간 적합도 계산
    # (compute_time_overlap_metrics 함수가 이 파일 또는 다른 유틸 파일에 있다고 가정)
    # time_metrics = compute_time_overlap_metrics(...)
    time_fit_score = 0.5 # 임시값

    # 3. 히스토리 점수 계산
    history_score = 1.0 if job['job_id'] in accepted_ids else -1.0 if job['job_id'] in rejected_ids else 0
    
    # 4. 개별 점수 계산
    distance_score = (1 - (distance_km / 20)) if distance_km is not None and distance_km <= 20 else 0
    pay_norm_score = compute_pay_norm(region_list, all_candidates, job.get('hourly_wage', 0))

    # 5. 최종 점수 계산 (가중치 합산)
    final_score = (
        similarity_map.get(job['job_id'], 0) * 0.5 +
        distance_score * 0.2 +
        time_fit_score * 0.2 +
        pay_norm_score * 0.1
        # history_score * 0.1
    )
    
    # 6. job 객체에 추가할 필드들을 딕셔너리로 반환
    return {
        'match_score': round(final_score, 4),
        'distance_km': round(distance_km, 2) if distance_km is not None else None,
        'travel_min': travel_min,
        'time_fit': time_fit_score
    }

# (haversine_km, estimate_travel_min, compute_time_overlap_metrics 등
#  다른 유틸 함수들도 이 파일이나 별도의 utils.py 파일로 옮기는 것이 좋습니다.)