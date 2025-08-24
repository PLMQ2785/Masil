// src/pages/ActivityListPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import BottomNavBar from '../components/BottomNavBar';
import VoiceModal from '../components/VoiceModal';
import './ActivityListPage.css';

export default function ActivityListPage({ session }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const navigate = useNavigate();
  
  // 추천 모드 상태 관리
  const [isRecommendationMode, setIsRecommendationMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState('');
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [recommendedJobs, setRecommendedJobs] = useState([]); // 추천된 소일거리 목록 저장
  
  // 🆕 음성 추천 모드 상태 추가
  const [isVoiceRecommendationMode, setIsVoiceRecommendationMode] = useState(false);
  const [voiceRecommendedJobs, setVoiceRecommendedJobs] = useState([]);
  
  // ✅ 새로운 상태: 툴팁 표시 여부 (초기에만 표시)
  const [showTooltips, setShowTooltips] = useState(true);
  
  // 실제 로그인된 사용자 ID 사용
  const userId = session?.user?.id;

  // 🆕 localStorage 키 정의
  const STORAGE_KEYS = {
    AI_RECOMMENDATION_MODE: 'jobis_ai_recommendation_mode',
    AI_RECOMMENDED_JOBS: 'jobis_ai_recommended_jobs',
    VOICE_RECOMMENDATION_MODE: 'jobis_voice_recommendation_mode',
    VOICE_RECOMMENDED_JOBS: 'jobis_voice_recommended_jobs',
    RECOMMENDATION_COUNT: 'jobis_recommendation_count'
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 🆕 상태 복원 함수
  const restoreState = () => {
    try {
      // AI 추천 상태 복원
      const savedAIMode = localStorage.getItem(STORAGE_KEYS.AI_RECOMMENDATION_MODE);
      const savedAIJobs = localStorage.getItem(STORAGE_KEYS.AI_RECOMMENDED_JOBS);
      const savedRecommendationCount = localStorage.getItem(STORAGE_KEYS.RECOMMENDATION_COUNT);
      
      if (savedAIMode === 'true' && savedAIJobs) {
        const aiJobs = JSON.parse(savedAIJobs);
        setIsRecommendationMode(true);
        setRecommendedJobs(aiJobs);
        setRecommendationCount(parseInt(savedRecommendationCount) || aiJobs.length);
        setSelectedTab('list');
        console.log('✅ AI 추천 상태 복원:', aiJobs.length + '개');
        return; // AI 모드가 활성화되어 있으면 음성 모드 체크하지 않음
      }
      
      // 음성 추천 상태 복원
      const savedVoiceMode = localStorage.getItem(STORAGE_KEYS.VOICE_RECOMMENDATION_MODE);
      const savedVoiceJobs = localStorage.getItem(STORAGE_KEYS.VOICE_RECOMMENDED_JOBS);
      
      if (savedVoiceMode === 'true' && savedVoiceJobs) {
        const voiceJobs = JSON.parse(savedVoiceJobs);
        setIsVoiceRecommendationMode(true);
        setVoiceRecommendedJobs(voiceJobs);
        setSelectedTab('voice');
        console.log('✅ 음성 추천 상태 복원:', voiceJobs.length + '개');
      }
      
    } catch (error) {
      console.error('❌ 상태 복원 실패:', error);
      // 오류 발생 시 localStorage 정리
      clearStoredStates();
    }
  };

  // 🆕 상태 저장 함수들
  const saveAIRecommendationState = (jobs, count) => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_RECOMMENDATION_MODE, 'true');
      localStorage.setItem(STORAGE_KEYS.AI_RECOMMENDED_JOBS, JSON.stringify(jobs));
      localStorage.setItem(STORAGE_KEYS.RECOMMENDATION_COUNT, count.toString());
      // 음성 추천 상태는 제거
      localStorage.removeItem(STORAGE_KEYS.VOICE_RECOMMENDATION_MODE);
      localStorage.removeItem(STORAGE_KEYS.VOICE_RECOMMENDED_JOBS);
      console.log('💾 AI 추천 상태 저장 완료');
    } catch (error) {
      console.error('❌ AI 추천 상태 저장 실패:', error);
    }
  };

  const saveVoiceRecommendationState = (jobs) => {
    try {
      localStorage.setItem(STORAGE_KEYS.VOICE_RECOMMENDATION_MODE, 'true');
      localStorage.setItem(STORAGE_KEYS.VOICE_RECOMMENDED_JOBS, JSON.stringify(jobs));
      // AI 추천 상태는 제거
      localStorage.removeItem(STORAGE_KEYS.AI_RECOMMENDATION_MODE);
      localStorage.removeItem(STORAGE_KEYS.AI_RECOMMENDED_JOBS);
      localStorage.removeItem(STORAGE_KEYS.RECOMMENDATION_COUNT);
      console.log('💾 음성 추천 상태 저장 완료');
    } catch (error) {
      console.error('❌ 음성 추천 상태 저장 실패:', error);
    }
  };

  const clearStoredStates = () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🗑️ 저장된 상태 모두 정리 완료');
    } catch (error) {
      console.error('❌ 상태 정리 실패:', error);
    }
  };

  useEffect(() => {
    // 활동 데이터 로딩 (추후 API 연동)
    const mockActivities = [
      { 
        id: 1, 
        name: '보육시설 지원', 
        lat: 37.5665, 
        lng: 126.9780, 
        type: 'support',
        date: '8월 27일(수)',
        location: '서리마을', 
        duration: '3명',
        time: '09:00 ~ 18:00' 
      },
      { 
        id: 2, 
        name: '독서 모임', 
        lat: 37.5675, 
        lng: 126.9785, 
        type: 'culture',
        date: '8월 28일(목)',
        location: '강남구',
        duration: '5명',
        time: '09:00 ~ 18:00' 
      },
      { 
        id: 3, 
        name: '운동 활동', 
        lat: 37.5655, 
        lng: 126.9775, 
        type: 'exercise',
        date: '8월 29일(금)',
        location: '마포구',
        duration: '10명',
        time: '09:00 ~ 18:00' 
      }
    ];
    
    setTimeout(() => {
      setActivities(mockActivities);
      setLoading(false);
      
      // 🆕 데이터 로딩 완료 후 상태 복원
      restoreState();
    }, 1000);

    // ✅ 새로운 기능: 10초 후 툴팁 자동 숨김
    const tooltipTimer = setTimeout(() => {
      setShowTooltips(false);
    }, 10000); // 10초 후 툴팁 숨김

    return () => {
      clearTimeout(tooltipTimer);
    };
  }, []);

  // 마이크 버튼 클릭 핸들러 - 🆕 토글 기능 추가
  const handleMicClick = () => {
    if (isVoiceRecommendationMode) {
      // 음성 추천 모드 비활성화
      console.log('🎤 음성 추천 모드 비활성화');
      setIsVoiceRecommendationMode(false);
      setVoiceRecommendedJobs([]);
      setSelectedTab('');
      clearStoredStates(); // 저장된 상태 정리
    } else {
      // 음성 추천 모달 열기
      console.log('🎤 마이크 버튼 클릭됨 - 음성 모달 열기');
      setShowVoiceModal(true);
      setSelectedTab('voice');
    }
    // ✅ 버튼 클릭 시 툴팁 숨김
    setShowTooltips(false);
  };

  // 음성 모달 닫기 핸들러
  const handleCloseVoiceModal = () => {
    console.log('🎤 음성 모달 닫기');
    setShowVoiceModal(false);
    // selectedTab은 유지 (음성 추천 모드가 활성화된 경우를 위해)
  };

  // 🆕 음성 추천 완료 핸들러
  const handleVoiceRecommendationComplete = (voiceJobs) => {
    console.log('🎯 음성 추천 완료 - 지도 모드 전환');
    console.log('📊 음성 추천받은 소일거리들:', voiceJobs);
    
    // 음성 추천 모드로 전환
    setIsVoiceRecommendationMode(true);
    setVoiceRecommendedJobs(voiceJobs);
    
    // 기존 추천 모드는 해제
    setIsRecommendationMode(false);
    setRecommendedJobs([]);
    setRecommendationCount(0);
    
    // 탭 상태 설정
    setSelectedTab('voice');
    
    // 🆕 상태 저장
    saveVoiceRecommendationState(voiceJobs);
  };

  // Job있으 버튼 클릭 핸들러 - 🆕 토글 기능 추가
  const handleJobListClick = () => {
    if (!userId) {
      console.error('❌ 사용자 ID가 없습니다. 로그인 상태를 확인해주세요.');
      alert('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    
    if (isRecommendationMode) {
      // AI 추천 모드 비활성화
      console.log('📋 AI 추천 모드 비활성화');
      setIsRecommendationMode(false);
      setRecommendedJobs([]);
      setRecommendationCount(0);
      setSelectedTab('');
      clearStoredStates(); // 저장된 상태 정리
    } else {
      // AI 추천 모드 활성화
      console.log('📋 Job있으 버튼 클릭됨 - AI 추천 모드 활성화');
      console.log('🔍 사용할 사용자 ID:', userId);
      console.log('👤 사용자 정보:', {
        id: session?.user?.id,
        phone: session?.user?.phone,
        email: session?.user?.email,
        nickname: session?.user?.user_metadata?.nickname
      });
      
      // AI 추천 모드로 전환
      setIsRecommendationMode(true);
      
      // 음성 추천 모드 해제
      setIsVoiceRecommendationMode(false);
      setVoiceRecommendedJobs([]);
      
      setSelectedTab('list');
    }
    
    // ✅ 버튼 클릭 시 툴팁 숨김
    setShowTooltips(false);
  };

  // 나의 정보 버튼 클릭 핸들러
  const handleProfileClick = () => {
    console.log('👤 나의 정보 버튼 클릭됨');
    navigate('/my-profile');
    // ✅ 버튼 클릭 시 툴팁 숨김
    setShowTooltips(false);
    // 🆕 상태는 저장된 채로 유지됨 (페이지 이동 시에도 localStorage에 보존)
  };

  // 추천 완료 핸들러 - 🆕 상태 저장 추가
  const handleRecommendationComplete = (count, jobs = []) => {
    setRecommendationCount(count);
    setRecommendedJobs(jobs); // 추천된 소일거리 목록 저장
    console.log(`✅ AI 추천 완료: ${count}개의 소일거리 발견 (사용자 ID: ${userId})`);
    console.log('📊 추천된 소일거리 목록:', jobs);
    
    // 🆕 상태 저장
    saveAIRecommendationState(jobs, count);
  };

  // 음성 모달에 전달할 excludeJobIds 생성
  const getExcludeJobIds = () => {
    return recommendedJobs.map(job => job.job_id);
  };

  // 헤더 제목 결정 로직
  const getHeaderTitle = () => {
    if (isVoiceRecommendationMode) {
      return `🎤 음성 추천 소일거리 (${voiceRecommendedJobs.length}개)`;
    } else if (isRecommendationMode) {
      return `AI 추천 소일거리${recommendationCount > 0 ? ` (${recommendationCount}개)` : ''}`;
    } else {
      return '추천 소일거리 목록';
    }
  };

  // 사용자 정보가 없는 경우 로딩 상태 표시
  if (!session || !userId) {
    return (
      <div className="activity-page-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ fontSize: '48px' }}>👤</div>
          <p style={{ fontSize: '18px', color: '#2C3E50' }}>사용자 정보를 확인하는 중...</p>
          <p style={{ fontSize: '14px', color: '#666' }}>잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-page-container">
      {/* 헤더 */}
      <div className="activity-header">
        <h1 className="activity-title">
          {getHeaderTitle()}
        </h1>
        {(isRecommendationMode || isVoiceRecommendationMode) && (
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            margin: '8px 0 0 0',
            textAlign: 'center'
          }}>
          </p>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="map-container">
        {loading && !isRecommendationMode && !isVoiceRecommendationMode ? (
          <div className="map-loading">
            <div style={{ textAlign: 'center', color: '#2C3E50' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>
                사용자 맞춤 소일거리가 표시됩니다
              </p>
            </div>
          </div>
        ) : (
          <MapComponent 
            activities={activities}
            isRecommendationMode={isRecommendationMode}
            userId={userId}
            onRecommendationComplete={handleRecommendationComplete}
            isVoiceRecommendationMode={isVoiceRecommendationMode}
            voiceRecommendedJobs={voiceRecommendedJobs}
            recommendedJobs={recommendedJobs} // 🆕 AI 추천 소일거리 목록 전달
          />
        )}
      </div>

      {/* ✅ 수정: 하단 네비게이션에 활성화 상태 전달 */}
      <BottomNavBar 
        onMicClick={handleMicClick}
        onJobListClick={handleJobListClick}
        onProfileClick={handleProfileClick}
        initialSelected={selectedTab}
        showTooltips={showTooltips}
        isJobListActive={isRecommendationMode} // 🆕 Job있으 버튼 활성화 상태
        isVoiceActive={isVoiceRecommendationMode} // 🆕 마이크 버튼 활성화 상태
      />

      {/* 음성 모달 */}
      {showVoiceModal && (
        <VoiceModal 
          onClose={handleCloseVoiceModal} 
          excludeJobIds={getExcludeJobIds()}
          userId={userId}
          onVoiceRecommendationComplete={handleVoiceRecommendationComplete}
        />
      )}
    </div>
  );
}