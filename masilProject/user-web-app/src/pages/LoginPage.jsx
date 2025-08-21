import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import LoginForm from '../components/LoginForm';
import SignUpForm from '../components/SignUpForm';

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 세션 확인
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    checkSession();

    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        // 로그인 성공 시 메인 페이지로 리다이렉트
        if (event === 'SIGNED_IN' && session?.user) {
          // 여기서 메인 페이지로 리다이렉트하거나 상태 업데이트
          console.log('로그인 성공:', session.user);
          // 예: window.location.href = '/main'; 또는 라우터 사용
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 로그아웃 처리
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('로그아웃 오류:', error);
    } else {
      setUser(null);
    }
  };

  // 회원가입 성공 후 로그인 페이지로 전환하는 핸들러
  const handleSignUpSuccess = () => {
    setIsLoginView(true);
  };

  // 로딩 중일 때
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  // 이미 로그인된 사용자일 때
  if (user) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px'
      }}>
        <h2>환영합니다!</h2>
        <p>안녕하세요, {user.user_metadata?.nickname || '사용자'}님!</p>
        <p>전화번호: {user.phone}</p>
        <button 
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          로그아웃
        </button>
        <button 
          onClick={() => {
            // 메인 페이지로 이동하는 로직
            console.log('메인 페이지로 이동');
            // 예: window.location.href = '/main';
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          메인 페이지로 이동
        </button>
      </div>
    );
  }

  // 로그인/회원가입 폼 표시
  return (
    <div>
      {isLoginView ? (
        <LoginForm onLoginSuccess={() => console.log('로그인 성공')} />
      ) : (
        <SignUpForm onSignUpSuccess={handleSignUpSuccess} />
      )}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginTop: '20px',
        gap: '10px'
      }}>
        <button 
          onClick={() => setIsLoginView(!isLoginView)}
          style={{
            padding: '10px 20px',
            backgroundColor: isLoginView ? '#2196F3' : '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {isLoginView ? '회원가입 하러가기' : '로그인 하러가기'}
        </button>
      </div>
    </div>
  );
}