const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = '48be9d61e4ae262e8c8fc2fd48201dfa108c77284b9ba088ebcdb7c40295ce08';

// 구코드 매핑 (광주광역시 5개구)
const GU_CODES = {
  '3711000': '3630000', // 광산구 ✅
  '3714000': '3590000', // 동구 ✅
  '3711500': '3600000', // 서구 ✅
  '3712000': '3620000', // 북구 ✅
  '3713000': '3610000', // 남구 ✅
};

// 업종별 엔드포인트
const BIZ_ENDPOINTS = {
  '07_22_21_P': 'https://apis.data.go.kr/1741000/general_restaurants/info',
  '07_24_01_P': 'https://apis.data.go.kr/1741000/snack_bars/info',
  '07_24_05_P': 'https://apis.data.go.kr/1741000/bakeries/info',
  '07_22_05_P': 'https://apis.data.go.kr/1741000/simple_entertainment/info',
  '07_22_08_P': 'https://apis.data.go.kr/1741000/entertainment_bars/info',
  '06_02_06_P': 'https://apis.data.go.kr/1741000/beauty_shops/info',
  '06_02_04_P': 'https://apis.data.go.kr/1741000/public_baths/info',
  '03_01_02_P': 'https://apis.data.go.kr/1741000/clinics/info',
  '03_01_04_P': 'https://apis.data.go.kr/1741000/dental_clinics/info',
  '15_01_17_P': 'https://apis.data.go.kr/1741000/convenience_stores/info',
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/biz', async (req, res) => {
  const { bizType, guCode, dateFrom, dateTo } = req.query;
  if (!bizType || !guCode || !dateFrom || !dateTo)
    return res.status(400).json({ error: '필수 파라미터 없음' });

  const endpoint = BIZ_ENDPOINTS[bizType] || BIZ_ENDPOINTS['07_22_21_P'];
  const localCode = GU_CODES[guCode] || guCode;

  // 실제 확인된 파라미터명 사용
  const params = {
    serviceKey: API_KEY,
    pageNo: 1,
    numOfRows: 500,
    returnType: 'json',
    'cond[LCPMT_YMD::GTE]': dateFrom,
    'cond[LCPMT_YMD::LT]': dateTo,
    'cond[OPN_ATMY_GRP_CD::EQ]': localCode,
  };

  console.log('요청 URL:', endpoint);
  console.log('파라미터:', JSON.stringify(params));

  try {
    const r = await axios.get(endpoint, {
      params,
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    console.log('응답상태:', r.status);
    console.log('응답데이터:', JSON.stringify(r.data).slice(0, 500));

    const d = r.data;
    let items = [];
    if (Array.isArray(d)) items = d;
    else if (d?.result?.body) items = Array.isArray(d.result.body) ? d.result.body : [];
    else if (d?.body) items = Array.isArray(d.body) ? d.body : [];
    else if (d?.rows) items = d.rows;
    else if (d?.data) items = d.data;
    else if (d?.list) items = d.list;
    else if (d?.items?.item) items = [].concat(d.items.item);
    else if (d?.response?.body?.items?.item) items = [].concat(d.response.body.items.item);

    res.json({ success: true, totalCnt: items.length, items });
  } catch (err) {
    console.error('오류:', err.message);
    console.error('응답:', err.response?.status, JSON.stringify(err.response?.data).slice(0, 500));
    res.status(500).json({
      error: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
  }
});

app.get('/api/geocode', async (req, res) => {
  const { addr } = req.query;
  if (!addr) return res.status(400).json({ error: '주소 없음' });
  try {
    const r = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { format: 'json', q: addr, limit: 1, countrycodes: 'kr' },
      headers: { 'User-Agent': 'GwangjuBizMap/1.0' },
      timeout: 8000
    });
    const g = r.data[0];
    res.json(g ? { lat: parseFloat(g.lat), lng: parseFloat(g.lon) } : { lat: null, lng: null });
  } catch { res.json({ lat: null, lng: null }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`서버: http://localhost:${PORT}`));
