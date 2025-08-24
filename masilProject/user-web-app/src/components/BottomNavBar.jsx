// src/components/BottomNavBar.jsx

import React, { useState } from 'react';
import './BottomNavBar.css';

export default function BottomNavBar({ 
  onMicClick, 
  onJobListClick, 
  onProfileClick, 
  initialSelected = '',
  showTooltips = false, // ✅ 새로운 props: 툴팁 표시 여부
  isJobListActive = false, // 🆕 Job있으 버튼 활성화 상태
  isVoiceActive = false // 🆕 마이크 버튼 활성화 상태
}) {
  const [selectedTab, setSelectedTab] = useState(initialSelected);

  const handleTabClick = (tabName) => {
    setSelectedTab(tabName);
    
    // 특정 탭 클릭 시 콜백 실행
    if (tabName === 'list' && onJobListClick) {
      onJobListClick();
    } else if (tabName === 'voice' && onMicClick) {
      onMicClick();
    } else if (tabName === 'profile' && onProfileClick) {
      onProfileClick();
    }
  };

  return (
    <div className="bottom-nav">
      <button 
        className={`nav-item ${selectedTab === 'list' || isJobListActive ? 'active' : ''}`}
        onClick={() => handleTabClick('list')}
      >
        {/* ✅ 새로운 기능: AI 추천 툴팁 */}
        {showTooltips && (
          <div className="nav-tooltip ai-tooltip">
            AI추천 기능을 <br></br>사용해보세요!
          </div>
        )}
        <div className="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
          </div>
          <span className="nav-label">AI 추천</span>
      </button>
      
      <button 
        className={`nav-item ${selectedTab === 'voice' || isVoiceActive ? 'active' : ''}`}
        onClick={() => handleTabClick('voice')}
      >
        {/* ✅ 새로운 기능: 음성 추천 툴팁 */}
        {showTooltips && (
          <div className="nav-tooltip voice-tooltip">
            음성추천 기능을 <br></br>사용해보세요!
          </div>
        )}
        <div className="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span className="nav-label">음성 추천</span>
      </button>
      
      <button 
        className={`nav-item ${selectedTab === 'profile' ? 'active' : ''}`}
        onClick={() => handleTabClick('profile')}
      >
        <div className="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <span className="nav-label">나의 정보</span>
      </button>
    </div>
  );
}