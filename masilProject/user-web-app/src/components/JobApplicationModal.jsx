// src/components/JobApplicationModal.jsx
import React, { useState } from 'react';
import './JobApplicationModal.css';

export default function JobApplicationModal({ job, userId, onClose, isVisible }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

  const handleApply = async () => {
    if (!userId) {
      setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('🔄 지원 신청 시작:', { jobId: job.job_id, userId });

      const response = await fetch(`https://jobisbe.ngrok.app/api/jobs/${job.job_id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '지원 신청에 실패했습니다.');
      }

      const result = await response.json();
      console.log('✅ 지원 신청 성공:', result);
      
      setSuccess(true);
      
      // 3초 후 자동으로 모달 닫기
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error) {
      console.error('❌ 지원 신청 실패:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
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
    <div className="application-modal-backdrop" onClick={handleBackdropClick}>
      <div className="application-modal-container">
        {/* 헤더 영역 */}
        <div className="application-modal-header">
          <h3 className="application-modal-title">지원 신청</h3>
          <button 
            className="application-modal-close" 
            onClick={onClose}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="application-modal-content">
          {success ? (
            // 성공 상태
            <div className="application-success">
              <div className="success-icon">✅</div>
              <h3>지원 신청 완료!</h3>
              <p>"{job.title}" 일자리에 성공적으로 지원하셨습니다.</p>
              <p className="success-note">담당자가 연락드릴 예정입니다.</p>
            </div>
          ) : (
            // 기본 상태
            <div className="application-form">
              <div className="job-summary">
                <h4>{job.title}</h4>
                <p className="job-info">
                  📍 {job.place} | 💰 시급 {job.hourly_wage?.toLocaleString() || '협의'}원
                </p>
              </div>

              <div className="application-message">
                <p>이 일자리에 지원하시겠습니까?</p>
                <p className="application-note">
                  지원 완료 후 담당자가 연락드릴 예정입니다.
                </p>
              </div>

              {error && (
                <div className="application-error">
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        {!success && (
          <div className="application-modal-actions">
            <button 
              className="application-cancel-btn" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button 
              className="application-submit-btn" 
              onClick={handleApply}
              disabled={isSubmitting}
            >
              {isSubmitting ? '지원 중...' : '지원하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}