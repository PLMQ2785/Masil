// src/components/VoiceModal.jsx
import React, { useState, useEffect } from 'react';
import './VoiceModal.css';

export default function VoiceModal({ onClose }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState('ready'); // 'ready', 'listening', 'processing', 'complete', 'recommendation'

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

  const startListening = () => {
    setPhase('listening');
    setIsListening(true);
    setTranscript('');
    
    console.log('🎤 음성 인식 시작...');
    
    // 실제 음성 인식 API 연동 시 여기에 구현
    // 시뮬레이션: 3초 후 처리 중으로 변경, 그 후 완료, 그 후 추천 결과
    setTimeout(() => {
      setPhase('processing');
      setIsListening(false);
      
      setTimeout(() => {
        setTranscript('나는 책도 좋아해. 책과 관련된 일자리는 없을까?');
        setPhase('complete');
        
        // 2초 후 추천 결과 단계로 이동
        setTimeout(() => {
          setPhase('recommendation');
        }, 2000);
      }, 1500);
    }, 3000);
  };

  const stopListening = () => {
    setIsListening(false);
    setPhase('ready');
    console.log('🎤 음성 인식 중지');
  };

  const resetVoice = () => {
    setPhase('ready');
    setTranscript('');
    setIsListening(false);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, []);

  const getStatusText = () => {
    switch (phase) {
      case 'ready':
        return '편하게 말씀해주세요';
      case 'listening':
        return '편하게 말씀해주세요';
      case 'processing':
        return '처리 중...';
      case 'complete':
        return '일자리를 추천 중';
      case 'recommendation':
        return '재추천 결과입니다!';
      default:
        return '편하게 말씀해주세요';
    }
  };

  const getIconContent = () => {
    if (phase === 'processing' || phase === 'complete') {
      return (
        <div className="loading-spinner">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z">
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>
      );
    }
    
    return (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    );
  };

  return (
    <div className="voice-modal-backdrop" onClick={handleBackdropClick}>
      <div className="voice-modal-container">
        {/* 모달 헤더 */}
        <div className="voice-modal-header">
          <button 
            className="voice-modal-close" 
            onClick={onClose}
            aria-label="음성 모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 음성 입력 메인 영역 */}
        <div className="voice-content">
          {/* 추천 결과 단계가 아닐 때만 마이크 아이콘 영역 표시 */}
          {phase !== 'recommendation' && (
            <div className={`voice-icon-container ${phase}`}>
              <div className="voice-icon">
                {getIconContent()}
              </div>
              {isListening && <div className="pulse-ring"></div>}
              {isListening && <div className="pulse-ring-2"></div>}
            </div>
          )}

          {/* 상태 텍스트 */}
          <div className="voice-status">
            <h2 className="voice-status-title">{getStatusText()}</h2>
            
            {/* 추천 결과 단계일 때 추천 박스 표시 */}
            {phase === 'recommendation' ? (
              <div className="recommendation-box">
                <h3 className="recommendation-job-title">시니어 사서도우미</h3>
                <p className="recommendation-job-description">
                  도서관 이용자 응대, 도서 대여 및 반납 서비스 보조, 도서관 도서 정리 및 환경 정비
                </p>
              </div>
            ) : (
              // 추천 결과 단계가 아닐 때만 transcript 표시
              transcript && (
                <div className="voice-transcript">
                  <p>"{transcript}"</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* 컨트롤 버튼 영역 */}
        <div className="voice-controls">
          {phase === 'ready' && (
            <button className="voice-start-btn" onClick={startListening}>
              여기를 클릭해주세요
            </button>
          )}
          
          {phase === 'listening' && (
            <button className="voice-stop-btn" onClick={stopListening}>
              중지
            </button>
          )}
          
          {(phase === 'processing' || phase === 'complete' || phase === 'recommendation') && (
            <div className="voice-action-buttons">
              <button className="voice-retry-btn" onClick={resetVoice}>
                다시 시도
              </button>
              <button className="voice-close-btn" onClick={onClose}>
                완료
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}