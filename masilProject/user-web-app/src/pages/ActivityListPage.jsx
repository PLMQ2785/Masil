// src/pages/ActivityListPage.jsx
import React, { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import BottomNavBar from '../components/BottomNavBar';
import VoiceModal from '../components/VoiceModal';
import './ActivityListPage.css';

export default function ActivityListPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

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
  };

  // 음성 모달 닫기 핸들러
  const handleCloseVoiceModal = () => {
    console.log('🎤 음성 모달 닫기');
    setShowVoiceModal(false);
  };

  return (
    <div className="activity-page-container">
      {/* 헤더 */}
      <div className="activity-header">
        <h1 className="activity-title">추천 활동 목록</h1>
      </div>

      {/* 지도 영역 */}
      <div className="map-container">
        {loading ? (
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
          />
        )}
      </div>

      {/* 하단 네비게이션 */}
      <BottomNavBar 
        onMicClick={handleMicClick}
        initialSelected="" 
      />

      {/* 음성 모달 */}
      {showVoiceModal && (
        <VoiceModal onClose={handleCloseVoiceModal} />
      )}
    </div>
  );
}