# AI_2.py
# AI_1 에서 받은 fackpack_enriched.json을 BE로 전달할 explain.json 으로 변환

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
    prompt = f"""
아래 후보 데이터를 보고 추천 이유를 한국어 2문장 이하로 요약하세요.
- 입력 수치와 키워드만 사용
- score_breakdown 필드는 Candidate 데이터의 해당 필드 값을 정확히 복사하세요.
- 과장, 추정 금지
- 출력은 반드시 JSON 형식만 사용
- JSON 구조:
  why_short, highlights[], warnings[], used_fields[], score_breakdown{{}}

Candidate: {json.dumps(candidate, ensure_ascii=False)}
User: {json.dumps(user_info, ensure_ascii=False)}
"""
    return prompt

def call_llm(prompt, model="gpt-4o-mini"):
    """LLM 호출"""
    start_time = time.time()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role":"user","content":prompt}],
        temperature=0
    )
    end_time = time.time()
    latency_ms = int((end_time - start_time) * 1000)
    content = resp.choices[0].message.content
    return content, latency_ms, resp.usage.prompt_tokens


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
    """LLM 실패 시 폴백 JSON"""
    # .get()을 사용하여 'job_id'에 안전하게 접근
    job_id = candidate.get("job_id", "Unknown Job ID")
    return {
        "job_id": job_id,
        "why_short": "추천 이유 생성 불가. 기본 정보만 제공됩니다.",
        "highlights": [],
        "warnings": [],
        "used_fields": [],
        "score_breakdown": {
            "sim_interest": candidate.get("sim_interest",0),
            "time_overlap": candidate.get("time_overlap",0),
            "pay_norm": candidate.get("pay_norm",0),
            "travel_min": candidate.get("travel_min",0)
        }
    }

# ===============================
# 3️⃣ Consumer 파이프라인
# ===============================

def consumer_pipeline(factpack_json, top_k=5):
    user_info = factpack_json["user"]
    candidates = factpack_json["candidates"][:top_k]  # Top-K만 LLM 호출
    results = []
    total_latency_ms = 0
    total_prompt_tokens = 0


    for c in tqdm(candidates, desc="Processing candidates"):
        prompt = build_prompt(c, user_info)
        output_json = None
        raw_output = "" # raw_output 변수 초기화
        latency_ms = 0
        prompt_tokens = 0
        try:
            raw_output, latency_ms, prompt_tokens = call_llm(prompt)
            print(f"Raw LLM output: {raw_output}") # LLM 원본 출력 확인
            # 문자열 → JSON
            # LLM이 ```json ... ``` 형식으로 응답하는 경우 처리
            if raw_output.strip().startswith("```json") and raw_output.strip().endswith("```"):
                json_string = raw_output.strip()[len("```json"): -len("```")].strip()
            else:
                json_string = raw_output.strip()

            output_json = json.loads(json_string)


            if not validate_output(output_json, c):
                print("Validation failed. Attempting retry.")
                # 1회 재시도
                raw_output_retry, latency_ms_retry, prompt_tokens_retry = call_llm(prompt)
                print(f"Raw LLM output (retry): {raw_output_retry}") # LLM 원본 출력 확인

                if raw_output_retry.strip().startswith("```json") and raw_output_retry.strip().endswith("```"):
                    json_string_retry = raw_output_retry.strip()[len("```json"): -len("```")].strip()
                else:
                    json_string_retry = raw_output_retry.strip()
                output_json_retry = json.loads(json_string_retry)

                if not validate_output(output_json_retry, c):
                    print("Validation failed again. Generating fallback.")
                    output_json = generate_fallback(c)
                else:
                    print("Validation successful after retry.")
                    output_json = output_json_retry
                    latency_ms = latency_ms_retry # Use retry latency if retry was successful
                    prompt_tokens = prompt_tokens_retry # Use retry tokens if retry was successful
            else:
                print("Validation successful.")

        except json.JSONDecodeError as e:
            print(f"JSONDecodeError: {e} - Raw output: {raw_output}")
            output_json = generate_fallback(c)
        except Exception as e:
            print(f"Error calling LLM or processing output: {e}")
            output_json = generate_fallback(c)

        results.append(output_json)
        total_latency_ms += latency_ms
        total_prompt_tokens += prompt_tokens


    # 최종 구조
    # Calculate fallback ratio after processing all candidates
    fallback_count = sum(1 for r in results if r.get("why_short", "").startswith("추천 이유 생성 불가"))
    total_candidates = len(results)
    fallback_ratio = fallback_count / total_candidates if total_candidates > 0 else 0


    return {
        "items": results,
        "meta": {
            "llm_model": "gpt-4o-mini",
            "latency_ms": total_latency_ms,
            "prompt_tokens": total_prompt_tokens,
            "fallback_ratio": fallback_ratio
        }
    }


# ===============================
# 4️⃣ 실행 예제
# ===============================

if __name__ == "__main__":
    factpack_file = "factpack_enriched.json"  # Producer가 만든 JSON
    try:
        factpack = load_factpack(factpack_file)
        output = consumer_pipeline(factpack, top_k=5)

        with open("consumer_output.json","w",encoding="utf-8") as f:
            json.dump(output,f,ensure_ascii=False,indent=4)

        print("Consumer 파이프라인 완료. 결과 consumer_output.json 저장됨")

    except FileNotFoundError:
        print(f"Error: {factpack_file} not found. Please ensure Producer pipeline is run first.")
    except Exception as e:
        print(f"An error occurred: {e}")