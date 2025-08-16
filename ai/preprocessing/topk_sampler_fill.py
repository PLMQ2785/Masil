# -*- coding: utf-8 -*-
"""
factpack_input.json -> factpack_topk.json
- candidates 120개 중 임의의 10개 샘플링
- null인 job_latitude/job_longitude/sim_interest 합리적 랜덤 값으로 채움
- sim_interest 기준 내림차순 정렬
사용 예:
  python topk_sampler_fill.py --in factpack_input.json --out factpack_top10.json --k 10 --seed 42
"""

import json
import math
import random
import argparse
from pathlib import Path

def deg_per_km_lat():
    # 위도 1도 ≈ 111km
    return 1.0 / 111.0

def deg_per_km_lon_at(lat_deg: float):
    # 경도 1도 ≈ 111km * cos(latitude)
    return 1.0 / (111.0 * max(0.000001, math.cos(math.radians(lat_deg))))

def jitter_coord_around(lat0: float, lon0: float, max_km: float = 5.0):
    """
    사용자 기준점(lat0, lon0) 주변 반경 max_km 내 무작위 좌표 생성(평면 근사).
    해커톤 데모용: 정확 ETA 필요 없음.
    """
    d_lat = deg_per_km_lat() * random.uniform(-max_km, max_km)
    d_lon = deg_per_km_lon_at(lat0) * random.uniform(-max_km, max_km)
    return round(lat0 + d_lat, 6), round(lon0 + d_lon, 6)

def fill_missing_fields(c, user_lat, user_lon):
    # 위경도 채우기
    if c.get("job_latitude") is None or c.get("job_longitude") is None:
        lat, lon = jitter_coord_around(user_lat, user_lon, max_km=5.0)
        c["job_latitude"] = lat
        c["job_longitude"] = lon

    # sim_interest 채우기 (0.60~0.95 사이 무작위)
    if c.get("sim_interest") is None:
        c["sim_interest"] = round(random.uniform(0.60, 0.95), 4)

    return c

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="입력 JSON (factpack_input.json)")
    ap.add_argument("--out", dest="out", required=True, help="출력 JSON (예: factpack_top10.json)")
    ap.add_argument("--k", type=int, default=10, help="뽑을 후보 수 (기본 10)")
    ap.add_argument("--seed", type=int, default=42, help="랜덤 시드 (재현성)")
    args = ap.parse_args()

    random.seed(args.seed)

    in_path = Path(args.inp)
    out_path = Path(args.out)

    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    user = data.get("user", {})
    candidates = data.get("candidates", [])

    if not candidates:
        raise ValueError("candidates가 비어 있습니다. 입력 JSON을 확인하세요.")

    user_lat = float(user.get("home_latitude", 37.55))
    user_lon = float(user.get("home_longitude", 127.07))

    # 1) 임의 샘플링 (중복 없이)
    k = min(args.k, len(candidates))
    sampled = random.sample(candidates, k)

    # 2) null 필드 채우기
    filled = [fill_missing_fields(dict(c), user_lat, user_lon) for c in sampled]

    # 3) sim_interest 기준 내림차순 정렬(동점 시 시급 높은 순으로 가볍게 tie-break)
    filled.sort(key=lambda x: (x.get("sim_interest", 0.0), x.get("hourly_wage") or 0), reverse=True)

    # 4) 결과 조립
    out_json = {
        "user": user,
        "candidates": filled,
        "meta": {
            "k": k,
            "source_k": data.get("meta", {}).get("k", len(candidates)),
            "query": data.get("meta", {}).get("query", ""),
            "note": "demo: filled null coords & sim_interest; random sampled top-k then sorted by sim_interest"
        }
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(out_json, f, ensure_ascii=False, indent=2)

    # 콘솔 요약
    print(f"[OK] saved: {out_path}")
    print(f"- user_id: {user.get('user_id')}")
    print(f"- sampled: {k} / {len(candidates)}")
    print(f"- first item: {filled[0]['job_id']} (sim_interest={filled[0]['sim_interest']})")

if __name__ == "__main__":
    main()
