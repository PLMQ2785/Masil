import React, { useState, useEffect } from 'react';

export default function JobForm({ editingJob, onComplete }) {
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState('');
  const [hourlyWage, setHourlyWage] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [place, setPlace] = useState('');
  const [address, setAddress] = useState('');
  const [jobLatitude, setJobLatitude] = useState('');
  const [jobLongitude, setJobLongitude] = useState('');
  
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingJob) {
      setTitle(editingJob.title || '');
      setClient(editingJob.client || '');
      setDescription(editingJob.description || '');
      setParticipants(editingJob.participants || '');
      setHourlyWage(editingJob.hourly_wage || '');
      setWorkDays(editingJob.work_days || '');
      setStartTime(editingJob.start_time || '');
      setEndTime(editingJob.end_time || '');
      setPlace(editingJob.place || '');
      setAddress(editingJob.address || '');
      setJobLatitude(editingJob.job_latitude || '');
      setJobLongitude(editingJob.job_longitude || '');
    }
  }, [editingJob]);

  const handleGeocode = async () => {
    if (!address) {
      alert('먼저 주소를 입력해주세요.');
      return;
    }
    setIsGeocoding(true);
    const url = `http://localhost:8000/api/geocode?address=${encodeURIComponent(address)}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '알 수 없는 오류');
      setJobLatitude(data.latitude);
      setJobLongitude(data.longitude);
      alert('좌표를 성공적으로 찾았습니다.');
    } catch (error) {
      alert(`좌표 찾기 실패: ${error.message}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const jobData = {
      title,
      client,
      description,
      participants: parseInt(participants, 10) || null,
      hourly_wage: parseInt(hourlyWage, 10),
      work_days: workDays || null,
      start_time: startTime || null,
      end_time: endTime || null,
      place,
      address,
      job_latitude: parseFloat(jobLatitude),
      job_longitude: parseFloat(jobLongitude),
      // tags: [], // tags 필드는 현재 폼에서 사용하지 않으므로 빈 배열로 전달
    };

    const isEditing = !!editingJob;
    const url = isEditing 
      ? `http://localhost:8000/api/jobs/${editingJob.job_id}` 
      : 'http://localhost:8000/api/jobs';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '알 수 없는 오류');
      }
      alert(isEditing ? '수정되었습니다!' : '저장되었습니다!');
      onComplete();
    } catch (error) {
      alert('오류 발생: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0', display: 'grid', gap: '10px' }}>
      <h3>{editingJob ? '소일거리 수정' : '새 소일거리 등록'}</h3>
      
      <input type="text" placeholder="* 사업명(제목)" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input type="text" placeholder="클라이언트 (복지관 등)" value={client} onChange={(e) => setClient(e.target.value)} />
      <textarea placeholder="근무 내용" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input type="number" placeholder="모집 인원" value={participants} onChange={(e) => setParticipants(e.target.value)} />
      <input type="number" placeholder="* 시급(원)" value={hourlyWage} onChange={(e) => setHourlyWage(e.target.value)} required />
      <input type="text" placeholder="근무 요일 (예: 1111100)" value={workDays} onChange={(e) => setWorkDays(e.target.value)} />
      <div style={{display:'flex', gap: '10px'}}>
        <label>시작 시간: <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
        <label>종료 시간: <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
      </div>
      <input type="text" placeholder="* 근무 지역 (예: 성내동)" value={place} onChange={(e) => setPlace(e.target.value)} required />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input type="text" placeholder="도로명 주소 (지오코딩용)" value={address} onChange={(e) => setAddress(e.target.value)} style={{ flex: 1 }} />
        <button type="button" onClick={handleGeocode} disabled={isGeocoding}>
          {isGeocoding ? '찾는 중...' : '좌표 찾기'}
        </button>
      </div>
      
      <div style={{display:'flex', gap: '10px'}}>
        <input type="number" step="any" placeholder="* 위도 (자동 입력)" value={jobLatitude} onChange={(e) => setJobLatitude(e.target.value)} required readOnly />
        <input type="number" step="any" placeholder="* 경도 (자동 입력)" value={jobLongitude} onChange={(e) => setJobLongitude(e.target.value)} required readOnly />
      </div>
      
      <div style={{display:'flex', gap: '10px'}}>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : (editingJob ? '수정하기' : '저장하기')}
        </button>
        <button type="button" onClick={onComplete}>취소</button>
      </div>
    </form>
  );
}