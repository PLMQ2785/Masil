#!/usr/bin/env python3
# AI-1.py
# Usage:
#   python enrich_factpack_llm.py factpack_top10.json -o factpack_enriched.json -k 3 # Top-K : 후보 수
# BE단에서 받은 factpack.v1.1 을 AI-2 factpack_enriched.json 으로 변환

import os, json, math, hashlib, argparse
from typing import Any, Dict, List, Tuple
from datetime import datetime, timezone, timedelta
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # 가성비형 모델 기본값
client = OpenAI()  # 환경변수 OPENAI_API_KEY 사용

WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

# ---------------- 시간/거리/임금 유틸 (결정론) ----------------
def parse_time_to_min(s: str) -> int:
    parts = s.split(":")
    h, m = int(parts[0]), int(parts[1])
    return h*60 + m

def interval_overlap_min(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    return max(0, end - start)

def parse_work_days(bits: str) -> List[str]:
    bits = (bits or "").strip()
    if len(bits) != 7 or not set(bits) <= {"0","1"}: return []
    return [WEEKDAYS[i] for i, ch in enumerate(bits) if ch == "1"]

def compute_time_overlap(availability_json: Dict[str, List[List[str]]],
                         work_days_bits: str, start_time: str, end_time: str) -> float:
    cand_days = set(parse_work_days(work_days_bits))
    if not cand_days: return 0.0

    c_start = parse_time_to_min(start_time)
    c_end = parse_time_to_min(end_time)

    if c_end <= c_start: return 0.0
    total_sched, total_overlap = 0, 0
    for day in cand_days:
        day_sched = (c_end - c_start)
        total_sched += day_sched
        if day not in availability_json: continue
        day_overlap = 0
        for slot in availability_json[day]:
            s = parse_time_to_min(slot[0][:5]); e = parse_time_to_min(slot[1][:5])
            if e <= s: continue
            day_overlap += interval_overlap_min(c_start, c_end, s, e)
        total_overlap += min(day_overlap, day_sched)
    if total_sched == 0: return 0.0
    return round(total_overlap / total_sched, 2)

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1; dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlmb/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def estimate_travel_min(distance_km: float) -> int:
    if distance_km <= 1.5: speed_kmh, penalty = 4.5, 0       # 도보
    elif distance_km <= 10: speed_kmh, penalty = 18.0, 10     # 대중교통(환승 10분)
    else: speed_kmh, penalty = 30.0, 8                        # 차량 추정
    minutes = (distance_km / max(speed_kmh, 1e-6)) * 60 + penalty
    return int(round(minutes))

def percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals: return 0.0
    k = (len(sorted_vals)-1) * (p/100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c: return sorted_vals[int(k)]
    return sorted_vals[f]*(c-k) + sorted_vals[c]*(k-f)

def compute_pay_norm(cands_in_region: List[Dict[str, Any]], wage: float) -> float:
    wages = sorted([c.get("hourly_wage", 0) for c in cands_in_region if c.get("hourly_wage") is not None])
    if len(wages) < 4:  # 지역 데이터가 적으면 전체 후보로 대체
        wages = sorted([c.get("hourly_wage", 0) for c in cands_in_region if c.get("hourly_wage") is not None])
    if not wages: return 0.0
    p25, p75 = percentile(wages, 25), percentile(wages, 75)
    if p75 <= p25: return 0.5
    norm = (wage - p25) / (p75 - p25)
    return float(min(1.0, max(0.0, round(norm, 2))))

# ---------------- LLM 호출 (배치 구조화 추출) ----------------
SYSTEM_PROMPT = """\
당신은 채용 공고 텍스트를 구조화하는 도우미입니다.
규칙:
- 숫자(시급/시간/요일/좌표 등)를 새로 만들지 마세요. 분류/요약/태깅만 수행하세요.
- 확실하지 않으면 null을 반환하세요.
- 출력은 무조건 JSON 한 개 객체로 반환하세요.
스키마:
{
  "items": [
    {
      "job_id": int,
      "org": string|null,            // 기관명. 텍스트에 있으면 추출(한글/영문 모두). 없으면 null
      "desc": string,                // 1~2문장 요약, 80자 이내(한국어)
      "features": {
        "indoor": "indoor"|"outdoor"|"mixed"|null,
        "english": true|false|null,
        "physical": 1|2|3|4|5|null,  // 1=매우 가벼움, 3=보통, 5=고강도
        "interaction": 1|2|3|null,   // 1=거의 없음, 2=보통, 3=고객응대 많음
        "warnings": string[],        // 0~3개, 24자 이내 간결 문구
        "tags": string[]             // 0~6개, 키워드 태그(한글)
      }
    }
  ]
}
태깅 가이드(예시): "안내/접수/사무/앉아서"⇒ physical 1–2, "서서/이동/정리/진열"⇒2–3, "운반/상하차/예초"⇒4–5.
"실내/로비/사무실/문화센터"⇒ indoor, "행사/야외"⇒ outdoor, 혼재⇒ mixed.
고객응대/좌석 유도/안내방송⇒ interaction↑. 영어/English/외국인 안내⇒ english=true.
"""

def chunked(seq: List[Any], n: int) -> List[List[Any]]:
    return [seq[i:i+n] for i in range(0, len(seq), n)]

def llm_enrich_batch(cands_batch: List[Dict[str, Any]], user_pref_keywords: List[str]) -> Dict[int, Dict[str, Any]]:
    """
    후보 묶음을 LLM에 보내 구조화 응답(JSON)으로 받음.
    실패하더라도 항상 dict를 반환(빈 dict 가능).
    """
    payload = {
        "user_pref_keywords": user_pref_keywords,
        "candidates": [
            {
                "job_id": c["job_id"],
                "title": c.get("title"),
                "description": c.get("description") or c.get("desc") or ""
            } for c in cands_batch
        ]
    }
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "system", "content": "reply only with a json object."},  # 소문자 json 센티넬
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}
            ],
        )
        txt = resp.choices[0].message.content
        obj = json.loads(txt)
        items = obj.get("items", [])
    except Exception:
        # 호출/파싱 실패 시 안전 폴백
        items = []

    out: Dict[int, Dict[str, Any]] = {}
    for it in items:
        jid = it.get("job_id")
        if jid is None:
            continue
        out[int(jid)] = {
            "org": it.get("org"),
            "desc": it.get("desc") or "",
            "features": it.get("features") or {}
        }
    return out  # 반드시 dict



def llm_his_short(work_history: str) -> str:
    """
    JSON 모드 강제 호환: messages 안에 소문자 'json'을 명시하고,
    response_format=json_object로 받는다. 실패 시 원문 일부로 폴백.
    """
    system_msg = (
        "너는 한국어 요약가이자 json 전용 응답기다. "
        "항상 오직 하나의 json 객체만 출력해."
    )
    user_msg = (
        "다음 작업 이력을 1문장(60자 이내)으로 요약하고, 반드시 json 객체로만 답해.\n"
        '반드시 이 스키마를 지켜: {"summary": string}\n'
        "중요: 응답 본문 어딘가에 반드시 소문자 json 이 포함되어야 한다.\n"
        f"원문: {work_history}"
    )
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "system", "content": "reply only with a json object."},  # 소문자 json 센티넬
                {"role": "user", "content": user_msg},
            ],
        )
        obj = json.loads(resp.choices[0].message.content)
        return str(obj.get("summary", "")).strip()[:60] or work_history[:60]
    except Exception:
        return work_history[:60]



# ---------------- 메인 변환 (LLM + 결정론) ----------------
def enrich_factpack_with_llm(data: Dict[str, Any], top_k: int = 20, batch_size: int = 20) -> Dict[str, Any]:
    user = data.get("user", {}) or {}
    cands: List[Dict[str, Any]] = data.get("candidates", []) or []
    meta_in = data.get("meta", {}) or {}

    # 사용자 컨텍스트
    interests = user.get("interests", []) or []
    pref_keywords = interests[: min(2, len(interests))]
    availability_json = user.get("availability_json", {}) or {}
    age = user.get("age", 0)

    # LLM로 Top-K 후보에 대해 요약/피처 추출
    top_cands = cands[:top_k]
    id2raw = {c["job_id"]: c for c in top_cands}

    llm_results: Dict[int, Dict[str, Any]] = {}
    for batch in chunked(top_cands, batch_size):
        enrich_map = llm_enrich_batch(batch, pref_keywords) or {}
        if not isinstance(enrich_map, dict):
            enrich_map = {}
        llm_results.update(enrich_map)


    # 지역별 묶음(임금 분포)
    by_place: Dict[str, List[Dict[str, Any]]] = {}
    for c in cands:
        by_place.setdefault(c.get("place",""), []).append(c)

    out_cands: List[Dict[str, Any]] = []
    for c in top_cands:
        jid = c.get("job_id")
        start_time = c.get("start_time","09:00:00")
        end_time   = c.get("end_time","18:00:00")
        work_bits  = c.get("work_days","0000000")

        # 거리/이동
        home_lat, home_lon = user.get("home_latitude"), user.get("home_longitude")
        job_lat, job_lon   = c.get("job_latitude"), c.get("job_longitude")
        distance_km = travel_min = None
        if all(isinstance(x, (int,float)) for x in [home_lat, home_lon, job_lat, job_lon]):
            distance_km = round(haversine_km(home_lat, home_lon, job_lat, job_lon), 2)
            travel_min  = estimate_travel_min(distance_km)

        # 시간 겹침
        time_ov = compute_time_overlap(availability_json, work_bits, start_time, end_time)

        # 임금 정규화
        region_list = by_place.get(c.get("place",""), []) or cands
        pay = c.get("hourly_wage", 0)
        pay_norm = compute_pay_norm(region_list, pay)

        # LLM 결과 병합 (불일치/결측 시 폴백)
        llm_obj = llm_results.get(jid, {}) if jid is not None else {}
        org = llm_obj.get("org")
        desc = (llm_obj.get("desc") or (c.get("description") or ""))[:120]
        feats = llm_obj.get("features") or {}
        # 최소 보정: english/physical 키가 빠졌을 때 기본값 보완
        feats.setdefault("english", None)
        feats.setdefault("physical", None)
        feats.setdefault("interaction", None)
        feats.setdefault("indoor", None)
        feats.setdefault("warnings", [])
        feats.setdefault("tags", [])

        out_cands.append({
            "job_id": jid,
            "title": c.get("title"),
            "org": org,
            "desc": desc,
            "sim_interest": round(float(c.get("sim_interest", 0.0)), 2),
            "time_overlap": time_ov,
            "hourly_wage": pay,
            "pay_norm": pay_norm,
            "distance_km": distance_km,
            "travel_min": travel_min,
            "work_days": work_bits,
            "start_time": start_time,
            "end_time": end_time,
            "features": feats
        })

    # 사용자 요약/해시
    his_short = user.get("his_short")
    if not his_short and user.get("work_history"):
        his_short = llm_his_short(user["work_history"])
    his_hash = user.get("his_hash")
    if his_short and not his_hash:
        his_hash = hashlib.sha1(his_short.strip().encode("utf-8")).hexdigest()

    # 메타
    kst = timezone(timedelta(hours=9))
    meta_out = {
        "query": meta_in.get("query"),
        "k": int(top_k),
        "computed_at": datetime.now(kst).isoformat()
    }

    out = {
        "user": {
            "locale": user.get("locale", "ko-KR"),
            "age": age,
            "pref_keywords": pref_keywords,
            "availability": availability_json
        },
        "candidates": out_cands,
        "meta": meta_out
    }
    if his_short or his_hash:
        out["user_summary"] = {"his_short": his_short, "his_hash": his_hash}
    return out

# ---------------- CLI ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_json", help="factpack.v1.1 JSON path")
    ap.add_argument("-o","--output_json", default="factpack_enriched.json")
    ap.add_argument("-k","--top_k", type=int, default=20)
    ap.add_argument("-b","--batch_size", type=int, default=20, help="LLM batch size")
    args = ap.parse_args()

    with open(args.input_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    enriched = enrich_factpack_with_llm(data, top_k=args.top_k, batch_size=args.batch_size)

    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"✅ wrote {args.output_json}")

if __name__ == "__main__":
    main()
