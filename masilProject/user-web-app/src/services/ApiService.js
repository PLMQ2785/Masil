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
      console.log('🗺️ 지도용 소일거리 데이터 조회 성공:', data);
      return data;
    } catch (error) {
      console.error('❌ 지도용 소일거리 데이터 조회 실패:', error);
      throw error;
    }
  }

  // 🤖 AI 추천 소일거리 조회 (Job있으 버튼용 - main.py의 /api/recommend 엔드포인트)
  static async getRecommendedJobs(userId, query = "사용자에게 맞는 소일거리를 추천해주세요") {
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
      console.log('📊 추천 소일거리 개수:', jobs.length);

      // 각 소일거리의 reason 필드 확인
      jobs.forEach((job, index) => {
        console.log(`📝 소일거리 ${index + 1} (ID: ${job.job_id}):`, {
          title: job.title,
          hasReason: !!job.reason,
          reasonType: typeof job.reason,
          reasonLength: job.reason ? job.reason.length : 0,
          reasonPreview: job.reason ? job.reason.substring(0, 100) : 'NO REASON'
        });
      });
      
      return data; // { answer: "...", jobs: [...] } 형태
    } catch (error) {
      console.error('❌ AI 추천 소일거리 조회 실패:', error);

      // 폴백: 기본 소일거리 목록 반환
      console.log('🔄 폴백 모드: 기본 소일거리 목록 조회');
      try {
        const fallbackJobs = await this.getJobsForMap();
        return {
          answer: "추천 시스템에 일시적 문제가 있어 기본 소일거리 목록을 표시합니다.",
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
      console.error('❌ 음성 추천 소일거리 조회 실패:', error);
      throw error;
    }
  }

  // 📋 특정 소일거리 상세 정보 조회
  static async getJobById(jobId, userId = null) {
    try {
      console.log(`📋 소일거리 ${jobId} 상세정보 조회 요청`);

      // userId가 있는 경우 쿼리 파라미터로 추가
      const url = userId 
        ? `${API_BASE_URL}/jobs/${jobId}?user_id=${userId}`
        : `${API_BASE_URL}/jobs/${jobId}`;
      
      const response = await fetch(url, {
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
      console.log(`📋 소일거리 ${jobId} 상세정보 조회 성공:`, data);
      return data;
    } catch (error) {
      console.error(`❌ 소일거리 ${jobId} 상세정보 조회 실패:`, error);
      throw error;
    }
  }

  // 🆕 소일거리 지원 신청 메서드
  static async applyForJob(jobId, userId) {
    try {
      console.log(`📝 소일거리 ${jobId} 지원 신청 요청 (사용자: ${userId})`);

      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId
        }),
      });
      
      console.log(`📥 지원 신청 응답 상태 (${jobId}):`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ 지원 신청 에러 응답 (${jobId}):`, errorData);
        throw new Error(errorData.detail || '지원 신청에 실패했습니다.');
      }
      
      const data = await response.json();
      console.log(`✅ 소일거리 ${jobId} 지원 신청 성공:`, data);
      return data;
    } catch (error) {
      console.error(`❌ 소일거리 ${jobId} 지원 신청 실패:`, error);
      throw error;
    }
  }

  // 🆕 사용자가 지원한 소일거리 목록 조회
  // users.py의 profile-history 엔드포인트: user_job_reviews와 jobs 테이블 조인으로 한 번에 모든 정보 제공
  // 반환 데이터: title, hourly_wage, place, address, start_time, end_time 등 포함
  static async getUserAppliedJobs(userId) {
    try {
      console.log(`📋 사용자 ${userId} 지원한 소일거리 목록 조회 요청 (조인 쿼리 사용)`);
      
      const response = await fetch(`${API_BASE_URL}/${userId}/profile-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📥 지원한 소일거리 목록 응답 상태 (${userId}):`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 지원한 소일거리 목록 에러 응답 (${userId}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ 사용자 ${userId} 지원한 소일거리 목록 조회 성공 (조인된 데이터):`, data);
      console.log('📊 조인으로 가져온 필드들:', data.length > 0 ? Object.keys(data[0]) : '데이터 없음');
      
      // 백엔드에서 user_job_reviews와 jobs를 조인하여 가져온 완전한 데이터 반환
      // 추가 API 호출 없이 모든 필요한 정보를 포함
      return data;
    } catch (error) {
      console.error(`❌ 사용자 ${userId} 지원한 소일거리 목록 조회 실패:`, error);
      throw error;
    }
  }

  // 🆕 사용자 프로필 조회 (백엔드 @router.get("/{user_id}/profile") 엔드포인트)
  static async getUserProfile(userId) {
    try {
      console.log(`👤 사용자 ${userId} 프로필 조회 요청`);
      
      const response = await fetch(`${API_BASE_URL}/${userId}/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📥 프로필 조회 응답 상태 (${userId}):`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 프로필 조회 에러 응답 (${userId}):`, errorText);
        
        if (response.status === 404) {
          throw new Error('프로필을 찾을 수 없습니다.');
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ 사용자 ${userId} 프로필 조회 성공:`, data);
      return data;
    } catch (error) {
      console.error(`❌ 사용자 ${userId} 프로필 조회 실패:`, error);
      throw error;
    }
  }

  // 🆕 사용자 프로필 수정 (백엔드 @router.put("/{user_id}/profile") 엔드포인트)
  static async updateUserProfile(userId, profileData) {
    try {
      console.log(`✏️ 사용자 ${userId} 프로필 수정 요청:`, profileData);
      
      // 백엔드 스키마 검증을 위한 데이터 정리
      const cleanedData = {};
      
      // Optional[str] 필드들
      if (profileData.nickname !== undefined) cleanedData.nickname = profileData.nickname;
      if (profileData.gender !== undefined) cleanedData.gender = profileData.gender;
      if (profileData.date_of_birth !== undefined) cleanedData.date_of_birth = profileData.date_of_birth;
      if (profileData.home_address !== undefined) cleanedData.home_address = profileData.home_address;
      if (profileData.work_history !== undefined) cleanedData.work_history = profileData.work_history;
      
      // List[str] 필드들
      if (profileData.preferred_jobs !== undefined) cleanedData.preferred_jobs = profileData.preferred_jobs;
      if (profileData.interests !== undefined) cleanedData.interests = profileData.interests;
      
      // Dict[str, Any] 필드
      if (profileData.availability_json !== undefined) cleanedData.availability_json = profileData.availability_json;
      
      // Optional[int] 필드들
      if (profileData.ability_physical !== undefined) cleanedData.ability_physical = profileData.ability_physical;
      if (profileData.max_travel_time_min !== undefined) cleanedData.max_travel_time_min = profileData.max_travel_time_min;
      
      // str with pattern 필드
      if (profileData.preferred_environment !== undefined) cleanedData.preferred_environment = profileData.preferred_environment;
      
      console.log(`📤 정리된 프로필 수정 데이터:`, cleanedData);
      
      const response = await fetch(`${API_BASE_URL}/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedData),
      });
      
      console.log(`📥 프로필 수정 응답 상태 (${userId}):`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 프로필 수정 에러 응답 (${userId}):`, errorText);
        
        if (response.status === 400) {
          throw new Error('수정할 내용이 없습니다.');
        } else if (response.status === 404) {
          throw new Error('프로필을 찾을 수 없어 수정에 실패했습니다.');
        } else if (response.status === 422) {
          throw new Error('입력한 정보의 형식이 올바르지 않습니다.');
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ 사용자 ${userId} 프로필 수정 성공:`, data);
      return data;
    } catch (error) {
      console.error(`❌ 사용자 ${userId} 프로필 수정 실패:`, error);
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