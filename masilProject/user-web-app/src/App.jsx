import React, { useState, useEffect } from 'react';
// useNavigate를 import 목록에 추가합니다.
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

// App 컴포넌트 분리 (useNavigate를 사용하기 위함)
function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // useNavigate 훅 초기화

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 로그아웃을 처리하고 페이지를 이동시키는 함수
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('session_id'); // 동시 로그인 방지용 ID도 삭제
    navigate('/login'); // 로그인 페이지로 이동
  };

  if (loading) {
    return <div>애플리케이션 로딩 중...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>시니어 소일거리</h1>
        {session && (
          // onClick 이벤트에 새로운 handleLogout 함수를 연결
          <button onClick={handleLogout}>
            로그아웃
          </button>
        )}
      </header>
      <main>
        <Routes>
          <Route 
            path="/login" 
            element={!session ? <LoginPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute session={session}>
                  <HomePage />
              </ProtectedRoute>
          } />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute session={session} adminOnly={true}>
                  <AdminPage />
              </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

// 최종 App 컴포넌트
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}