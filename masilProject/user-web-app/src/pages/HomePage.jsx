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
      {/* 로그아웃 버튼은 App.jsx 헤더에 이미 있습니다. */}
      <MapComponent />
    </div>
  );
}