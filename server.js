const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = '48be9d61e4ae262e8c8fc2fd48201dfa108c77284b9ba088ebcdb7c40295ce08';
const LOCALDATA_BASE = 'https://www.localdata.go.kr/platform/rest';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 인허가 데이터 조회 API
app.get('/api/biz', async (req, res) => {
  const { bizType, guCode, dateFrom, dateTo, pageNo = 1, pageSize = 500 } = req.query;

  if (!bizType || !guCode || !dateFrom || !dateTo) {
    return res.status(400).json({ error: '필수 파라미터가 없습니다.' });
  }

  try {
    const url = `${LOCALDATA_BASE}/${bizType}/GR/json/${API_KEY}/${pageNo}/${pageSize}/`;
    const params = {
      localCode: guCode,
      lastModTsBgn: dateFrom,
      lastModTsEnd: dateTo,
    };

    const response = await axios.get(url, {
      params,
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const data = response.data;

    // 응답 구조 정규화
    let body = [];
    if (data && data.result && data.result.body) {
      body = data.result.body;
    } else if (Array.isArray(data)) {
      body = data;
    } else if (data && data.body) {
      body = data.body;
    }

    // 총건수
    let totalCnt = 0;
    if (data && data.result && data.result.header) {
      totalCnt = data.result.header.paging?.totalCount || body.length;
    }

    res.json({ success: true, totalCnt, items: body });
  } catch (err) {
    console.error('API 오류:', err.message);
    res.status(500).json({ error: 'API 호출 실패', message: err.message });
  }
});

// 주소 → 좌표 변환 (Nominatim 프록시)
app.get('/api/geocode', async (req, res) => {
  const { addr } = req.query;
  if (!addr) return res.status(400).json({ error: '주소가 없습니다.' });

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { format: 'json', q: addr + ' 광주광역시', limit: 1, countrycodes: 'kr' },
      headers: { 'User-Agent': 'GwangjuBizMap/1.0' },
      timeout: 8000
    });
    const result = response.data[0];
    if (result) {
      res.json({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    } else {
      res.json({ lat: null, lng: null });
    }
  } catch (err) {
    res.json({ lat: null, lng: null });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
