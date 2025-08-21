# AI_2.py
# AI_1 에서 받은 ai_1_output.json을 BE로 전달할 explain.json 으로 변환
# usage:
# python ai_2_consumer.py -i ai_1_output.json -o explain.json
import json
import hashlib
import time
from openai import OpenAI
from tqdm import tqdm
import os
from dotenv import load_dotenv
# ===============================
# 1️⃣ 환경 변수 / 클라이언트
# ===============================

# os.environ["OPENAI_API_KEY_1"] = "수정필요"  # 여기에 API 키 입력
# client = OpenAI(api_key=os.environ["OPENAI_API_KEY_1"])

load_dotenv()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # 가성비형 모델 기본값
client = OpenAI()  # 환경변수 OPENAI_API_KEY 사용
# ===============================
# 2️⃣ 유틸 함수
# ===============================

def hash_str(s):
    """문자열 해시 생성 (캐시 키용)"""
    return hashlib.md5(s.encode("utf-8")).hexdigest()

def load_factpack(file_path):
    """Producer가 만든 JSON 불러오기"""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_prompt(candidate, user_info):
    """LLM 호출용 프롬프트 생성"""
    # score_breakdown에 반드시 있는 키: sim_interest, time_overlap, pay_norm, travel_min, distance_km
    # 수치는 후보의 값을 '그대로' 복사 (반올림/추정 금지)
    prompt = f"""
아래 후보(cand)와 사용자(user)를 보고 추천 이유를 한국어 2문장 이하로 요약하세요.

규칙:
- cand의 수치와 키워드만 사용 (추정/과장 금지)
- score_breakdown은 cand의 해당 필드를 '정확히 그대로' 복사
- 출력은 오직 JSON (코드블럭 금지)
- JSON 스키마:
  {{
    "job_id": <int>,
    "why_short": <string>,      # 2문장 이내
    "highlights": [<string>],   # 0~5개
    "warnings": [<string>],     # 0~3개
    "used_fields": [<string>],  # cand에서 실제로 참조한 필드명
    "score_breakdown": {{
      "sim_interest": <number>,
      "time_overlap": <number>,
      "pay_norm": <number>,
      "travel_min": <number>,
      "distance_km": <number>
    }}
  }}

cand: {json.dumps(candidate, ensure_ascii=False)}
user: {json.dumps(user_info, ensure_ascii=False)}
""".strip()
    return prompt

def call_llm(prompt, model=MODEL):
    """LLM 호출 (JSON만 허용)"""
    start_time = time.time()
    resp = client.chat.completions.create(
        model=model,
        temperature=0,
        # JSON만 허용하도록 system 지도
        messages=[
            {"role": "system", "content": "You are a careful data-to-text generator. Output ONLY valid JSON without code fences."},
            {"role": "user", "content": prompt},
        ],
        # 일부 모델만 지원하지만, 지원되는 경우 JSON 형식 강제
        response_format={"type": "json_object"}
    )
    end_time = time.time()
    latency_ms = int((end_time - start_time) * 1000)
    content = resp.choices[0].message.content
    prompt_tokens = getattr(resp.usage, "prompt_tokens", 0)
    return content, latency_ms, prompt_tokens



def validate_output(output_json, candidate):
    """환각 방지: score_breakdown 숫자 비교"""
    try:
        # 허용 오차를 0.05로 확대
        tolerance = 0.05
        for field in ["sim_interest","time_overlap","pay_norm","travel_min"]:
            # LLM 출력 값 가져오기 (필드가 없으면 0)
            output_val = output_json.get("score_breakdown", {}).get(field, 0)
            # Candidate 값 가져오기 (필드가 없으면 0)
            candidate_val = candidate.get(field, 0)

            if abs(output_val - candidate_val) > tolerance:
                print(f"Validation failed for field '{field}': output={output_val}, candidate={candidate_val}")
                return False
        return True
    except Exception as e:
        print(f"Validation error: {e}")
        return False

def generate_fallback(candidate):
    """LLM 실패 시 폴백 JSON (스펙 일치)"""
    job_id = candidate.get("job_id", -1)
    return {
        "job_id": job_id,
        "why_short": "추천 이유 생성 실패: 기본 정보만 제공합니다.",
        "highlights": [],
        "warnings": [],
        "used_fields": [],
        "score_breakdown": {
            "sim_interest": _to_num(candidate.get("sim_interest", 0)),
            "time_overlap": _to_num(candidate.get("time_overlap", 0)),
            "pay_norm": _to_num(candidate.get("pay_norm", 0)),
            "travel_min": _to_num(candidate.get("travel_min", 0)),
            "distance_km": _to_num(candidate.get("distance_km", 0)),
        },
        "fallback": True,
        "confidence": 0.0
    }


def _to_num(x, default=0.0):
    try:
        if x is None: return default
        return float(x)
    except Exception:
        return default

def validate_output(output_json, candidate):
    """환각 방지: score_breakdown 숫자 비교 (허용 오차=0.01)"""
    try:
        tol = 0.01
        fields = ["sim_interest","time_overlap","pay_norm","travel_min","distance_km"]
        for f in fields:
            out_v = _to_num(output_json.get("score_breakdown", {}).get(f, 0.0))
            cand_v = _to_num(candidate.get(f, 0.0))
            if abs(out_v - cand_v) > tol:
                print(f"[validate] {f} mismatch: out={out_v}, cand={cand_v}")
                return False
        return True
    except Exception as e:
        print(f"[validate] error: {e}")
        return False


# ===============================
# 3️⃣ Consumer 파이프라인
# ===============================

def consumer_pipeline(factpack_json, top_k=5):
    user_info = factpack_json.get("user", {})
    candidates = (factpack_json.get("candidates") or [])[:top_k]
    results, total_latency_ms, total_prompt_tokens = [], 0, 0
    errors = []

    for c in tqdm(candidates, desc="Processing candidates"):
        prompt = build_prompt(c, user_info)
        output_json, raw_output = None, ""
        latency_ms = prompt_tokens = 0

        try:
            raw_output, latency_ms, prompt_tokens = call_llm(prompt)
            # 코드펜스 대비 (response_format이 작동 못하는 모델일 경우)
            raw = raw_output.strip()
            if raw.startswith("```"):
                # ```json ... ``` 또는 ``` ... ```
                first = raw.find("\n")
                last = raw.rfind("```")
                json_str = raw[first:last].strip() if (first != -1 and last != -1) else raw
            else:
                json_str = raw
            output_json = json.loads(json_str)

            # 기본 필드 보강
            output_json.setdefault("job_id", c.get("job_id"))
            output_json.setdefault("highlights", [])
            output_json.setdefault("warnings", [])
            output_json.setdefault("used_fields", [])
            output_json.setdefault("score_breakdown", {})
            output_json.setdefault("fallback", False)
            output_json.setdefault("confidence", 0.9)  # 기본 신뢰도

            # 검증
            if not validate_output(output_json, c):
                # 1회 재시도
                raw_retry, lat_retry, tok_retry = call_llm(prompt)
                raw2 = raw_retry.strip()
                if raw2.startswith("```"):
                    first = raw2.find("\n")
                    last = raw2.rfind("```")
                    json_str2 = raw2[first:last].strip() if (first != -1 and last != -1) else raw2
                else:
                    json_str2 = raw2
                out2 = json.loads(json_str2)

                out2.setdefault("job_id", c.get("job_id"))
                out2.setdefault("highlights", [])
                out2.setdefault("warnings", [])
                out2.setdefault("used_fields", [])
                out2.setdefault("score_breakdown", {})
                out2.setdefault("fallback", False)
                out2.setdefault("confidence", 0.9)

                if not validate_output(out2, c):
                    output_json = generate_fallback(c)
                else:
                    output_json = out2
                    latency_ms = lat_retry
                    prompt_tokens = tok_retry

        except json.JSONDecodeError as e:
            errors.append(f"JSONDecodeError: {e}")
            output_json = generate_fallback(c)
        except Exception as e:
            errors.append(f"LLM/Processing error: {e}")
            output_json = generate_fallback(c)

        results.append(output_json)
        total_latency_ms += latency_ms
        total_prompt_tokens += prompt_tokens

    fallback_count = sum(1 for r in results if r.get("fallback"))
    total_candidates = len(results) or 1
    fallback_ratio = fallback_count / total_candidates

    # 입력 요약 해시 (재현성/로깅용)
    facts_hash = hash_str(json.dumps({
        "user": factpack_json.get("user", {}),
        "candidates_len": len(factpack_json.get("candidates", []))
    }, ensure_ascii=False)[:1000])

    return {
        "version": "explain.v1.1",
        "items": results,
        "meta": {
            "llm_model": MODEL,
            "latency_ms": total_latency_ms,
            "prompt_tokens": total_prompt_tokens,
            "fallback_ratio": fallback_ratio,
            "facts_hash": facts_hash,
            "errors": errors,
        }
    }



# ===============================
# 4️⃣ 실행 예제
# ===============================

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="AI_2_Consumer: ai_1_output.json -> explain.json")
    ap.add_argument("-i","--input", default="./sample/ai_1_output.json", help="Producer 출력(JSON)")
    ap.add_argument("-o","--output", default="explain.json", help="저장할 결과(JSON)")
    ap.add_argument("-k","--top_k", type=int, default=3, help="Top-K candidates to process")
    args = ap.parse_args()

    try:
        factpack = load_factpack(args.input)
        output = consumer_pipeline(factpack, top_k=args.top_k)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"✅ 완료: {args.output}")
    except FileNotFoundError:
        print(f"❌ 입력 파일 없음: {args.input} (먼저 Producer 실행 필요)")
    except Exception as e:
        print(f"❌ 오류: {e}")
