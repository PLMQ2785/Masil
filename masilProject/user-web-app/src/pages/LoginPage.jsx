import React, { useState } from 'react';
import LoginForm from '../components/LoginForm'; // LoginForm을 components 폴더로 이동
import SignUpForm from '../components/SignUpForm'; // SignUpForm을 components 폴더로 이동

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);

  // 가입 성공 시 호출될 함수
  const handleSignUpSuccess = () => {
    // isLoginView 상태를 true로 변경하여 로그인 폼을 보여줌
    setIsLoginView(true);
  };

  return (
    <div>
      {isLoginView ? (<LoginForm />) : (<SignUpForm onSignUpSuccess={handleSignUpSuccess} />)}
      <button onClick={() => setIsLoginView(!isLoginView)}>
        {isLoginView ? '회원가입 하러가기' : '로그인 하러가기'}
      </button>
    </div>
  );
}