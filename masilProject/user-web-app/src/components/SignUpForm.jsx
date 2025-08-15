import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function SignUpForm({ onSignUpSuccess }) {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // 새로 추가된 필드들을 위한 state
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('M'); // 기본값 M
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [preferredJobs, setPreferredJobs] = useState('');
  const [interests, setInterests] = useState('');
  const [availabilityJson, setAvailabilityJson] = useState('');
  const [workHistory, setWorkHistory] = useState('');


  const handleSignUp = async (event) => {
    event.preventDefault();
    setLoading(true);

    const formattedPhone = `+82${phone.replace(/[^0-9]/g, '').startsWith('0') ? phone.replace(/[^0-9]/g, '').substring(1) : phone.replace(/[^0-9]/g, '')}`;
    
    // DB 트리거로 전달할 추가 정보
    const profileData = {
      nickname,
      gender,
      date_of_birth: dateOfBirth,
      home_address: homeAddress,
      preferred_jobs: preferredJobs, // 텍스트를 그대로 전달
      interests: interests,
      availability_json: availabilityJson,
      work_history: workHistory,
    };

    const { error } = await supabase.auth.signUp({
      phone: formattedPhone,
      password: password,
      options: {
        data: profileData // 모든 추가 정보는 options.data 안에 담아 보냅니다.
      }
    });

    if (error) {
      alert(error.error_description || error.message);
    } else {
      await supabase.auth.signOut();

      alert('가입이 완료되었습니다! 이제 로그인 해주세요.');
      onSignUpSuccess();
    }
    setLoading(false);


  };

  return (
    <div>
      <h2>회원가입</h2>
      <form onSubmit={handleSignUp} style={{ display: 'grid', gap: '10px', maxWidth: '400px' }}>
        {/* 기존 필드 */}
        <input type="tel" placeholder="* 전화번호 ('-' 제외)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} required />
        <input type="password" placeholder="* 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
        
        <hr />

        {/* 새로 추가된 필드 */}
        <input type="text" placeholder="* 닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        <select value={gender} onChange={(e) => setGender(e.target.value)} required>
          <option value="M">남성</option>
          <option value="F">여성</option>
        </select>
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
        <input type="text" placeholder="거주지 (예: 서울 강남구)" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
        <textarea placeholder="선호 직무 (텍스트 입력)" value={preferredJobs} onChange={(e) => setPreferredJobs(e.target.value)} />
        <textarea placeholder="취미/관심사 (텍스트 입력)" value={interests} onChange={(e) => setInterests(e.target.value)} />
        <textarea placeholder="가용 시간대 (텍스트 입력)" value={availabilityJson} onChange={(e) => setAvailabilityJson(e.target.value)} />
        <textarea placeholder="과거 경험 (텍스트 입력)" value={workHistory} onChange={(e) => setWorkHistory(e.target.value)} />
        
        <div>
          <button type="submit" disabled={loading}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </div>
      </form>
    </div>
  );
}