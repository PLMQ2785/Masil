// src/pages/MyProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../services/ApiService';
import './MyProfilePage.css';

export default function MyProfilePage({ session }) {
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  const userId = session?.user?.id;
  const userNickname = session?.user?.user_metadata?.nickname || '사용자';

  useEffect(() => {
    if (!userId) {
      setError('사용자 정보를 확인할 수 없습니다.');
      setLoading(false);
      return;
    }
    
    fetchAppliedJobs();
  }, [userId]);

  const fetchAppliedJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 지원한 일자리 목록 조회 시작 - 사용자 ID:', userId);
      
      // 한 번의 API 호출로 조인된 데이터를 모두 가져옴
      const data = await ApiService.getUserAppliedJobs(userId);
      
      console.log('✅ 지원한 일자리 목록 조회 성공 (조인된 데이터):', data);
      console.log('📊 데이터 구조 분석:');
      console.log('- 데이터 길이:', data?.length);
      console.log('- 첫 번째 항목:', data?.[0]);
      console.log('- 첫 번째 항목의 jobs 필드:', data?.[0]?.jobs);
      console.log('- 데이터 타입:', typeof data);
      console.log('- 배열인가?', Array.isArray(data));
      
      if (data && Array.isArray(data)) {
        setAppliedJobs(data);
      } else {
        console.warn('⚠️ 예상하지 못한 데이터 구조:', data);
        setAppliedJobs([]);
      }
      
    } catch (error) {
      console.error('❌ 지원한 일자리 목록 조회 실패:', error);
      setError('지원한 일자리 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const formatWage = (wage) => {
    return wage ? `시급 ${wage.toLocaleString()}원` : '급여 협의';
  };

  const formatTime = (startTime, endTime) => {
    if (startTime && endTime) {
      const formatHour = (time) => {
        if (time && time.includes(':')) {
          const parts = time.split(':');
          return `${parts[0]}:${parts[1]}`;
        }
        return time;
      };
      return `${formatHour(startTime)} ~ ${formatHour(endTime)}`;
    }
    return '시간 협의';
  };

  if (!session || !userId) {
    return (
      <div className="profile-page-container">
        <div className="profile-error">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2>로그인 정보 오류</h2>
          <p>사용자 정보를 확인할 수 없습니다.<br />다시 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      {/* 헤더 */}
      <div className="profile-header">
        <button className="profile-back-btn" onClick={goBack}>
          ←
        </button>
        <h1 className="profile-title">나의 정보</h1>
      </div>

      {/* 사용자 정보 섹션 */}
      <div className="profile-user-info">
        <div className="user-avatar">👤</div>
        <h2 className="user-name">{userNickname}님</h2>
        <p className="user-subtitle">지원한 일자리 목록</p>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="profile-content">
        {loading ? (
          <div className="profile-loading">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p>지원한 일자리 목록을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="profile-error-message">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p>{error}</p>
            <button className="profile-retry-btn" onClick={fetchAppliedJobs}>
              다시 시도
            </button>
          </div>
        ) : appliedJobs.length === 0 ? (
          <div className="profile-empty">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <h3>아직 지원한 일자리가 없습니다</h3>
            <p>지도에서 관심있는 일자리에 지원해보세요!</p>
          </div>
        ) : (
          <div className="applied-jobs-list">
            <div className="applied-jobs-header">
              <h3>지원한 일자리 ({appliedJobs.length}개)</h3>
            </div>
            
            {appliedJobs.map((item, index) => {
              // 콘솔 데이터 구조를 보면 jobs 객체가 중첩되어 있음
              const job = item.jobs || item; // jobs 객체가 있으면 사용, 없으면 item 자체 사용
              
              console.log('🔍 렌더링할 job 데이터:', job);
              
              return (
                <div key={item.job_id || job.job_id || index} className="applied-job-card">
                  <div className="job-card-header">
                    <h4 className="job-card-title">{job.title || '제목 없음'}</h4>
                    <span className="job-card-status">지원완료</span>
                  </div>
                  
                  {/* 백엔드 조인 쿼리로 가져온 모든 정보 표시 */}
                  <div className="job-card-info">
                    <div className="job-info-row">
                      <span className="job-info-label">💰 급여:</span>
                      <span className="job-info-value">{formatWage(job.hourly_wage)}</span>
                    </div>
                    
                    <div className="job-info-row">
                      <span className="job-info-label">📍 장소:</span>
                      <span className="job-info-value">{job.place || '장소 정보 없음'}</span>
                    </div>
                    
                    {/* 조인으로 가져온 주소 정보 표시 */}
                    {job.address && (
                      <div className="job-info-row">
                        <span className="job-info-label">🏠 주소:</span>
                        <span className="job-info-value">{job.address}</span>
                      </div>
                    )}
                    
                    {/* 조인으로 가져온 시간 정보 표시 */}
                    <div className="job-info-row">
                      <span className="job-info-label">⏰ 시간:</span>
                      <span className="job-info-value">{formatTime(job.start_time, job.end_time)}</span>
                    </div>
                    
                    
                    
                    {/* 추가 정보들 (있을 경우만 표시) */}
                    {job.participants && (
                      <div className="job-info-row">
                        <span className="job-info-label">👥 인원:</span>
                        <span className="job-info-value">{job.participants}명</span>
                      </div>
                    )}
                    
                    {job.client && (
                      <div className="job-info-row">
                        <span className="job-info-label">🏢 의뢰기관:</span>
                        <span className="job-info-value">{job.client}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 업무 설명 (있을 경우만 표시) */}
                  {job.description && (
                    <div className="job-card-description">
                      <h5>업무내용</h5>
                      <p>{job.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}