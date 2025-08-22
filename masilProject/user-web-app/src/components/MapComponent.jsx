/* 최초 버전
import React, { useEffect, useState } from 'react';

export default function MapComponent() {
  const [opportunities, setOpportunities] = useState([]);

  useEffect(() => {
    if (window.naver && window.naver.maps) {
      const mapOptions = {
        center: new window.naver.maps.LatLng(37.5665, 126.9780),
        zoom: 12,
      };
      const map = new window.naver.maps.Map('map', mapOptions);
      fetchOpportunitiesAndDrawMarkers(map);
    } else {
      console.error("네이버 지도 API가 로드되지 않았습니다.");
    }
  }, []);

  const fetchOpportunitiesAndDrawMarkers = async (map) => {
    try {
      const response = await fetch('http://localhost:8000/api/opportunities');
      const data = await response.json();
      setOpportunities(data);

      console.log('✅ 지도 데이터 로딩 성공:', data);

      data.forEach((op) => {
        const markerPosition = new window.naver.maps.LatLng(op.latitude, op.longitude);
        
        const marker = new window.naver.maps.Marker({
          position: markerPosition,
          map: map,
        });

        const infowindow = new window.naver.maps.InfoWindow({
            content: `<div style="padding:10px;border:1px solid black;font-size:12px;">${op.title}</div>`
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infowindow.getMap()) {
            infowindow.close();
          } else {
            infowindow.open(map, marker);
          }
        });
      });

    } catch (error) {
      console.error('❌ 지도 데이터 로딩 실패:', error);
    }
  };

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '70vh' }}></div>
    </div>
  );
}
  */


// src/components/MapComponent.jsx
import React, { useEffect, useState, useRef } from 'react';
import ApiService from '../services/ApiService';
import JobDetailModal from './JobDetailModal';

export default function MapComponent({ isRecommendationMode = false, userId = null, onRecommendationComplete = null }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [naverMap, setNaverMap] = useState(null);
  const markersRef = useRef([]);

  // 📍 사용자 위치 획득
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            setUserLocation(location);
            console.log('📍 사용자 위치 획득 성공:', location);
          },
          (error) => {
            console.warn('⚠️ 사용자 위치 획득 실패, 기본 위치 사용:', error);
            // 기본 위치: 서울시청
            setUserLocation({ latitude: 37.5665, longitude: 126.9780 });
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        console.warn('⚠️ Geolocation 미지원, 기본 위치 사용');
        setUserLocation({ latitude: 37.5665, longitude: 126.9780 });
      }
    };

    getUserLocation();
  }, []);

  // 🗺️ 네이버 지도 초기화
  useEffect(() => {
    const initializeMap = () => {
      if (window.naver && window.naver.maps && mapRef.current && userLocation) {
        try {
          console.log('🗺️ 네이버 지도 초기화 시작 - 사용자 위치:', userLocation);
          
          const mapOptions = {
            center: new window.naver.maps.LatLng(userLocation.latitude, userLocation.longitude),
            zoom: 13,
            mapTypeControl: false,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: true,
            zoomControlOptions: {
              position: window.naver.maps.Position.TOP_RIGHT
            }
          };
          
          const map = new window.naver.maps.Map(mapRef.current, mapOptions);
          
          // 사용자 위치 마커 추가 (블루 도트)
          new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(userLocation.latitude, userLocation.longitude),
            map: map,
            icon: {
              content: `
                <div style="
                  background: #3b82f6;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  border: 3px solid white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>
              `,
              anchor: new window.naver.maps.Point(10, 10)
            },
            title: '현재 위치'
          });
          
          setNaverMap(map);
          setMapLoaded(true);
          
          console.log('✅ 네이버 지도 초기화 성공');
          
        } catch (error) {
          console.error('❌ 네이버 지도 초기화 실패:', error);
          setError('지도를 불러올 수 없습니다.');
        }
      } else {
        console.log('⏳ 네이버 지도 API 또는 사용자 위치 대기 중...');
        setTimeout(initializeMap, 500);
      }
    };

    if (userLocation) {
      const timer = setTimeout(initializeMap, 100);
      return () => clearTimeout(timer);
    }
  }, [userLocation]);

  // 📊 일거리 데이터 조회
  useEffect(() => {
    const fetchJobs = async () => {
      if (!mapLoaded || !naverMap || !userLocation) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        let jobsData;
        
        if (isRecommendationMode && userId) {
          // 🤖 추천 모드: AI 추천 API 호출
          console.log('🤖 AI 추천 일거리 데이터 조회 시작 - 사용자 ID:', userId);
          
          const recommendationResult = await ApiService.getRecommendedJobs(userId);
          jobsData = recommendationResult.jobs || [];
          
          console.log('✅ AI 추천 일거리 데이터 조회 완료:', jobsData.length + '개');
          
          // 상위 컴포넌트에 추천 완료 알림 (jobs 데이터도 함께 전달)
          if (onRecommendationComplete) {
            onRecommendationComplete(jobsData.length, jobsData);
          }
        } else {
          // 🗺️ 일반 모드: 기본 지도 데이터 조회
          console.log('📊 일반 모드 일거리 데이터 조회 시작');
          jobsData = await ApiService.getJobsForMap();
          console.log('✅ 일거리 데이터 조회 완료:', jobsData.length + '개');
        }
        
        setJobs(jobsData);
        createMarkersOnMap(jobsData);
        
      } catch (error) {
        console.error('❌ 일거리 데이터 조회 실패:', error);
        setError('일거리 정보를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [mapLoaded, naverMap, userLocation, isRecommendationMode, userId]);

  // 🎯 지도에 핀 마커 생성
  const createMarkersOnMap = (jobsData) => {
    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    jobsData.forEach((job) => {
      const markerPosition = new window.naver.maps.LatLng(job.job_latitude, job.job_longitude);
      
      // 추천 모드일 때는 빨간색, 일반 모드일 때는 녹색
      const markerColor = isRecommendationMode ? '#ff0000ff' : 'rgba(8, 0, 255, 1)';
      
      /*
      const marker = new window.naver.maps.Marker({
        position: markerPosition,
        map: naverMap,
        title: job.title,
        icon: {
          content: `
            <div style="
              position: relative;
              cursor: pointer;
              transition: all 0.3s ease;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
              <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- 핀 드롭 섀도우 -->
                <ellipse cx="20" cy="47" rx="8" ry="3" fill="rgba(1, 7, 13, 0.2)"/>
                
                <!-- 메인 핀 모양 -->
                <path d="M20 2C11.163 2 4 9.163 4 18c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" 
                      fill="${markerColor}" 
                      stroke="white" 
                      stroke-width="2"/>
                
                <!-- 중앙 원 -->
                <circle cx="20" cy="18" r="8" fill="white"/>
                <circle cx="20" cy="18" r="5" fill="#2C3E50"/>
                
                <!-- 하이라이트 효과 -->
                <ellipse cx="17" cy="15" rx="2" ry="3" fill="rgba(255, 255, 255, 0.3)"/>
              </svg>
            </div>
          `,
          anchor: new window.naver.maps.Point(20, 50)
        }
      });*/

      const marker = new window.naver.maps.Marker({
    position: markerPosition,
    map: naverMap,
    title: job.title,
    icon: {
        content: `
            <div style="
                position: relative;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                <svg width="60" height="75" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="20" cy="47" rx="8" ry="3" fill="rgba(1, 7, 13, 0.2)"/>
                    
                    <path d="M20 2C11.163 2 4 9.163 4 18c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" 
                          fill="${markerColor}" 
                          stroke="white" 
                          stroke-width="2"/>
                    
                    <circle cx="20" cy="18" r="12" fill="white"/>
                    <circle cx="20" cy="18" r="10.5" fill="#2C3E50"/>
                    
                    <ellipse cx="17" cy="15" rx="2" ry="3" fill="rgba(255, 255, 255, 0.3)"/>
                </svg>
            </div>
        `,
        anchor: new window.naver.maps.Point(30, 75) // 마커의 크기에 맞춰 anchor 위치 조정
    }
});

      // 🔍 마커 클릭 이벤트 - 상세정보 조회 및 모달 표시
      window.naver.maps.Event.addListener(marker, 'click', async () => {
        try {
          console.log(`🔍 일거리 ${job.job_id} 상세정보 조회 시작`);
          
          const jobDetail = await ApiService.getJobById(job.job_id);
          
          // 추천 모드인 경우 reason 추가
          if (isRecommendationMode && job.reason) {
            jobDetail.reason = job.reason;
          }
          
          setSelectedJob(jobDetail);
          setShowModal(true);

          console.log('✅ 상세정보 조회 완료');

        } catch (error) {
          console.error('❌ 상세정보 조회 실패:', error);
          setError('상세정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
          
          // 에러 메시지 자동 제거
          setTimeout(() => {
            setError(null);
          }, 3000);
        }
      });

      markersRef.current.push(marker);
    });
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedJob(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 🗺️ 지도 컨테이너 */}
      <div 
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          display: 'block'
        }}
      />
      
      {/* 📊 로딩 상태 표시 */}
      {(isLoading || !mapLoaded || !userLocation) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(248, 249, 250, 0.98)',
          color: '#2C3E50',
          fontSize: '18px',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: '600',
          zIndex: 10
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {isRecommendationMode ? '🤖' : '🗺️'}
            </div>
            <div style={{ marginBottom: '8px' }}>
              {!userLocation ? '위치 정보를 가져오는 중...' : 
               !mapLoaded ? '지도를 불러오는 중...' : 
               isRecommendationMode ? 'AI 추천 일거리를 찾는 중...' : '주변 일거리를 찾는 중...'}
            </div>
            <div style={{ fontSize: '16px', color: '#5A6C7D' }}>잠시만 기다려주세요</div>
          </div>
        </div>
      )}
      
      {/* ❌ 에러 상태 표시 */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          padding: '16px 20px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          fontSize: '16px',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: '600',
          zIndex: 15,
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 📋 상세정보 모달 */}
      <JobDetailModal 
        job={selectedJob}
        isVisible={showModal}
        onClose={handleCloseModal}
        showRecommendationReason={isRecommendationMode}
      />
    </div>
  );
}