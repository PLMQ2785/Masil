/*
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import MapComponent from '../components/MapComponent';

export default function HomePage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 이 페이지에 들어왔을 때, 현재 세션 정보를 가져옵니다.
    // ProtectedRoute를 통과했으므로 세션은 반드시 존재합니다.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []); // 컴포넌트가 처음 마운트될 때 한 번만 실행

  // 세션 정보가 아직 로딩 중일 때 로딩 메시지를 보여줍니다.
  if (!session) {
    return <p>사용자 정보를 불러오는 중...</p>;
  }

  // 세션 정보 로딩이 완료되면 실제 내용을 보여줍니다.
  return (
    <div>
      <p>환영합니다, {session.user.phone}!</p>
      <MapComponent />
    </div>
  );
}
*/
/*
// src/pages/HomePage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="splash-container">
      <div className="logo-section">
        <div className="logo-container">
          <img src="/greenplum.gif" alt="로고" className="logo-image" />
        </div>
        <h1 className="app-title">프로젝트명</h1>
        <p className="app-subtitle">프로젝트 부제</p>
      </div>
      
      <div className="button-section">
        <button className="btn-outline" onClick={handleSignUp}>
          회원가입
        </button>
        <button className="btn-primary" onClick={handleLogin}>
          로그인
        </button>
      </div>
    </div>
  );
};

export default HomePage;*/

// src/pages/HomePage.jsx

import React, { useEffect } from 'react'; // ✅ 추가: useEffect import
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  // ✅ 추가: 페이지 진입 시 상단 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="homepage-container page-container">
      <div className="logo-section">
        <img src="/Job있으.png" alt="로고" className="logo-image" />
      </div>
      
      
      
      <div className="button-section">
        <button 
          className="signup-btn btn-secondary"
          onClick={handleSignUp}
        >
          회원가입
        </button>
        <button 
          className="login-btn btn-primary"
          onClick={handleLogin}
        >
          로그인
        </button>
      </div>
    </div>
  );
};

export default HomePage;