import requests
from fastapi import APIRouter, HTTPException, Query
from core.config import settings

router = APIRouter()

@router.get("/geocode")
def geocode_address(address: str = Query(..., min_length=1)):
    api_key_id = settings.NAVER_API_KEY_ID
    api_key = settings.NAVER_API_KEY
    if not api_key_id or not api_key:
        raise HTTPException(status_code=500, detail="API 키가 서버에 설정되지 않았습니다.")
    
    url = f"https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query={address}"
    headers = {"X-NCP-APIGW-API-KEY-ID": api_key_id, "X-NCP-APIGW-API-KEY": api_key}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "OK" and data.get("addresses"):
            coords = data["addresses"][0]
            return {"latitude": float(coords["y"]), "longitude": float(coords["x"])}
        else:
            raise HTTPException(status_code=404, detail="해당 주소의 좌표를 찾을 수 없습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Naver API 통신 오류: {str(e)}")