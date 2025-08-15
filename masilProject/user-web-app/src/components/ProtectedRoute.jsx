import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, adminOnly = false, session }) {
  const [isValidSession, setIsValidSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const validateSession = async () => {
      // DB에서 사용자의 최신 증표와 역할 정보를 가져옴
      const { data: profile } = await supabase
        .from('users')
        .select('role, latest_session_id')
        .eq('id', session.user.id)
        .single();
      
      // 브라우저에 저장된 내 증표
      const localSessionId = localStorage.getItem('session_id');

      // 내 증표와 DB의 최신 증표가 일치하는지 확인
      if (profile && profile.latest_session_id === localSessionId) {
        // 관리자 페이지일 경우, 역할도 확인
        if (adminOnly && profile.role !== 'ADMIN') {
          setIsValidSession(false);
        } else {
          setIsValidSession(true);
        }
      } else {
        // 증표가 일치하지 않으면 (다른 곳에서 로그인함) 유효하지 않은 세션으로 처리
        setIsValidSession(false);
      }
      setLoading(false);
    };

    validateSession();
  }, [session, adminOnly]);

  if (loading) {
    return <p>세션 확인 중...</p>;
  }

  // 세션이 유효하면 페이지를 보여주고, 아니면 로그인 페이지로 보냄
  if (isValidSession) {
    return children;
  } else {
    // 유효하지 않은 경우, 확실하게 로그아웃 처리 후 로그인 페이지로 이동
    supabase.auth.signOut();
    return <Navigate to="/login" replace />;
  }
}