// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';

// 페이지 컴포넌트들
import HomePage from './pages/HomePage';
import SignUpForm from './components/SignUpForm';
import LoginForm from './components/LoginForm';
import ActivityListPage from './pages/ActivityListPage';
import AdminPage from './pages/AdminPage';

// 레이아웃 래퍼 컴포넌트 생성
function AppContent({ user, session, loading }) {
  const location = useLocation();
  
  // ActivityListPage인지 확인
  const isActivityListPage = location.pathname === '/activities';
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={isActivityListPage ? "app-fullscreen" : "App"}>
      <Routes>
        {/* 로그인하지 않은 사용자용 라우트 */}
        {!user ? (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/signup" element={<SignUpForm />} />
            <Route path="/login" element={<LoginForm />} />
            {/* 로그인하지 않은 상태에서 다른 경로 접근 시 홈으로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            {/* 로그인한 사용자용 라우트 - session 정보 전달 */}
            <Route path="/activities" element={<ActivityListPage session={session} />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* 로그인한 상태에서 루트 경로 접근 시 활동 목록으로 리다이렉트 */}
            <Route path="/" element={<Navigate to="/activities" replace />} />
            <Route path="/signup" element={<Navigate to="/activities" replace />} />
            <Route path="/login" element={<Navigate to="/activities" replace />} />
            <Route path="*" element={<Navigate to="/activities" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSession(session);
      setLoading(false);
    });

    // 세션 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <AppContent user={user} session={session} loading={loading} />
    </Router>
  );
}

export default App;