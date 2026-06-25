const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = '48be9d61e4ae262e8c8fc2fd48201dfa108c77284b9ba088ebcdb7c40295ce08';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/biz', async (req, res) => {
  const { bizType, guCode, dateFrom, dateTo } = req.query;
  if (!bizType || !guCode || !dateFrom || !dateTo)
    return res.status(400).json({ error: '필수 파라미터 없음' });

  const url = `https://sample.localdata.go.kr/datakorea/openapi/prtc/getSvcInfo?authKey=${API_KEY}&opnSvcId=${bizType}&localCode=${guCode}&lastModTsBgn=${dateFrom}&lastModTsEnd=${dateTo}&pageIndex=1&pageSize=500&resultType=json`;
  console.log('요청:', url);

  try {
    const r = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('응답:', r.status, JSON.stringify(r.data).slice(0, 300));
    const d = r.data;
    let items = [];
    if (Array.isArray(d)) items = d;
    else if (d?.result?.body) items = Array.isArray(d.result.body) ? d.result.body : [];
    else if (d?.body) items = Array.isArray(d.body) ? d.body : [];
    else if (d?.rows) items = d.rows;
    else if (d?.data) items = d.data;
    res.json({ success: true, totalCnt: items.length, items });
  } catch (err) {
    console.error('오류:', err.message, err.response?.status, JSON.stringify(err.response?.data).slice(0,300));
    res.status(500).json({ error: err.message, status: err.response?.status, data: err.response?.data });
  }
});

app.get('/api/geocode', async (req, res) => {
  const { addr } = req.query;
  if (!addr) return res.status(400).json({ error: '주소 없음' });
  try {
    const r = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { format: 'json', q: addr, limit: 1, countrycodes: 'kr' },
      headers: { 'User-Agent': 'GwangjuBizMap/1.0' }, timeout: 8000
    });
    const g = r.data[0];
    res.json(g ? { lat: parseFloat(g.lat), lng: parseFloat(g.lon) } : { lat: null, lng: null });
  } catch { res.json({ lat: null, lng: null }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`서버: http://localhost:${PORT}`));
