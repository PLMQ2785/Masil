import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // 1. 로딩 상태 추가 (초기값 true)

  useEffect(() => {
    // 2. 최초 세션 확인이 끝나면 로딩 상태를 false로 변경
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false); // 확인 완료
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 3. 로딩 중이라면 로딩 메시지를 표시하고 라우터를 렌더링하지 않음
  if (loading) {
    return <div>애플리케이션 로딩 중...</div>;
  }

  // 4. 로딩이 끝나면 라우터를 렌더링
  return (
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <h1>시니어 소일거리</h1>
          {session && (
            <button onClick={() => supabase.auth.signOut()}>
              로그아웃
            </button>
          )}
        </header>
        <main>
          {/* 2. Routes 부분을 아래 코드로 교체합니다. */}
          <Routes>
            {/* session이 없으면 LoginPage를, 있으면 메인 페이지(/)로 리디렉션 */}
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
    </BrowserRouter>
  );
}

export default App;