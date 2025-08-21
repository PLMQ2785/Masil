import math

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """ 두 GPS 좌표 간의 거리를 킬로미터(km) 단위로 계산합니다. """
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def estimate_travel_min(distance_km: float) -> int:
    """ 거리에 따른 예상 이동 시간을 분 단위로 추정합니다. """
    if distance_km is None:
        return 0
    if distance_km <= 1.5: speed_kmh, penalty = 4.5, 0
    elif distance_km <= 10: speed_kmh, penalty = 18.0, 10
    else: speed_kmh, penalty = 30.0, 8
    return int(round((distance_km / max(speed_kmh, 1e-6)) * 60 + penalty))