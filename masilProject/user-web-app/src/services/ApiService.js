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

  // 📋 특정 일거리 상세 정보 조회
  static async getJobById(jobId) {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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