import React, { useEffect, useState } from 'react';

export default function MapComponent() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    if (window.naver && window.naver.maps) {
      const mapOptions = {
        center: new window.naver.maps.LatLng(37.5665, 126.9780),
        zoom: 12,
      };
      const map = new window.naver.maps.Map('map', mapOptions);
      fetchJobsAndDrawMarkers(map);
    } else {
      console.error("네이버 지도 API가 로드되지 않았습니다.");
    }
  }, []);

  const fetchJobsAndDrawMarkers = async (map) => {
    try {
      // opportunities -> jobs
      const response = await fetch('http://localhost:8000/api/jobs');
      const data = await response.json();
      setJobs(data);

      console.log('✅ 지도 데이터 로딩 성공:', data);

      data.forEach((job) => {
        // latitude -> job_latitude, longitude -> job_longitude
        const markerPosition = new window.naver.maps.LatLng(job.job_latitude, job.job_longitude);
        
        const marker = new window.naver.maps.Marker({
          position: markerPosition,
          map: map,
        });

        const infowindow = new window.naver.maps.InfoWindow({
            content: `<div style="padding:10px;border:1px solid black;font-size:12px;">${job.title}</div>`
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infowindow.getMap()) {
            infowindow.close();
          } else {
            infowindow.open(map, marker);
          }
        });
      });

    } catch (error) {
      console.error('❌ 지도 데이터 로딩 실패:', error);
    }
  };

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '70vh' }}></div>
    </div>
  );
}