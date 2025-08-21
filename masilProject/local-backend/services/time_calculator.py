import math
from typing import Dict, List

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def parse_time_to_min(s: str) -> int:
    if not s or ":" not in s: return 0
    parts = s.split(":")
    return int(parts[0]) * 60 + int(parts[1])

def interval_overlap_min(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    return max(0, min(a_end, b_end) - max(a_start, b_start))

def parse_work_days(bits: str) -> List[str]:
    bits = (bits or "").strip()
    if len(bits) != 7 or not set(bits) <= {"0", "1"}: return []
    return [WEEKDAYS[i] for i, ch in enumerate(bits) if ch == "1"]

def compute_time_overlap_metrics(availability_json: Dict, work_days_bits: str, start_time: str, end_time: str) -> Dict:
    if not availability_json: availability_json = {}
    if not work_days_bits: work_days_bits = "0000000"
    if not start_time: start_time = "00:00:00"
    if not end_time: end_time = "00:00:00"
    
    cand_days = parse_work_days(work_days_bits)
    if not cand_days:
        return {"job_norm": 0.0, "intersection_norm": 0.0, "user_fit_ratio": 0.0, "time_fit": 0.0}

    c_start = parse_time_to_min(start_time)
    c_end = parse_time_to_min(end_time)
    overnight = False
    if c_end <= c_start:
        c_end += 24*60
        overnight = True
    day_sched = c_end - c_start

    def slots_minutes(slots: List[List[str]]) -> int:
        total = 0
        for slot in slots or []:
            s = parse_time_to_min(slot[0][:5]); e = parse_time_to_min(slot[1][:5])
            if e <= s:
                continue
            total += (e - s)
        return total

    user_total_min = 0
    user_min_by_day = {}
    for day in WEEKDAYS:
        mins = slots_minutes(availability_json.get(day, []))
        user_min_by_day[day] = mins
        user_total_min += mins

    def overlap_with_day(day: str) -> int:
        olap = 0
        segA_start, segA_end = c_start, min(c_end, 1440)
        if segA_end > segA_start:
            for slot in availability_json.get(day, []):
                s = parse_time_to_min(slot[0][:5]); e = parse_time_to_min(slot[1][:5])
                if e > s:
                    olap += interval_overlap_min(segA_start, segA_end, s, e)
        if overnight and c_end > 1440:
            next_idx = (WEEKDAYS.index(day) + 1) % 7
            next_day = WEEKDAYS[next_idx]
            segB_start, segB_end = 0, c_end - 1440
            if segB_end > segB_start:
                for slot in availability_json.get(next_day, []):
                    s = parse_time_to_min(slot[0][:5]); e = parse_time_to_min(slot[1][:5])
                    if e > s:
                        olap += interval_overlap_min(segB_start, segB_end, s, e)
        return olap

    overlap_min = 0
    intersection_days = 0
    for day in cand_days:
        overlap_d = overlap_with_day(day)
        overlap_min += min(overlap_d, day_sched)
        next_day = WEEKDAYS[(WEEKDAYS.index(day)+1) % 7]
        if user_min_by_day.get(day, 0) > 0 or (overnight and user_min_by_day.get(next_day, 0) > 0):
            intersection_days += 1

    job_total_min = day_sched * len(cand_days)
    job_norm = (overlap_min / job_total_min) if job_total_min > 0 else 0.0
    inter_den = (day_sched * max(intersection_days, 1))
    intersection_norm = (overlap_min / inter_den) if inter_den > 0 else 0.0
    user_fit_ratio = (overlap_min / user_total_min) if user_total_min > 0 else 0.0
    eps = 1e-6
    time_fit = ((job_norm+eps) * (intersection_norm+eps) * (user_fit_ratio+eps)) ** (1/3) - eps

    return {
        "job_norm": round(job_norm, 2),
        "intersection_norm": round(intersection_norm, 2),
        "user_fit_ratio": round(user_fit_ratio, 2),
        "time_fit": round(time_fit, 2),
    }