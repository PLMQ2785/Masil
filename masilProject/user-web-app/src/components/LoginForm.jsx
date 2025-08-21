/*
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    const processedPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = `+82${processedPhone.startsWith('0') ? processedPhone.substring(1) : processedPhone}`;
    
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      phone: formattedPhone,
      password: password,
    });

    if (error) {
      alert(error.error_description || error.message);
    } else if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        alert('역할 정보 조회 실패: ' + profileError.message);
        // 로그인 자체는 성공했으므로 기본 페이지로 보냅니다.
        navigate('/');
      } else if (profile) {
        if (profile.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>로그인</h2>
      <form onSubmit={handleLogin}>
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
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>
      </form>
    </div>
  );
}*/

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './AuthForms.css';

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    const processedPhone = formData.phone.replace(/[^0-9]/g, '');
    const formattedPhone = `+82${processedPhone.startsWith('0') ? processedPhone.substring(1) : processedPhone}`;
    
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      phone: formattedPhone,
      password: formData.password,
    });

    if (error) {
      alert(error.error_description || error.message);
    } else if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        alert('역할 정보 조회 실패: ' + profileError.message);
        // 로그인 자체는 성공했으므로 추천 활동 목록 페이지로 보냅니다.
        navigate('/activities');
      } else if (profile) {
        if (profile.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/activities');
        }
      }
    }
    setLoading(false);
  };

  const goBack = () => {
    navigate(-1); // React Router의 navigate(-1)을 사용하여 이전 페이지로
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <button className="back-btn" onClick={goBack} type="button">
          ←
        </button>
        <h2 className="auth-title">로그인</h2>
      </div>
      
      <form className="auth-form" onSubmit={handleLogin}>
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
        
        <button 
          type="submit" 
          className="btn-primary-full"
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}