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
  const [recommendedJobs, setRecommendedJobs] = useState([]); // 추천된 일자리 목록 저장
  
  // 실제 로그인된 사용자 ID 사용
  const userId = session?.user?.id;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
    }, 1000);
  }, []);

  // 마이크 버튼 클릭 핸들러
  const handleMicClick = () => {
    console.log('🎤 마이크 버튼 클릭됨');
    setShowVoiceModal(true);
    setSelectedTab('voice');
  };

  // 음성 모달 닫기 핸들러
  const handleCloseVoiceModal = () => {
    console.log('🎤 음성 모달 닫기');
    setShowVoiceModal(false);
    setSelectedTab('');
  };

  // Job있으 버튼 클릭 핸들러
  const handleJobListClick = () => {
    if (!userId) {
      console.error('❌ 사용자 ID가 없습니다. 로그인 상태를 확인해주세요.');
      alert('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    
    console.log('📋 Job있으 버튼 클릭됨 - AI 추천 모드 활성화');
    console.log('🔍 사용할 사용자 ID:', userId);
    console.log('👤 사용자 정보:', {
      id: session?.user?.id,
      phone: session?.user?.phone,
      email: session?.user?.email,
      nickname: session?.user?.user_metadata?.nickname
    });
    
    setIsRecommendationMode(true);
    setSelectedTab('list');
  };

  // 나의 정보 버튼 클릭 핸들러
  const handleProfileClick = () => {
    console.log('👤 나의 정보 버튼 클릭됨');
    navigate('/my-profile');
  };

  // 추천 완료 핸들러
  const handleRecommendationComplete = (count, jobs = []) => {
    setRecommendationCount(count);
    setRecommendedJobs(jobs); // 추천된 일자리 목록 저장
    console.log(`✅ AI 추천 완료: ${count}개의 일거리 발견 (사용자 ID: ${userId})`);
    console.log('📊 추천된 일자리 목록:', jobs);
  };

  // 음성 모달에 전달할 excludeJobIds 생성
  const getExcludeJobIds = () => {
    return recommendedJobs.map(job => job.job_id);
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
          {isRecommendationMode 
            ? `AI 추천 일거리${recommendationCount > 0 ? ` (${recommendationCount}개)` : ''}` 
            : '추천 활동 목록'
          }
        </h1>
        {isRecommendationMode && (
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            margin: '8px 0 0 0',
            textAlign: 'center'
          }}>
            🤖 {session?.user?.user_metadata?.nickname || '사용자'}님 맞춤 추천 결과입니다
          </p>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="map-container">
        {loading && !isRecommendationMode ? (
          <div className="map-loading">
            <div style={{ textAlign: 'center', color: '#2C3E50' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
              <p style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>
                사용자 맞춤 활동이 표시됩니다
              </p>
            </div>
          </div>
        ) : (
          <MapComponent 
            activities={activities}
            isRecommendationMode={isRecommendationMode}
            userId={userId}
            onRecommendationComplete={handleRecommendationComplete}
          />
        )}
      </div>

      {/* 하단 네비게이션 */}
      <BottomNavBar 
        onMicClick={handleMicClick}
        onJobListClick={handleJobListClick}
        onProfileClick={handleProfileClick}
        initialSelected={selectedTab} 
      />

      {/* 음성 모달 */}
      {showVoiceModal && (
        <VoiceModal 
          onClose={handleCloseVoiceModal} 
          excludeJobIds={getExcludeJobIds()}
          userId={userId}
        />
      )}
    </div>
  );
}