// src/components/VoiceModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../services/ApiService';
import './VoiceModal.css';

export default function VoiceModal({ onClose, excludeJobIds = [], userId, onVoiceRecommendationComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState('ready'); // 'ready', 'recording', 'transcribing', 'processing', 'complete', 'recommendation'
  const [recommendedJob, setRecommendedJob] = useState(null);
  const [recommendedJobs, setRecommendedJobs] = useState([]); // 전체 추천 소일거리 목록 저장
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioDataRef = useRef(null); // 음성 데이터를 저장해서 재사용

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
        
        // 음성 데이터 저장
        audioDataRef.current = audioBlob;
        
        // 먼저 STT 처리
        await processSTT(audioBlob);
      };

      return true;
    } catch (error) {
      console.error('⚠️ 마이크 접근 실패:', error);
      setError('마이크 접근 권한이 필요합니다.');
      return false;
    }
  };

  const startRecording = async () => {
    // 사용자 ID 체크
    if (!userId) {
      setError('사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    setError(null);
    
    const initialized = await initializeMediaRecorder();
    if (!initialized) return;

    setPhase('recording');
    setIsRecording(true);
    setTranscript('');
    
    mediaRecorderRef.current.start();
    console.log('🎤 음성 녹음 시작... (사용자 ID:', userId, ')');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setPhase('transcribing'); // 처리 중 → 텍스트 변환 중으로 변경
      setIsRecording(false);
      
      mediaRecorderRef.current.stop();
      
      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      console.log('🎤 음성 녹음 중지');
    }
  };

  // 🆕 STT만 처리하는 함수
  const processSTT = async (audioBlob) => {
    try {
      console.log('🔤 음성을 텍스트로 변환 중...');
      
      // FormData 생성 (STT용)
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');

      // STT API 호출
      const response = await fetch('https://jobisbe.ngrok.app/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`STT HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ STT 변환 완료:', result);

      // 변환된 텍스트 설정
      const transcribedText = result.text || '음성을 인식하지 못했습니다.';
      setTranscript(transcribedText);
      
      // 잠시 텍스트를 보여준 후 추천 과정 시작
      setTimeout(() => {
        processRecommendation(transcribedText);
      }, 2000); // 2초간 텍스트 표시

    } catch (error) {
      console.error('⚠️ STT 처리 실패:', error);
      setError('음성 인식에 실패했습니다. 다시 시도해주세요.');
      setPhase('ready');
    }
  };

  // 🆕 추천 처리 함수 (기존 processAudioRecording에서 분리)
  const processRecommendation = async (transcribedText) => {
    try {
      console.log('🤖 소일거리 추천 처리 시작... (사용자 ID:', userId, ')');
      setPhase('processing');
      
      // FormData 생성 (추천용)
      const formData = new FormData();
      formData.append('audio_file', audioDataRef.current, 'recording.webm');
      formData.append('user_id', userId); // 동적 사용자 ID 사용
      
      // excludeJobIds가 있다면 추가
      if (excludeJobIds && excludeJobIds.length > 0) {
        formData.append('exclude_ids', excludeJobIds.join(','));
      }

      // 음성 추천 API 호출
      const response = await fetch('https://jobisbe.ngrok.app/api/recommend-voice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ 음성 추천 완료:', result);

      // 추천 결과 처리
      if (result.jobs && result.jobs.length > 0) {
        const topJob = result.jobs[0]; // 첫 번째 추천 일거리
        setRecommendedJob(topJob);
        setRecommendedJobs(result.jobs); // 🆕 전체 추천 소일거리 목록 저장
        setPhase('recommendation');
        // ⚠️ 주의: transcript는 여기서 덮어쓰지 않고 유지합니다
      } else {
        setPhase('complete');
        setError('추천할 수 있는 소일거리를 찾지 못했습니다.');
      }

    } catch (error) {
      console.error('⚠️ 추천 처리 실패:', error);
      setError('소일거리 추천 중 오류가 발생했습니다. 다시 시도해주세요.');
      setPhase('ready');
    }
  };

  const resetVoice = () => {
    setPhase('ready');
    setTranscript('');
    setIsRecording(false);
    setRecommendedJob(null);
    setRecommendedJobs([]); // 🆕 추천 목록도 초기화
    setError(null);
    audioDataRef.current = null;
    
    // 리소스 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // 🆕 완료 버튼 클릭 핸들러 - 추천받은 소일거리들을 지도에 표시
  const handleComplete = () => {
    console.log('🎯 음성 추천 완료 - 추천받은 소일거리들을 지도에 표시');
    console.log('📊 추천받은 소일거리 목록:', recommendedJobs);
    
    // 상위 컴포넌트(ActivityListPage)에 추천 완료 알림
    if (onVoiceRecommendationComplete && recommendedJobs.length > 0) {
      onVoiceRecommendationComplete(recommendedJobs);
    }
    
    // 모달 닫기
    onClose();
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
        return '원하는 조건을 말씀하세요';
      case 'recording':
        return '듣고 있습니다...';
      case 'transcribing':
        return '말씀하신 내용';
      case 'processing':
        return '소일거리 찾는 중...';
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

  // 추천 인사이트 메시지 생성
  const getRecommendationInsight = () => {
    if (!recommendedJob) return null;
    
    const insights = [
      "당신의 관심사와 경험에 기반한 맞춤 추천입니다.",
      "현재 시장에서 수요가 높은 분야의 소일거리입니다.",
      "당신의 스킬과 잘 매치되는 포지션입니다.",
      "성장 가능성이 높은 직무로 추천드립니다."
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
  };

  // 사용자 ID가 없는 경우 에러 표시
  if (!userId) {
    return (
      <div className="voice-modal-backdrop" onClick={handleBackdropClick}>
        <div className="voice-modal-container">
          <div className="voice-modal-header">
            <button 
              className="voice-modal-close" 
              onClick={onClose}
              aria-label="음성 모달 닫기"
            >
              ✕
            </button>
          </div>
          <div className="voice-content">
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#e74c3c'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h2>사용자 정보 오류</h2>
              <p>로그인 정보를 확인할 수 없습니다.<br />다시 로그인해주세요.</p>
              <button 
                className="voice-close-btn" 
                onClick={onClose}
                style={{ marginTop: '20px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-modal-backdrop" onClick={handleBackdropClick}>
      <div className={`voice-modal-container ${phase === 'recommendation' ? 'recommendation-mode' : ''}`}>
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
        <div className={`voice-content ${phase === 'recommendation' ? 'recommendation-mode' : ''}`}>
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
            <h2 className={`voice-status-title ${phase === 'recommendation' ? 'recommendation-title' : ''}`}>
              {phase === 'recommendation' && (
                <div className="recommendation-success-icon">
                  ✓
                </div>
              )}
              {getStatusText()}
            </h2>
            
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
            
            {/* 🆕 추천 결과 단계일 때 구조 변경 */}
            {phase === 'recommendation' && recommendedJob ? (
              <div className="recommendation-result-container">
                {/* 1️⃣ 먼저 변환된 텍스트 표시 */}
                {transcript && (
                  <div className="voice-transcript recommendation-transcript">
                    <p>"{transcript}"</p>
                  </div>
                )}
                
                {/* 2️⃣ 그 다음 추천 일거리 정보 표시 */}
                <div className="recommendation-box">
                  <h3 className="recommendation-job-title">{recommendedJob.title}</h3>
                  <p className="recommendation-job-description">
                    {recommendedJob.reason || '상세 내용은 지도에서 확인하실 수 있습니다.'}
                  </p>
                </div>
              </div>
            ) : (
              // 기존 로직: transcribing, processing 단계에서만 텍스트 표시
              transcript && (phase === 'transcribing' || phase === 'processing') && (
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
              누르고 말씀해주세요
            </button>
          )}
          
          {phase === 'recording' && (
            <button className="voice-stop-btn" onClick={stopRecording}>
              누르고 종료해주세요
            </button>
          )}
          
          {(phase === 'transcribing' || phase === 'processing' || phase === 'complete' || phase === 'recommendation') && (
            <div className="voice-action-buttons">
              <button className="voice-retry-btn" onClick={resetVoice}>
                다시 시도
              </button>
              <button 
                className="voice-close-btn" 
                onClick={phase === 'recommendation' ? handleComplete : onClose}
              >
                지도에서 확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}