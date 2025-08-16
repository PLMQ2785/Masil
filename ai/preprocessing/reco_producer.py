# csv_to_factpack.py
# -*- coding: utf-8 -*-
"""
CSV -> FactPack 입력 JSON 변환 스크립트
- 입력 CSV 예: senior_work_with_embeddings.csv
- 출력 JSON 예: factpack_input.json
- 구조:
{
  "user": {...},
  "candidates": [ {...}, ... ],
  "meta": {"k": 120, "query": "가벼운 실내 안내"}
}
"""

import json
import ast
import math
import argparse
from typing import List, Optional
import pandas as pd

# ---------------------------
# 기본 사용자 설정 (필요 시 수정)
# ---------------------------
DEFAULT_USER_CONFIG = {
    "user": {
        "user_id": 123,
        "home_latitude": 37.55,
        "home_longitude": 127.07,
        "availability_json": {"Mon":[["09:00","12:00"]], "Sat":[["10:00","12:00"]]},
        "interests": ["정원","실내"],
        "preferred_jobs": ["안내","정리"]
    },
    "query": "가벼운 실내 안내",
    "k": 120,
    "query_embedding": None,  # 리스트 벡터 넣으면 sim_interest 계산: [0.01, -0.02, ...]
}

# ---------------------------
# 유틸 함수
# ---------------------------
def find_first_col(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    return None

def parse_time_to_hhmmss(val) -> Optional[str]:
    """다양한 형식을 'HH:MM:SS'로 정규화."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s == "":
        return None
    if len(s) == 8 and s[2] == ":" and s[5] == ":":
        return s
    if len(s) == 5 and s[2] == ":":
        return s + ":00"
    if s.isdigit() and len(s) in (3, 4):  # 900 -> 09:00:00, 1330 -> 13:30:00
        h = int(s[:-2])
        m = int(s[-2:])
        return f"{h:02d}:{m:02d}:00"
    return s

def normalize_work_days(val) -> Optional[str]:
    """work_days를 '1111100' 형태 7비트 문자열로."""
    if pd.isna(val):
        return None
    if isinstance(val, str):
        s = val.strip()
        if len(s) == 7 and all(ch in "01" for ch in s):
            return s
        if s.startswith("0b") and all(ch in "01" for ch in s[2:]):
            b = s[2:]
            return b[-7:].rjust(7, "0")
        return s  # 원문 유지
    if isinstance(val, (int, float)):
        try:
            i = int(val)
            b = bin(i)[2:]
            return b[-7:].rjust(7, "0")
        except Exception:
            return str(val)
    return str(val)

def parse_embedding(val) -> Optional[List[float]]:
    """CSV의 embedding 텍스트를 float 리스트로 변환."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s == "":
        return None
    try:
        if s[0] in "[(" and s[-1] in ")]":
            arr = ast.literal_eval(s)
            return [float(x) for x in arr]
    except Exception:
        pass
    try:
        if "," in s:
            parts = [p for p in s.split(",") if p.strip()]
            return [float(p) for p in parts]
        else:
            parts = [p for p in s.split() if p.strip()]
            return [float(p) for p in parts]
    except Exception:
        return None

def cosine_similarity(a: List[float], b: List[float]) -> Optional[float]:
    if a is None or b is None or len(a) != len(b):
        return None
    dot = sum(x*y for x, y in zip(a, b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(y*y for y in b))
    if na == 0.0 or nb == 0.0:
        return None
    return dot / (na * nb)

# ---------------------------
# 메인 로직
# ---------------------------
def main():
    ap = argparse.ArgumentParser(description="CSV -> FactPack 입력 JSON 변환")
    ap.add_argument("--csv", default="senior_work_with_embeddings.csv", help="입력 CSV 경로")
    ap.add_argument("--out", default="factpack_input.json", help="출력 JSON 경로")
    ap.add_argument("--user-config", default=None,
                    help="사용자 설정 JSON 경로(없으면 기본 설정 사용)")
    args = ap.parse_args()

    # 사용자 설정 로드
    if args.user_config:
        with open(args.user_config, "r", encoding="utf-8") as f:
            user_cfg = json.load(f)
    else:
        user_cfg = DEFAULT_USER_CONFIG

    K = user_cfg.get("k", 120)
    query = user_cfg.get("query", "")
    query_embedding = user_cfg.get("query_embedding", None)

    # CSV 로드
    df = pd.read_csv(args.csv)

    # 컬럼 매핑 (유연한 별칭 지원)
    colmap = {
        "job_id":        find_first_col(df, ["job_id", "id"]),
        "title":         find_first_col(df, ["title", "job_title", "name"]),
        "description":   find_first_col(df, ["description", "desc", "details"]),
        "hourly_wage":   find_first_col(df, ["hourly_wage", "wage", "pay"]),
        "work_days":     find_first_col(df, ["work_days", "workdays", "days"]),
        "start_time":    find_first_col(df, ["start_time", "start", "start_at"]),
        "end_time":      find_first_col(df, ["end_time", "end", "end_at"]),
        "place":         find_first_col(df, ["place", "region", "district", "gu"]),
        "address":       find_first_col(df, ["address", "addr"]),
        "job_latitude":  find_first_col(df, ["job_latitude", "latitude", "lat", "y"]),
        "job_longitude": find_first_col(df, ["job_longitude", "longitude", "lon", "lng", "x"]),
        "embedding":     find_first_col(df, ["embedding", "vector", "emb"]),
    }

    # 필수 컬럼 확인
    missing_required = [k for k, v in colmap.items() if v is None and k in ["job_id", "title"]]
    if missing_required:
        raise ValueError(f"필수 컬럼이 CSV에 없습니다: {missing_required}")

    # 쿼리 임베딩 차원 확인(선택)
    if query_embedding is not None and colmap["embedding"] is not None:
        first_emb = None
        for val in df[colmap["embedding"]]:
            first_emb = parse_embedding(val)
            if first_emb is not None:
                break
        if first_emb is not None and len(first_emb) != len(query_embedding):
            raise ValueError(
                f"쿼리 임베딩 차원({len(query_embedding)}) != CSV 임베딩 차원({len(first_emb)})"
            )

    # 후보 생성
    records = []
    for _, row in df.iterrows():
        cand = {
            "job_id": int(row[colmap["job_id"]]) if colmap["job_id"] else None,
            "title": str(row[colmap["title"]]) if colmap["title"] else None,
            "hourly_wage": int(row[colmap["hourly_wage"]]) if colmap["hourly_wage"] and not pd.isna(row[colmap["hourly_wage"]]) else None,
            "work_days": normalize_work_days(row[colmap["work_days"]]) if colmap["work_days"] else None,
            "start_time": parse_time_to_hhmmss(row[colmap["start_time"]]) if colmap["start_time"] else None,
            "end_time": parse_time_to_hhmmss(row[colmap["end_time"]]) if colmap["end_time"] else None,
            "place": str(row[colmap["place"]]) if colmap["place"] and not pd.isna(row[colmap["place"]]) else None,
            "address": str(row[colmap["address"]]) if colmap["address"] and not pd.isna(row[colmap["address"]]) else None,
            "job_latitude": float(row[colmap["job_latitude"]]) if colmap["job_latitude"] and not pd.isna(row[colmap["job_latitude"]]) else None,
            "job_longitude": float(row[colmap["job_longitude"]]) if colmap["job_longitude"] and not pd.isna(row[colmap["job_longitude"]]) else None,
        }

        # (선택) sim_interest 계산
        if query_embedding is not None and colmap["embedding"] is not None:
            job_emb = parse_embedding(row[colmap["embedding"]])
            sim = cosine_similarity(query_embedding, job_emb) if job_emb is not None else None
            cand["sim_interest"] = round(sim, 6) if sim is not None else None
        else:
            cand["sim_interest"] = None

        records.append(cand)

    # 정렬 + Top-K 슬라이스 (임베딩 제공 시 유사도 내림차순)
    if query_embedding is not None:
        records.sort(key=lambda x: (x["sim_interest"] is not None, x["sim_interest"]), reverse=True)
    records = records[:K]

    # 최종 JSON
    out_json = {
        "user": user_cfg["user"],
        "candidates": records,
        "meta": {"k": K, "query": query}
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out_json, f, ensure_ascii=False, indent=2)

    print(f"✅ JSON 생성 완료: {args.out}")
    print(f"- 후보 수(k): {len(records)}")
    print(f"- query 임베딩 사용 여부: {query_embedding is not None}")
    if records:
        print("\n샘플 후보 1건:")
        print(json.dumps(records[0], ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
