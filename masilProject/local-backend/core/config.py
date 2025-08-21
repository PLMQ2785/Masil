import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Supabase & OpenAI
    SUPABASE_URL: str = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")

    # Naver Geocoding API
    NAVER_API_KEY_ID: str = os.getenv("NAVER_API_KEY_ID")
    NAVER_API_KEY: str = os.getenv("NAVER_API_KEY")
    
    class Config:
        env_file = ".env"

settings = Settings()