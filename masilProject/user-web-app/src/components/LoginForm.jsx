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

      // --- 동시 로그인 방지 로직 추가  ---
      try {
        // 1. 새로운 세션 증표(UUID) 생성
        const newSessionId = crypto.randomUUID();

        // 2. FastAPI에 증표 업데이트 요청
        await fetch('http://localhost:8000/api/users/update-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, session_id: newSessionId }),
        });

        // 3. 브라우저 로컬 저장소에 증표 저장
        localStorage.setItem('session_id', newSessionId);

      } catch (e) {
        alert("세션 처리 중 오류가 발생했습니다. 다시 로그인해주세요.");
        await supabase.auth.signOut(); // 오류 발생 시 안전하게 로그아웃
        setLoading(false);
        return;
      }
      // --- 로직 추가 끝 ---


      const { data: profile, error: profileError } = await supabase
        .from('users')
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
}