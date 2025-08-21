// src/components/JobDetailModal.jsx
import React from 'react';
import './JobDetailModal.css';

export default function JobDetailModal({ job, onClose, isVisible, showRecommendationReason = false }) {
  const formatWage = (wage) => {
    return wage ? `시급 ${wage.toLocaleString()}원` : '급여 협의';
  };

  const formatTime = (startTime, endTime) => {
    if (startTime && endTime) {
      const formatHour = (time) => {
        // HH:MM:SS 형식을 HH:MM 형식으로 변환
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

  const formatWorkDays = (workDays) => {
    if (!workDays) return '요일 협의';
    
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    const workDaysArray = workDays.split('').map(bit => bit === '1');
    const workingDays = days.filter((day, index) => workDaysArray[index]);
    
    return workingDays.length > 0 ? workingDays.join(', ') : '요일 협의';
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  if (!isVisible || !job) return null;

  return (
    <div className="job-modal-backdrop" onClick={handleBackdropClick}>
      <div className="job-modal-container">
        {/* 헤더 영역 */}
        <div className="job-modal-header">
          <h2 className="job-modal-title">{job.title}</h2>
          <button 
            className="job-modal-close" 
            onClick={onClose}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 메인 정보 영역 */}
        <div className="job-modal-content">
          {/* 급여 정보 - 강조 표시 */}
          <div className="job-wage-section">
            <div className="job-wage-amount">
              💰 {formatWage(job.hourly_wage)}
            </div>
          </div>

          {/* 기본 정보 그리드 */}
          <div className="job-info-grid">
            <div className="job-info-item">
              <span className="job-info-label">📍 장소</span>
              <div className="job-info-value">
                <div className="job-place">{job.place}</div>
                {job.address && (
                  <div className="job-address">{job.address}</div>
                )}
              </div>
            </div>

            <div className="job-info-item">
              <span className="job-info-label">⏰ 근무시간</span>
              <div className="job-info-value">
                <div className="job-time">{formatTime(job.start_time, job.end_time)}</div>
                <div className="job-days">{formatWorkDays(job.work_days)}</div>
              </div>
            </div>

            {job.participants && (
              <div className="job-info-item">
                <span className="job-info-label">👥 모집인원</span>
                <div className="job-info-value">
                  <div className="job-participants">{job.participants}명</div>
                </div>
              </div>
            )}

            {job.client && (
              <div className="job-info-item">
                <span className="job-info-label">🏢 의뢰기관</span>
                <div className="job-info-value">
                  <div className="job-client">{job.client}</div>
                </div>
              </div>
            )}
          </div>

          {/* 업무 설명 */}
          {job.description && (
            <div className="job-description-section">
              <h3 className="job-description-title">📝 업무내용</h3>
              <div className="job-description-content">
                {job.description}
              </div>
            </div>
          )}

          {/* 추천 이유 섹션 - showRecommendationReason이 true이고 reason이 있을 때만 표시 */}
          {showRecommendationReason && job.reason && (
            <div className="job-description-section">
              <h3 className="job-description-title">💡 추천 이유</h3>
              <div className="job-description-content">
                {job.reason}
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 영역 */}
        <div className="job-modal-actions">
          <button className="job-apply-button">
            지원하기
          </button>
          <button className="job-close-button" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}