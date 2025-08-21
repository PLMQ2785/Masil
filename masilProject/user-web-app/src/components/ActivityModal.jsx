// src/components/ActivityModal.jsx
import React from 'react';
import './Modal.css';

export default function ActivityModal({ activity, onClose }) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleApply = () => {
    console.log('참여 신청:', activity.name);
    // 참여 신청 로직 구현
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        {/* 모달 헤더 */}
        <div className="modal-header">
          <h2 className="modal-title">{activity.name}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* 모달 콘텐츠 */}
        <div className="modal-content">
          <div className="activity-info-grid">
            <div className="info-item">
              <span className="info-label">일시:</span>
              <span className="info-value">{activity.date}</span>
            </div>
            
            {/* ✅ 추가: 활동시간 정보 표시 */}
            <div className="info-item">
              <span className="info-label">활동시간:</span>
              <span className="info-value time-highlight">{activity.time || '09:00 ~ 18:00'}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">장소:</span>
              <span className="info-value">{activity.location}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">인원:</span>
              <span className="info-value">{activity.duration}</span>
            </div>
          </div>

          {/* 추가 정보 섹션 */}
          <div className="activity-description">
            <h3>활동 내용</h3>
            <p>이 활동에 참여하여 지역사회에 도움을 줄 수 있습니다. 자세한 내용은 담당자에게 문의하시기 바랍니다.</p>
          </div>
        </div>

        {/* 모달 액션 버튼 */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button className="btn-primary" onClick={handleApply}> {/* ✅ 추가: 참여 신청 핸들러 */}
            참여 신청
          </button>
        </div>
      </div>
    </div>
  );
}