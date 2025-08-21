// src/components/VoiceModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../services/ApiService';
import './VoiceModal.css';

export default function VoiceModal({ onClose, excludeJobIds = [] }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState('ready'); // 'ready', 'recording', 'processing', 'complete', 'recommendation'
  const [recommendedJob, setRecommendedJob] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

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

  const initializeMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus' 
        });
        
        await processAudioRecording(audioBlob);
      };

      return true;
    } catch (error) {
      console.error('❌ 마이크 접근 실패:', error);
      setError('마이크 접근 권한이 필요합니다.');
      return false;
    }
  };

  const startRecording = async () => {
    setError(null);
    
    const initialized = await initializeMediaRecorder();
    if (!initialized) return;

    setPhase('recording');
    setIsRecording(true);
    setTranscript('');
    
    mediaRecorderRef.current.start();
    console.log('🎤 음성 녹음 시작...');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setPhase('processing');
      setIsRecording(false);
      
      mediaRecorderRef.current.stop();
      
      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      console.log('🎤 음성 녹음 중지');
    }
  };

  const processAudioRecording = async (audioBlob) => {
    try {
      console.log('📤 음성 데이터 처리 시작...');
      
      // FormData 생성
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      formData.append('user_id', 'f97c17bf-c304-48df-aa54-d77fa23f96ee'); // 임시 사용자 ID
      
      // excludeJobIds가 있다면 추가
      if (excludeJobIds && excludeJobIds.length > 0) {
        formData.append('exclude_ids', excludeJobIds.join(','));
      }

      // API 호출
      const response = await fetch('https://jobisbe.ngrok.app/api/recommend-voice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ 음성 처리 완료:', result);

      // 음성 인식 결과 설정
      if (result.jobs && result.jobs.length > 0) {
        const topJob = result.jobs[0]; // 첫 번째 추천 일자리
        setRecommendedJob(topJob);
        setTranscript(result.query || '음성 인식이 완료되었습니다.');
        setPhase('recommendation');
      } else {
        setTranscript(result.query || '음성 인식이 완료되었습니다.');
        setPhase('complete');
        setError('추천할 수 있는 일자리를 찾지 못했습니다.');
      }

    } catch (error) {
      console.error('❌ 음성 처리 실패:', error);
      setError('음성 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setPhase('ready');
    }
  };

  const resetVoice = () => {
    setPhase('ready');
    setTranscript('');
    setIsRecording(false);
    setRecommendedJob(null);
    setError(null);
    
    // 리소스 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      
      // 컴포넌트 언마운트 시 리소스 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getStatusText = () => {
    switch (phase) {
      case 'ready':
        return '편하게 말씀해주세요';
      case 'recording':
        return '듣고 있습니다...';
      case 'processing':
        return '처리 중...';
      case 'complete':
        return '음성 인식 완료';
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
              {isRecording && <div className="pulse-ring"></div>}
              {isRecording && <div className="pulse-ring-2"></div>}
            </div>
          )}

          {/* 상태 텍스트 */}
          <div className="voice-status">
            <h2 className="voice-status-title">{getStatusText()}</h2>
            
            {/* 에러 메시지 표시 */}
            {error && (
              <div style={{
                color: '#e74c3c',
                fontSize: '16px',
                marginTop: '16px',
                textAlign: 'center',
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}
            
            {/* 추천 결과 단계일 때 추천 박스 표시 */}
            {phase === 'recommendation' && recommendedJob ? (
              <div className="recommendation-box">
                <h3 className="recommendation-job-title">{recommendedJob.title}</h3>
                <p className="recommendation-job-description">
                  {recommendedJob.description || '상세 내용은 지도에서 확인하실 수 있습니다.'}
                </p>
              </div>
            ) : (
              // 음성 인식 결과 표시
              transcript && phase !== 'recommendation' && (
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
            <button className="voice-start-btn" onClick={startRecording}>
              여기를 클릭해주세요
            </button>
          )}
          
          {phase === 'recording' && (
            <button className="voice-stop-btn" onClick={stopRecording}>
              여기를 눌러 종료
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