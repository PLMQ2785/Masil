import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Navigate } from 'react-router-dom';

// 1. props로 session을 받도록 수정합니다.
export default function ProtectedRoute({ children, adminOnly = false, session }) {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // 2. useEffect가 session prop이 바뀔 때마다 다시 실행되도록 수정합니다.
  useEffect(() => {
    // 세션이 없으면 로딩을 멈추고 아무것도 안합니다. (아래 Navigate가 처리)
    if (!session) {
      setLoading(false);
      return;
    }

    // 세션이 있으면, 해당 사용자의 역할을 조회합니다.
    const fetchRole = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setUserRole(profile?.role);
      setLoading(false);
    };

    fetchRole();
  }, [session]); // session이 변경될 때마다 이 로직을 다시 실행합니다.

  if (loading) {
    return <p>사용자 확인 중...</p>;
  }

  // 3. 전달받은 session을 기준으로 즉시 판단합니다.
  if (!session || (adminOnly && userRole !== 'ADMIN')) {
    return <Navigate to="/login" replace />;
  }

  return children;
}