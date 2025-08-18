import React, { useState, useEffect } from 'react';
import JobForm from '../components/JobForm';

export default function AdminPage() {
  const [jobs, setjobs] = useState([]);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // FastAPI 서버에서 데이터를 가져오도록 수정
  const fetchjobs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/jobs');
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setjobs(data);
    } catch (error) {
      console.error('데이터 조회 오류', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchjobs();
  }, []);

  // FastAPI 서버에 삭제를 요청하도록 수정
  const handleDelete = async (job_id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`http://localhost:8000/api/jobs/${job_id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '삭제 실패');
        }
        alert('삭제되었습니다.');
        fetchjobs(); // 목록 새로고침
      } catch (error) {
        alert('삭제 오류: ' + error.message);
      }
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingJob(null);
    setShowForm(true);
  };

  const handleFormComplete = () => {
    setShowForm(false);
    setEditingJob(null);
    fetchjobs(); // 목록 새로고침
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  return (
    <div>
      <h2>관리자 대시보드</h2>
      {!showForm && <button onClick={handleAddNew}>새 소일거리 등록</button>}

      {showForm && (
        <JobForm
          editingJob={editingJob}
          onComplete={handleFormComplete}
        />
      )}

      <hr style={{ margin: '2rem 0' }}/>
      <h3>소일거리 목록</h3>
      <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{padding: '8px'}}>제목</th>
            <th style={{padding: '8px'}}>장소</th>
            <th style={{padding: '8px'}}>시급</th>
            <th style={{padding: '8px'}}>관리</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((op) => (
            <tr key={op.job_id}>
              <td style={{padding: '8px'}}>{op.title}</td>
              <td style={{padding: '8px'}}>{op.place}</td>
              <td style={{padding: '8px'}}>{op.hourly_wage.toLocaleString()}원</td>
              <td style={{padding: '8px'}}>
                <button onClick={() => handleEdit(op)} style={{marginRight: '5px'}}>수정</button>
                <button onClick={() => handleDelete(op.job_id)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}