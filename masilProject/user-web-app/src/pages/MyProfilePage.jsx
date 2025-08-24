// src/pages/MyProfilePage.jsx - 5060세대 최적화 버전
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 🆕 Supabase 클라이언트 import 추가
import ApiService from '../services/ApiService';
import './MyProfilePage.css';

export default function MyProfilePage({ session }) {
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // 🆕 로그아웃 상태
  const navigate = useNavigate();
  
  const userId = session?.user?.id;
  const userNickname = session?.user?.user_metadata?.nickname || '사용자';

  // 폼 데이터 상태 (SignUpForm.jsx와 동일한 구조)
  const [formData, setFormData] = useState({
    nickname: '',
    gender: '',
    birthDate: '',
    residence: '',
    workExperience: '',
    interests: [],
    dayTimeSchedule: {
      '월': [],
      '화': [],
      '수': [],
      '목': [],
      '금': [],
      '토': [],
      '일': []
    },
    physicalLevel: '',
    insideOutsideLevel: '',
    movingLevel: '',
  });

  const interestOptions = [
    '반려견 산책', '전달·심부름', '장보기 도우미', '가벼운 청소·정리', 
    '사무 도우미', '행사 안내·접수', '매장 보조', '포장·라벨 붙이기'
  ];

  const physicalLevels = ['상', '중', '하'];
  const insideOutsideLevels = ['실내', '실외', '무관'];
  const movingLevels = ['15분', '30분', '60분'];
  const dayOptions = ['월', '화', '수', '목', '금', '토', '일'];
  const timeLevels = ['오전', '오후', '저녁'];

  useEffect(() => {
    if (!userId) {
      setError('사용자 정보를 확인할 수 없습니다.');
      setLoading(false);
      return;
    }
    
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 지원한 소일거리와 프로필 정보를 병렬로 조회
      const [appliedJobsData, profileData] = await Promise.all([
        ApiService.getUserAppliedJobs(userId),
        ApiService.getUserProfile(userId)
      ]);
      
      console.log('✅ 사용자 데이터 조회 성공');
      console.log('📋 지원한 소일거리:', appliedJobsData);
      console.log('👤 프로필 정보:', profileData);
      
      setAppliedJobs(appliedJobsData || []);
      setUserProfile(profileData);
      
      // 프로필 데이터를 폼 데이터로 변환
      if (profileData) {
        convertProfileToFormData(profileData);
      }
      
    } catch (error) {
      console.error('❌ 사용자 데이터 조회 실패:', error);
      setError('사용자 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 백엔드 프로필 데이터를 폼 데이터로 변환
  const convertProfileToFormData = (profile) => {
    try {
      // availability_json 파싱
      let dayTimeSchedule = {
        '월': [], '화': [], '수': [], '목': [], '금': [], '토': [], '일': []
      };
      
      if (profile.availability_json) {
        try {
          // 백엔드에서 객체 또는 JSON 문자열로 올 수 있음
          if (typeof profile.availability_json === 'string') {
            dayTimeSchedule = JSON.parse(profile.availability_json);
          } else if (typeof profile.availability_json === 'object') {
            dayTimeSchedule = profile.availability_json;
          }
        } catch (e) {
          console.warn('⚠️ availability_json 파싱 실패:', e);
        }
      }

      // interests 배열 변환
      let interests = [];
      if (profile.interests) {
        // 백엔드에서 배열로 받는 경우와 문자열로 받는 경우 모두 처리
        if (Array.isArray(profile.interests)) {
          interests = profile.interests;
        } else if (typeof profile.interests === 'string') {
          interests = profile.interests.split(', ').filter(item => item.trim());
        }
      }

      // 체력 수준 변환 (숫자를 문자로)
      const physicalLevelMap = { 1: '하', 2: '중', 3: '상' };
      const physicalLevel = physicalLevelMap[profile.ability_physical] || '';

      // 이동 시간 변환 (분을 문자로)
      const movingLevel = profile.max_travel_time_min ? `${profile.max_travel_time_min}분` : '';

      // 성별 변환 (M/F를 male/female로)
      const gender = profile.gender === 'M' ? 'male' : profile.gender === 'F' ? 'female' : '';

      setFormData({
        nickname: profile.nickname || '',
        gender: gender,
        birthDate: profile.date_of_birth || '',
        residence: profile.home_address || '',
        workExperience: profile.work_history || '',
        interests: interests,
        dayTimeSchedule: dayTimeSchedule,
        physicalLevel: physicalLevel,
        insideOutsideLevel: profile.preferred_environment || '',
        movingLevel: movingLevel,
      });

      console.log('✅ 프로필 데이터 변환 완료:', {
        nickname: profile.nickname,
        interests: interests,
        physicalLevel: physicalLevel,
        movingLevel: movingLevel
      });

    } catch (error) {
      console.error('❌ 프로필 데이터 변환 실패:', error);
    }
  };

  // 폼 데이터를 백엔드 형식으로 변환
  const convertFormDataToProfile = () => {
    const physicalLevelMap = { '하': 1, '중': 2, '상': 3 };
    const genderMap = { 'male': 'M', 'female': 'F' };

    // 백엔드 스키마에 맞는 데이터 구조로 변환
    const profileData = {};
    
    // 선택적 필드들 (값이 있을 때만 포함)
    if (formData.nickname && formData.nickname.trim()) {
      profileData.nickname = formData.nickname.trim();
    }
    
    if (formData.gender && genderMap[formData.gender]) {
      profileData.gender = genderMap[formData.gender];
    }
    
    if (formData.birthDate) {
      profileData.date_of_birth = formData.birthDate;
    }
    
    if (formData.residence && formData.residence.trim()) {
      profileData.home_address = formData.residence.trim();
    }
    
    if (formData.workExperience && formData.workExperience.trim()) {
      profileData.work_history = formData.workExperience.trim();
    }
    
    // interests: List[str] 형태로 전송 (백엔드가 기대하는 형식)
    if (formData.interests && formData.interests.length > 0) {
      profileData.interests = formData.interests; // 문자열 배열
    }
    
    // preferred_jobs: List[str] 형태로 전송 (interests와 동일하게)
    if (formData.interests && formData.interests.length > 0) {
      profileData.preferred_jobs = formData.interests; // 동일한 데이터
    }
    
    // availability_json: Dict[str, Any] 형태로 전송
    if (formData.dayTimeSchedule) {
      profileData.availability_json = formData.dayTimeSchedule; // 객체 그대로 전송
    }
    
    // ability_physical: int (1-3)
    if (formData.physicalLevel && physicalLevelMap[formData.physicalLevel]) {
      profileData.ability_physical = physicalLevelMap[formData.physicalLevel];
    }
    
    // preferred_environment: str with pattern validation
    if (formData.insideOutsideLevel && 
        ['실내', '실외', '무관'].includes(formData.insideOutsideLevel)) {
      profileData.preferred_environment = formData.insideOutsideLevel;
    }
    
    // max_travel_time_min: int
    if (formData.movingLevel) {
      const timeValue = parseInt(formData.movingLevel.replace('분', ''));
      if (!isNaN(timeValue) && timeValue > 0) {
        profileData.max_travel_time_min = timeValue;
      }
    }

    console.log('📤 변환된 프로필 데이터 (백엔드 스키마 맞춤):', profileData);
    
    return profileData;
  };

  // 입력 핸들러들 (SignUpForm.jsx와 동일)
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(item => item !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleDayTimeToggle = (day, timeSlot) => {
    setFormData(prev => ({
      ...prev,
      dayTimeSchedule: {
        ...prev.dayTimeSchedule,
        [day]: prev.dayTimeSchedule[day].includes(timeSlot)
          ? prev.dayTimeSchedule[day].filter(time => time !== timeSlot)
          : [...prev.dayTimeSchedule[day], timeSlot]
      }
    }));
  };

  const handlePhysicalLevelSelect = (level) => {
    setFormData(prev => ({ ...prev, physicalLevel: level }));
  };

  const handleInsideOutsideLevelSelect = (level) => {
    setFormData(prev => ({ ...prev, insideOutsideLevel: level }));
  };

  const handleMovingLevelSelect = (level) => {
    setFormData(prev => ({ ...prev, movingLevel: level }));
  };

  // 수정 모드 시작
  const handleEditClick = () => {
    setIsEditMode(true);
    setProfileError(null);
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setProfileError(null);
    // 원래 프로필 데이터로 복원
    if (userProfile) {
      convertProfileToFormData(userProfile);
    }
  };

  // 프로필 저장
  const handleSaveProfile = async () => {
    try {
      // 유효성 검사
      if (!formData.physicalLevel || !formData.insideOutsideLevel || !formData.movingLevel) {
        setProfileError('체력 수준, 실내/실외 선호, 이동 가능 시간을 모두 선택해주세요.');
        return;
      }

      if (formData.interests.length === 0) {
        setProfileError('할 수 있는 일을 최소 1개 이상 선택해주세요.');
        return;
      }

      if (!formData.nickname || !formData.nickname.trim()) {
        setProfileError('닉네임을 입력해주세요.');
        return;
      }

      if (!formData.gender) {
        setProfileError('성별을 선택해주세요.');
        return;
      }

      setSaving(true);
      setProfileError(null);
      
      const profileData = convertFormDataToProfile();
      console.log('💾 프로필 저장 요청 데이터:', profileData);
      console.log('📊 interests 타입 확인:', typeof profileData.interests, profileData.interests);
      
      const updatedProfile = await ApiService.updateUserProfile(userId, profileData);
      console.log('✅ 프로필 저장 성공:', updatedProfile);
      
      setUserProfile(updatedProfile);
      setIsEditMode(false);
      alert('프로필이 성공적으로 수정되었습니다.');
      
    } catch (error) {
      console.error('❌ 프로필 저장 실패:', error);
      
      // 에러 메시지를 더 자세히 표시
      let errorMessage = '프로필 저장에 실패했습니다.';
      if (error.message.includes('422')) {
        errorMessage = '입력한 정보가 올바르지 않습니다. 모든 필수 항목을 정확히 입력해주세요.';
      } else if (error.message.includes('400')) {
        errorMessage = '수정할 내용이 없거나 잘못된 형식입니다.';
      } else if (error.message.includes('404')) {
        errorMessage = '사용자를 찾을 수 없습니다.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setProfileError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 🆕 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // 확인 대화상자
      const confirmLogout = window.confirm('정말 로그아웃 하시겠습니까?');
      if (!confirmLogout) {
        setIsLoggingOut(false);
        return;
      }
      
      console.log('🚪 로그아웃 시작...');
      
      // 🗑️ localStorage 정리 (저장된 추천 상태들 모두 삭제)
      const STORAGE_KEYS = [
        'jobis_ai_recommendation_mode',
        'jobis_ai_recommended_jobs', 
        'jobis_voice_recommendation_mode',
        'jobis_voice_recommended_jobs',
        'jobis_recommendation_count'
      ];
      
      STORAGE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🗑️ 저장된 추천 상태 모두 정리 완료');
      
      // 🚪 Supabase 로그아웃
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ 로그아웃 실패:', error);
        alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
      } else {
        console.log('✅ 로그아웃 성공');
        // 로그아웃 성공 시 자동으로 App.jsx에서 라우팅 처리됨
        alert('성공적으로 로그아웃되었습니다.');
      }
      
    } catch (error) {
      console.error('❌ 로그아웃 처리 실패:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const formatWage = (wage) => {
    return wage ? `시급 ${wage.toLocaleString()}원` : '급여 협의';
  };

  const formatTime = (startTime, endTime) => {
    if (startTime && endTime) {
      const formatHour = (time) => {
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

  if (!session || !userId) {
    return (
      <div className="profile-page-container">
        <div className="profile-error">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2>로그인 정보 오류</h2>
          <p>사용자 정보를 확인할 수 없습니다.<br />다시 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      {/* 헤더 */}
      <div className="profile-header">
        <button className="profile-back-btn" onClick={goBack}>
          ←
        </button>
        <h1 className="profile-title">나의 정보</h1>
      </div>

      {/* 사용자 정보 섹션 */}
      <div className="profile-user-info">
        <div className="user-avatar">👤</div>
        <h2 className="user-name">{userNickname}님</h2>
        <p className="user-subtitle">지원한 소일거리 목록</p>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="profile-content">
        {/* 내 프로필 정보 섹션 */}
        <div className="profile-info-section">
          <div className="profile-info-header">
            <h3>내 프로필 정보</h3>
            {!isEditMode && (
              <button className="profile-edit-btn" onClick={handleEditClick}>
                ✏️ 수정
              </button>
            )}
          </div>

          {profileLoading ? (
            <div className="profile-loading">
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
              <p>프로필 정보를 불러오는 중...</p>
            </div>
          ) : profileError ? (
            <div className="profile-error-message">
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
              <p>{profileError}</p>
            </div>
          ) : userProfile ? (
            <div className="profile-form-container">
              {isEditMode ? (
                // 수정 모드
                <div className="profile-edit-form">
                  {/* 기본 정보 */}
                  <div className="form-section">
                    <h4 className="section-title">기본 정보</h4>
                    <input
                      type="text"
                      placeholder="닉네임"
                      className="auth-input"
                      value={formData.nickname}
                      onChange={(e) => handleInputChange('nickname', e.target.value)}
                    />
                    
                    <select
                      className="auth-input"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                    >
                      <option value="">성별 선택</option>
                      <option value="male">남성</option>
                      <option value="female">여성</option>
                    </select>
                    
                    <input
                      type="date"
                      className="auth-input"
                      value={formData.birthDate}
                      onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    />
                    
                    <input
                      type="text"
                      placeholder="주소"
                      className="auth-input"
                      value={formData.residence}
                      onChange={(e) => handleInputChange('residence', e.target.value)}
                    />
                  </div>

                  {/* 체력 수준 */}
                  <div className="form-section">
                    <h4 className="section-title">체력 수준</h4>
                    <div className="physical-level-group">
                      {physicalLevels.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`physical-btn ${formData.physicalLevel === level ? 'selected' : ''}`}
                          onClick={() => handlePhysicalLevelSelect(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 실내/실외 선호 */}
                  <div className="form-section">
                    <h4 className="section-title">실내/실외 선호</h4>
                    <div className="inside-outside-level-group">
                      {insideOutsideLevels.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`inside-outside-btn ${formData.insideOutsideLevel === level ? 'selected' : ''}`}
                          onClick={() => handleInsideOutsideLevelSelect(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이동 가능 시간 */}
                  <div className="form-section">
                    <h4 className="section-title">이동 가능 시간</h4>
                    <div className="moving-level-group">
                      {movingLevels.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`moving-btn ${formData.movingLevel === level ? 'selected' : ''}`}
                          onClick={() => handleMovingLevelSelect(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 가능 시간대 */}
                  <div className="form-section">
                    <h4 className="section-title">가능 시간대</h4>
                    <div className="schedule-table">
                      <table className="time-schedule-table">
                        <thead>
                          <tr>
                            <th></th>
                            {dayOptions.map((day) => (
                              <th key={day} className="day-header">{day}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {timeLevels.map((timeSlot) => (
                            <tr key={timeSlot}>
                              <td className="time-label">{timeSlot}</td>
                              {dayOptions.map((day) => (
                                <td key={`${day}-${timeSlot}`} className="time-cell">
                                  <button
                                    type="button"
                                    className={`time-slot-btn ${
                                      formData.dayTimeSchedule[day].includes(timeSlot) ? 'selected' : ''
                                    }`}
                                    onClick={() => handleDayTimeToggle(day, timeSlot)}
                                  >
                                    {formData.dayTimeSchedule[day].includes(timeSlot) ? '✓' : ''}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 할 수 있는 일 */}
                  <div className="form-section">
                    <h4 className="section-title">할 수 있는 일</h4>
                    <div className="interest-grid">
                      {interestOptions.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          className={`interest-btn ${formData.interests.includes(interest) ? 'selected' : ''}`}
                          onClick={() => handleInterestToggle(interest)}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>

                    <textarea
                      placeholder="과거 일했던 경험 (선택사항)"
                      className="auth-textarea"
                      value={formData.workExperience}
                      rows="3"
                      onChange={(e) => handleInputChange('workExperience', e.target.value)}
                    />
                  </div>

                  {/* 수정 모드 버튼들 */}
                  <div className="profile-edit-actions">
                    <button 
                      className="profile-cancel-btn" 
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      취소
                    </button>
                    <button 
                      className="profile-save-btn" 
                      onClick={handleSaveProfile}
                      disabled={saving}
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                // 조회 모드
                <div className="profile-view-form">
                  <div className="profile-info-grid">
                    <div className="profile-info-item">
                      <span className="profile-info-label">닉네임:</span>
                      <span className="profile-info-value">{userProfile.nickname || '정보 없음'}</span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">성별:</span>
                      <span className="profile-info-value">
                        {userProfile.gender === 'M' ? '남성' : userProfile.gender === 'F' ? '여성' : '정보 없음'}
                      </span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">생년월일:</span>
                      <span className="profile-info-value">{userProfile.date_of_birth || '정보 없음'}</span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">주소:</span>
                      <span className="profile-info-value">{userProfile.home_address || '정보 없음'}</span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">체력 수준:</span>
                      <span className="profile-info-value">
                        {userProfile.ability_physical === 3 ? '상' : 
                         userProfile.ability_physical === 2 ? '중' : 
                         userProfile.ability_physical === 1 ? '하' : '정보 없음'}
                      </span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">실내/실외 선호:</span>
                      <span className="profile-info-value">{userProfile.preferred_environment || '정보 없음'}</span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">이동 시간:</span>
                      <span className="profile-info-value">
                        {userProfile.max_travel_time_min ? `${userProfile.max_travel_time_min}분` : '정보 없음'}
                      </span>
                    </div>
                    
                    <div className="profile-info-item">
                      <span className="profile-info-label">할 수 있는 일:</span>
                      <span className="profile-info-value">
                        {Array.isArray(userProfile.interests) 
                          ? userProfile.interests.join(', ') 
                          : userProfile.interests || '정보 없음'}
                      </span>
                    </div>
                    
                    {userProfile.work_history && (
                      <div className="profile-info-item">
                        <span className="profile-info-label">과거 경험:</span>
                        <span className="profile-info-value">{userProfile.work_history}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="profile-empty">
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
              <p>프로필 정보를 불러올 수 없습니다.</p>
            </div>
          )}
        </div>
        
        {/* 지원한 소일거리 섹션 */}
        {loading ? (
          <div className="profile-loading">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p>지원한 소일거리 목록을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="profile-error-message">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p>{error}</p>
            <button className="profile-retry-btn" onClick={fetchUserData}>
              다시 시도
            </button>
          </div>
        ) : appliedJobs.length === 0 ? (
          <div className="profile-empty">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <h3>아직 지원한 소일거리가 없습니다</h3>
            <p>지도에서 관심있는 소일거리에 지원해보세요!</p>
          </div>
        ) : (
          <div className="applied-jobs-list">
            <div className="applied-jobs-header">
              <div className="profile-section-divider"></div>
              <h3>지원한 소일거리 ({appliedJobs.length}개)</h3>
            </div>
            
            {appliedJobs.map((item, index) => {
              // 콘솔 데이터 구조를 보면 jobs 객체가 중첩되어 있음
              const job = item.jobs || item; // jobs 객체가 있으면 사용, 없으면 item 자체 사용
              
              return (
                <div key={item.job_id || job.job_id || index} className="applied-job-card">
                  <div className="job-card-header">
                    <h4 className="job-card-title">{job.title || '제목 없음'}</h4>
                    <span className="job-card-status">지원완료</span>
                  </div>
                  
                  {/* 백엔드 조인 쿼리로 가져온 모든 정보 표시 */}
                  <div className="job-card-info">
                    <div className="job-info-row">
                      <span className="job-info-label">💰 급여:</span>
                      <span className="job-info-value">{formatWage(job.hourly_wage)}</span>
                    </div>
                    
                    <div className="job-info-row">
                      <span className="job-info-label">📍 장소:</span>
                      <span className="job-info-value">{job.place || '장소 정보 없음'}</span>
                    </div>
                    
                    {/* 조인으로 가져온 주소 정보 표시 */}
                    {job.address && (
                      <div className="job-info-row">
                        <span className="job-info-label">🏠 주소:</span>
                        <span className="job-info-value">{job.address}</span>
                      </div>
                    )}
                    
                    {/* 조인으로 가져온 시간 정보 표시 */}
                    <div className="job-info-row">
                      <span className="job-info-label">⏰ 시간:</span>
                      <span className="job-info-value">{formatTime(job.start_time, job.end_time)}</span>
                    </div>
                    
                    {/* 추가 정보들 (있을 경우만 표시) */}
                    {job.participants && (
                      <div className="job-info-row">
                        <span className="job-info-label">👥 인원:</span>
                        <span className="job-info-value">{job.participants}명</span>
                      </div>
                    )}
                    
                    {job.client && (
                      <div className="job-info-row">
                        <span className="job-info-label">🏢 의뢰기관:</span>
                        <span className="job-info-value">{job.client}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 업무 설명 (있을 경우만 표시) */}
                  {job.description && (
                    <div className="job-card-description">
                      <h5>업무내용</h5>
                      <p>{job.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 🆕 로그아웃 버튼 섹션 */}
        <div className="profile-logout-section">
          <div className="profile-section-divider"></div>
          <button 
            className="profile-logout-btn"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <div className="logout-spinner"></div>
                로그아웃 중...
              </>
            ) : (
              <>
                로그아웃
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}