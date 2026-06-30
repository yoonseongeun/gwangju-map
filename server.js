const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = '48be9d61e4ae262e8c8fc2fd48201dfa108c77284b9ba088ebcdb7c40295ce08';

// TM중부원점 → WGS84 변환
function tmToWgs84(x, y) {
  // 상수 정의
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 1.0;
  const dx = 200000.0, dy = 500000.0;
  const lon0 = 127.0 * Math.PI / 180;
  const lat0 = 38.0 * Math.PI / 180;

  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat0) ** 2);
  const M0 = a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * lat0
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*lat0)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*lat0)
    - (35*e2**3/3072) * Math.sin(6*lat0));

  const X = x - dx;
  const Y = y - dy;
  const M = M0 + Y / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256));
  const phi1 = mu
    + (3*e1/2 - 27*e1**3/32) * Math.sin(2*mu)
    + (21*e1**2/16 - 55*e1**4/32) * Math.sin(4*mu)
    + (151*e1**3/96) * Math.sin(6*mu)
    + (1097*e1**4/512) * Math.sin(8*mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1)**2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = e2 / (1 - e2) * Math.cos(phi1) ** 2;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1)**2, 1.5);
  const D = X / (N1 * k0);

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D**2/2 - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e2/(1-e2)) * D**4/24
    + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*e2/(1-e2) - 3*C1**2) * D**6/720
  );
  const lon = lon0 + (
    D - (1 + 2*T1 + C1) * D**3/6
    + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*e2/(1-e2) + 24*T1**2) * D**5/120
  ) / Math.cos(phi1);

  return {
    lat: lat * 180 / Math.PI,
    lng: lon * 180 / Math.PI
  };
}

// 구코드 매핑 (광주광역시 5개구)
const GU_CODES = {
  '3711000': '3630000', // 광산구 ✅
  '3714000': '3590000', // 동구 ✅
  '3711500': '3600000', // 서구 ✅
  '3712000': '3620000', // 북구 ✅
  '3713000': '3610000', // 남구 ✅
};

// 업종별 엔드포인트 (확인된 주소)
const BIZ_ENDPOINTS = {
  '07_22_21_P': 'https://apis.data.go.kr/1741000/general_restaurants/info',   // 일반음식점 ✅
  '07_24_01_P': 'https://apis.data.go.kr/1741000/snack_bars/info',            // 휴게음식점
  '07_24_05_P': 'https://apis.data.go.kr/1741000/bakeries/info',              // 제과점 ✅
  '07_22_05_P': 'https://apis.data.go.kr/1741000/singing_bars/info',          // 단란주점 ✅
  '07_22_08_P': 'https://apis.data.go.kr/1741000/entertainment_bars/info',    // 유흥주점 ✅
  '06_02_06_P': 'https://apis.data.go.kr/1741000/beauty_salons/info',         // 미용업 ✅
  '03_01_02_P': 'https://apis.data.go.kr/1741000/clinics/info',               // 의원 ✅
  '03_01_03_P': 'https://apis.data.go.kr/1741000/hospitals/info',             // 병원 ✅
  '15_01_99_P': 'https://apis.data.go.kr/1741000/other_food_retailers/info',  // 슈퍼마켓 ✅
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

    // TM좌표 → 위경도 변환하여 _lat, _lng 추가
    items = items.map(item => {
      const x = parseFloat(item.CRD_INFO_X);
      const y = parseFloat(item.CRD_INFO_Y);
      if (!isNaN(x) && !isNaN(y) && x > 0 && y > 0) {
        try {
          const { lat, lng } = tmToWgs84(x, y);
          if (lat > 30 && lat < 40 && lng > 120 && lng < 130) {
            item._lat = lat;
            item._lng = lng;
          }
        } catch (e) {}
      }
      return item;
    });

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
