const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = '48be9d61e4ae262e8c8fc2fd48201dfa108c77284b9ba088ebcdb7c40295ce08';

const KAKAO_REST_KEY = 'c868210b389114ec694e334f5cb16b45';

// 지오코딩 캐시 (같은 주소 반복 호출 방지)
const geoCache = new Map();

async function geocodeAddress(addr) {
  if (geoCache.has(addr)) return geoCache.get(addr);

  // 1차: 정확한 주소 검색 API
  try {
    const r = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query: addr },
      headers: { 'Authorization': `KakaoAK ${KAKAO_REST_KEY}` },
      timeout: 8000
    });
    const docs = r.data.documents;
    if (docs && docs.length > 0) {
      const coord = { lat: parseFloat(docs[0].y), lng: parseFloat(docs[0].x), src: 'address', raw: docs[0].address_name };
      geoCache.set(addr, coord);
      return coord;
    }
  } catch (e) {
    console.error('카카오 주소검색 실패:', addr, e.response?.data || e.message);
  }

  // 2차: 주소 검색 실패시 키워드 검색 API로 폴백 (더 관대한 매칭)
  try {
    const r2 = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: { query: addr },
      headers: { 'Authorization': `KakaoAK ${KAKAO_REST_KEY}` },
      timeout: 8000
    });
    const docs2 = r2.data.documents;
    if (docs2 && docs2.length > 0) {
      const coord = { lat: parseFloat(docs2[0].y), lng: parseFloat(docs2[0].x), src: 'keyword', raw: docs2[0].address_name || docs2[0].road_address_name };
      geoCache.set(addr, coord);
      return coord;
    }
  } catch (e) {
    console.error('카카오 키워드검색 실패:', addr, e.response?.data || e.message);
  }

  geoCache.set(addr, null);
  return null;
}

// 광주광역시 대략적인 위경도 범위 (이 범위 벗어나면 잘못된 매칭으로 간주)
const GWANGJU_BOUNDS = { latMin: 34.9, latMax: 35.35, lngMin: 126.65, lngMax: 127.05 };

function isInGwangju(lat, lng) {
  return lat >= GWANGJU_BOUNDS.latMin && lat <= GWANGJU_BOUNDS.latMax &&
         lng >= GWANGJU_BOUNDS.lngMin && lng <= GWANGJU_BOUNDS.lngMax;
}

// 카카오 API는 빠르고 분당 호출수 제한이 넉넉해서 동시 처리 가능
async function geocodeBatch(items) {
  return Promise.all(items.map(async (item) => {
    const addr = item.ROAD_NM_ADDR || item.LOTNO_ADDR;
    if (addr) {
      const coord = await geocodeAddress(addr);
      if (coord && isInGwangju(coord.lat, coord.lng)) {
        item._lat = coord.lat;
        item._lng = coord.lng;
      } else if (coord) {
        console.warn('광주 범위 밖 좌표 거부:', addr, '->', coord.raw, coord.lat, coord.lng);
      }
    }
    return item;
  }));
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

    // 주소 기반 지오코딩 (순차 처리로 rate limit 회피)
    items = await geocodeBatch(items);

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
  const coord = await geocodeAddress(addr);
  if (!coord) return res.json({ lat: null, lng: null });
  res.json({
    lat: coord.lat,
    lng: coord.lng,
    matched_address: coord.raw,
    source: coord.src,
    in_gwangju_bounds: isInGwangju(coord.lat, coord.lng)
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`서버: http://localhost:${PORT}`));
