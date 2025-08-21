// src/components/SignUpForm.jsx - 초기버전

/*
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function SignUpForm() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (event) => {
    event.preventDefault();
    setLoading(true);

    const processedPhone = phone.replace(/[^0-9]/g, ''); // 숫자만 추출
    // 맨 앞 '0'을 제거하고 +82를 붙입니다.
    const formattedPhone = `+82${processedPhone.startsWith('0') ? processedPhone.substring(1) : processedPhone}`;

    const { error } = await supabase.auth.signUp({
      phone: formattedPhone,
      password: password,
    });

    if (error) {
      alert(error.error_description || error.message);
    } else {
      alert('가입이 완료되었습니다! 이제 로그인 해주세요.');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>회원가입</h2>
      <form onSubmit={handleSignUp}>
        <div>
          <input
            type="tel"
            placeholder="전화번호 ('-' 제외)"
            value={phone}
            required
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <button type="submit" disabled={loading}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </div>
      </form>
    </div>
  );
}*/

// src/components/SignUpForm.jsx - 수정버전
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './AuthForms.css';

export default function SignUpForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    gender: '',
    birthDate: '',
    residence: '',
    workExperience: '',
    phone: '',
    password: '',
    confirmPassword: '',
    interests: [],
    // 요일별 시간대 선택을 위한 객체 구조
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

  const dayOptions = ['월', '화', '수', '목', '금', '토', '일'];
  const timeLevels = ['오전', '오후', '저녁'];

  const physicalLevels = ['상', '중', '하'];
  const insideOutsideLevels = ['실내', '실외', '무관'];
  const movingLevels = ['15분', '30분', '60분'];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 입력 필드별 글자 수 제한 설정
  const inputLimits = {
    phone: 11,        // 전화번호 (010-0000-0000 형식, 하이픈 제외하면 11자리)
    password: 20,     // 비밀번호
    confirmPassword: 20, // 비밀번호 재확인
    nickname: 10,     // 닉네임
    residence: 100,   // 주소
    workExperience: 100 // 과거 경험
  };

  const handleInputChange = (field, value) => {
    // 글자 수 제한 체크
    if (inputLimits[field] && value.length > inputLimits[field]) {
      return; // 제한을 초과하면 업데이트하지 않음
    }
    
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

  // 요일별 시간대 토글 핸들러
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
    setFormData(prev => ({
      ...prev,
      physicalLevel: level
    }));
  };

  const handleInsideOutsideLevelSelect = (level) => {
    setFormData(prev => ({
      ...prev,
      insideOutsideLevel: level
    }));
  };

  const handleMovingLevelSelect = (level) => {
    setFormData(prev => ({
      ...prev,
      movingLevel: level
    }));
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 필수 필드 검증
    if (!formData.physicalLevel || !formData.insideOutsideLevel || !formData.movingLevel) {
      alert('체력 수준, 실내/실외 선호, 이동 가능 시간을 모두 선택해주세요.');
      return;
    }

    if (formData.interests.length === 0) {
      alert('할 수 있는 일을 최소 1개 이상 선택해주세요.');
      return;
    }

    setLoading(true);

    // 전화번호 포맷팅 (백엔드 코드 참고)
    const processedPhone = formData.phone.replace(/[^0-9]/g, '');
    const formattedPhone = `+82${processedPhone.startsWith('0') ? processedPhone.substring(1) : processedPhone}`;

    // 디버깅을 위한 콘솔 로그
    console.log('전송할 데이터:', {
      nickname: formData.nickname,
      gender: formData.gender === 'male' ? 'M' : 'F',
      date_of_birth: formData.birthDate,
      home_address: formData.residence,
      preferred_jobs: formData.interests,
      interests: formData.interests,
      availability_json: formData.dayTimeSchedule,
      work_history: formData.workExperience,
      ability_physical: formData.physicalLevel === '상' ? 3 : formData.physicalLevel === '중' ? 2 : 1,
      preferred_environment: formData.insideOutsideLevel,
      max_travel_time_min: parseInt(formData.movingLevel.replace('분', ''))
    });

    // DB 구조에 맞게 데이터 매핑
    const profileData = {
      // 기본 정보
      nickname: formData.nickname,
      gender: formData.gender === 'male' ? 'M' : 'F', // DB는 M/F로 저장
      date_of_birth: formData.birthDate,
      home_address: formData.residence,
      
      // 선호도 및 능력 정보 (문자열로 변환하여 전달)
      preferred_jobs: formData.interests.join(', '), // 배열을 콤마로 구분된 문자열로 변환
      interests: formData.interests.join(', '), // 배열을 콤마로 구분된 문자열로 변환
      
      // 가용성 정보 (JSON 문자열로 변환하여 전달)
      availability_json: JSON.stringify(formData.dayTimeSchedule),
      
      // 업무 이력
      work_history: formData.workExperience || '', // 빈 문자열로 기본값 설정
      
      // 능력 레벨 정보 (int2 타입에 맞게 숫자로 변환)
      ability_physical: formData.physicalLevel === '상' ? 3 : formData.physicalLevel === '중' ? 2 : 1,
      
      // 선호 환경 (text로 저장)
      preferred_environment: formData.insideOutsideLevel,
      
      // 최대 이동 시간 (분 단위로 변환하여 int2로 저장)
      max_travel_time_min: parseInt(formData.movingLevel.replace('분', ''))
    };

    // supabase.auth.signUp 호출 시 options.data에 추가 정보를 담아 전달
    const { error } = await supabase.auth.signUp({
      phone: formattedPhone,
      password: formData.password,
      options: {
        data: profileData
      }
    });

    if (error) {
      alert(error.error_description || error.message);
    } else {
      // 가입 성공 시 자동 로그인을 막기 위해 즉시 로그아웃 (백엔드 코드 참고)
      await supabase.auth.signOut();
      alert('가입이 완료되었습니다! 이제 로그인 해주세요.');
    }
    setLoading(false);
  };

  const handleLogin = () => {
    window.location.href = '/login';
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <button className="back-btn" onClick={goBack} type="button">
          ←
        </button>
        <h2 className="auth-title">회원가입</h2>
      </div>
      
      <form className="auth-form signup-form" onSubmit={handleSignUp}>
        
        <div className="form-section">
          <h2 className="section-title">계정 정보</h2>
          <input
            type="tel"
            placeholder="전화번호 ('-' 제외)" 
            className="auth-input"
            value={formData.phone}
            maxLength={inputLimits.phone}
            required
            onChange={(e) => handleInputChange('phone', e.target.value.replace(/[^0-9]/g, ''))}
          />

          
          <input
            type="password"
            placeholder="비밀번호"
            className="auth-input"
            value={formData.password}
            maxLength={inputLimits.password}
            required
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
          
          <input
            type="password"
            placeholder="비밀번호 재확인"
            className="auth-input"
            value={formData.confirmPassword}
            maxLength={inputLimits.confirmPassword}
            required
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          />
        </div>
        
        <div className="section-divider"></div>

        <div className="form-section">
          <h2 className="section-title">기본 정보</h2>
          <input
            type="text"
            placeholder="닉네임"
            className="auth-input"
            value={formData.nickname}
            maxLength={inputLimits.nickname}
            required
            onChange={(e) => handleInputChange('nickname', e.target.value)}
          />
          
          <select
            className="auth-input"
            value={formData.gender}
            required
            onChange={(e) => handleInputChange('gender', e.target.value)}
          >
            <option value="">성별 선택</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
          
          <div className="date-input-wrapper">
            <input
              type="date"
              placeholder="연도-월-일"
              className="auth-input date-input"
              value={formData.birthDate}
              required
              onChange={(e) => handleInputChange('birthDate', e.target.value)}
            />
            <label className="date-label">생년월일을 선택해주세요</label>
          </div>
          
          <input
            type="text"
            placeholder="예시)서울특별시 중구 태평로1가 31" 
            className="auth-input"
            value={formData.residence}
            required
            onChange={(e) => handleInputChange('residence', e.target.value)}
          />
        </div>

        <div className="section-divider"></div>

        <div className="form-section">
          <h2 className="section-title">1단계 - 기본 설정</h2>
          <h3 className="section-title">체력 수준</h3>
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

        <div className="form-section">
          <h3 className="section-title">실내/실외 선호</h3>
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

        <div className="form-section">
          <h3 className="section-title">이동 가능 시간</h3>
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

        <div className="section-divider"></div>

        <div className="form-section">
          <h2 className="section-title">2단계 - 가능 시간</h2>

          {/* 표 형식의 요일별 시간대 선택 */}
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

        <div className="section-divider"></div>

        <div className="form-section">
          <h2 className="section-title">3단계 - 내가 할 수 있는 일</h2>
          <p className="section-subtitle">복수 선택 가능</p>

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
            maxLength={inputLimits.workExperience}
            rows="3"
            onChange={(e) => handleInputChange('workExperience', e.target.value)}
          />
          <div className="input-counter">{formData.workExperience.length}/{inputLimits.workExperience}</div>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="btn-outline-small"
            onClick={handleLogin}
            disabled={loading}
          >
            로그인
          </button>
          <button 
            type="submit" 
            className="btn-primary-small"
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </div>
      </form>
    </div>
  );
}