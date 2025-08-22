// src/services/ApiService.js
const API_BASE_URL = 'https://jobisbe.ngrok.app/api';

class ApiService {
  
  // 🗺️ 지도용 일거리 데이터 조회 (최소 정보만)
  static async getJobsForMap() {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs?view=map&limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🗺️ 지도용 일거리 데이터 조회 성공:', data);
      return data;
    } catch (error) {
      console.error('❌ 지도용 일거리 데이터 조회 실패:', error);
      throw error;
    }
  }

  // 🤖 AI 추천 일거리 조회 (Job있으 버튼용 - main.py의 /api/recommend 엔드포인트)
  static async getRecommendedJobs(userId, query = "사용자에게 맞는 일거리를 추천해주세요") {
    try {
      console.log('🔍 추천 요청 데이터:', { user_id: userId, query: query });
      
      const requestBody = {
        user_id: userId,
        query: query
      };
      
      console.log('📤 요청 URL:', `${API_BASE_URL}/recommend`);
      console.log('📤 요청 Body:', JSON.stringify(requestBody));
      
      const response = await fetch(`${API_BASE_URL}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📥 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        // 에러 응답의 상세 내용을 확인
        const errorText = await response.text();
        console.error('❌ 서버 에러 응답:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🤖 AI 추천 원본 응답:', data);
      
      // 응답 데이터 구조 확인 및 정리
      const jobs = data.jobs || [];
      console.log('📊 추천 일거리 개수:', jobs.length);
      
      // 각 일거리의 reason 필드 확인
      jobs.forEach((job, index) => {
        console.log(`📝 일거리 ${index + 1} (ID: ${job.job_id}):`, {
          title: job.title,
          hasReason: !!job.reason,
          reasonType: typeof job.reason,
          reasonLength: job.reason ? job.reason.length : 0,
          reasonPreview: job.reason ? job.reason.substring(0, 100) : 'NO REASON'
        });
      });
      
      return data; // { answer: "...", jobs: [...] } 형태
    } catch (error) {
      console.error('❌ AI 추천 일거리 조회 실패:', error);
      
      // 폴백: 기본 일거리 목록 반환
      console.log('🔄 폴백 모드: 기본 일거리 목록 조회');
      try {
        const fallbackJobs = await this.getJobsForMap();
        return {
          answer: "추천 시스템에 일시적 문제가 있어 기본 일거리 목록을 표시합니다.",
          jobs: fallbackJobs.slice(0, 10) // 최대 10개만
        };
      } catch (fallbackError) {
        console.error('❌ 폴백도 실패:', fallbackError);
        throw new Error('추천 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  }

  // 🆕 STT 전용 메서드 (음성을 텍스트로만 변환)
  static async speechToText(audioBlob) {
    try {
      console.log('🔤 STT 요청 데이터:', { audioSize: audioBlob.size });
      
      // FormData 생성
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'voice_input.webm');
      
      console.log('📤 STT 요청 URL:', `${API_BASE_URL}/stt`);
      
      const response = await fetch(`${API_BASE_URL}/stt`, {
        method: 'POST',
        body: formData, // Content-Type 헤더를 설정하지 않음 (multipart/form-data 자동 설정)
      });
      
      console.log('📥 STT 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ STT 서버 에러 응답:', errorText);
        throw new Error(`STT 처리 실패: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔤 STT 원본 응답:', data);
      
      return data; // { text: "변환된 텍스트" } 형태
    } catch (error) {
      console.error('❌ STT 처리 실패:', error);
      throw error;
    }
  }

  // 🎤 음성 추천 일거리 조회 (main.py의 /api/recommend-voice 엔드포인트)
  static async getVoiceRecommendedJobs(userId, audioBlob, excludeIds = []) {
    try {
      console.log('🎤 음성 추천 요청 데이터:', { 
        user_id: userId, 
        audioSize: audioBlob.size,
        excludeIds: excludeIds 
      });
      
      // FormData 생성
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('audio_file', audioBlob, 'voice_input.wav');
      
      // exclude_ids가 있으면 콤마로 구분된 문자열로 추가
      if (excludeIds && excludeIds.length > 0) {
        formData.append('exclude_ids', excludeIds.join(','));
      }
      
      console.log('📤 음성 요청 URL:', `${API_BASE_URL}/recommend-voice`);
      
      const response = await fetch(`${API_BASE_URL}/recommend-voice`, {
        method: 'POST',
        body: formData, // Content-Type 헤더를 설정하지 않음 (multipart/form-data 자동 설정)
      });
      
      console.log('📥 음성 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 음성 서버 에러 응답:', errorText);
        throw new Error(`음성 처리 실패: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🎤 음성 추천 원본 응답:', data);
      
      return data; // { answer: "...", jobs: [...] } 형태
    } catch (error) {
      console.error('❌ 음성 추천 일거리 조회 실패:', error);
      throw error;
    }
  }

  // 📋 특정 일거리 상세 정보 조회
  static async getJobById(jobId) {
    try {
      console.log(`📋 일거리 ${jobId} 상세정보 조회 요청`);
      
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📥 응답 상태 (${jobId}):`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 서버 에러 응답 (${jobId}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`📋 일거리 ${jobId} 상세정보 조회 성공:`, data);
      return data;
    } catch (error) {
      console.error(`❌ 일거리 ${jobId} 상세정보 조회 실패:`, error);
      throw error;
    }
  }

  // 🌍 사용자 위치 기반 주변 일거리 조회
  static async getNearbyJobs(latitude, longitude, radiusKm = 5) {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🌍 주변 일거리 데이터 조회 성공:', data);
      return data;
    } catch (error) {
      console.error('❌ 주변 일거리 데이터 조회 실패:', error);
      throw error;
    }
  }

  // 📝 새로운 일거리 등록
  static async createJob(jobData) {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📝 일거리 등록 성공:', data);
      return data;
    } catch (error) {
      console.error('❌ 일거리 등록 실패:', error);
      throw error;
    }
  }
}

export default ApiService;