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

// src/components/SignUpForm.jsx

import React, { useState, useEffect } from 'react'; // ✅ 추가: useEffect import
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
    physicalLevel: '',
  });

  const interestOptions = [
    '반려견 산책', '전달·심부름', '장보기 도우미', '가벼운 청소·정리', 
    '사무 도우미', '행사 안내·접수', '매장 보조', '포장·라벨 붙이기'
  ];

  const physicalLevels = ['상', '중', '하'];

  // ✅ 추가: 페이지 진입 시 상단 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // ✅ 추가: 체력 수준 선택 핸들러 (단일 선택)
  const handlePhysicalLevelSelect = (level) => {
    setFormData(prev => ({
      ...prev,
      physicalLevel: level
    }));
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    
    // 비밀번호 확인 검증
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    const processedPhone = formData.phone.replace(/[^0-9]/g, ''); // 숫자만 추출
    // 맨 앞 '0'을 제거하고 +82를 붙입니다.
    const formattedPhone = `+82${processedPhone.startsWith('0') ? processedPhone.substring(1) : processedPhone}`;

    const { error } = await supabase.auth.signUp({
      phone: formattedPhone,
      password: formData.password,
      options: {
        data: {
          nickname: formData.nickname,
          gender: formData.gender,
          birth_date: formData.birthDate,
          residence: formData.residence,
          work_experience: formData.workExperience,
          interests: formData.interests,
          physical_level: formData.physicalLevel, 
        }
      }
    });

    if (error) {
      alert(error.error_description || error.message);
    } else {
      alert('가입이 완료되었습니다! 이제 로그인 해주세요.');
    }
    setLoading(false);
  };

  const handleLogin = () => {
    // 로그인 페이지로 이동하는 로직 (라우터 설정에 따라 수정 필요)
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
        {/* 기본 정보 */}
        <div className="form-section">
          <input
            type="text"
            placeholder="닉네임"
            className="auth-input"
            value={formData.nickname}
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
          
          {/* ✅ 수정: 생년월일 입력 필드 모바일 최적화 */}
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
            placeholder="지역" 
            className="auth-input"
            value={formData.residence}
            required
            onChange={(e) => handleInputChange('residence', e.target.value)}
          />
          
          <textarea
            placeholder="과거 일했던 경험 (선택사항)"
            className="auth-textarea"
            value={formData.workExperience}
            rows="3"
            onChange={(e) => handleInputChange('workExperience', e.target.value)}
          />
        </div>

        <div className="form-section">
          <h3 className="section-title">내가 관심 있는 분야를 선택해주세요!</h3>
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
        </div>

        {/* ✅ 추가: 체력 수준 선택 섹션 */}
        <div className="form-section">
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

        {/* 계정 정보 */}
        <div className="form-section">
          <input
            type="tel"
            placeholder="전화번호 ('-' 제외)" 
            className="auth-input"
            value={formData.phone}
            required
            onChange={(e) => handleInputChange('phone', e.target.value.replace(/[^0-9]/g, ''))}
          />

          
          <input
            type="password"
            placeholder="비밀번호"
            className="auth-input"
            value={formData.password}
            required
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
          
          <input
            type="password"
            placeholder="비밀번호 재확인"
            className="auth-input"
            value={formData.confirmPassword}
            required
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          />
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