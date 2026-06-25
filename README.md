# 광주 영업지도 - 배포 가이드

## 📁 파일 구성
```
gwangju-map/
├── server.js        ← Node.js 서버 (API 중계)
├── package.json     ← 패키지 설정
└── public/
    └── index.html   ← 웹앱 (모바일 최적화)
```

---

## 🚀 Render.com 무료 배포 방법 (10분)

### 1단계 - GitHub에 올리기
1. https://github.com 가입 (없으면)
2. 우측 상단 **+** → **New repository**
3. 이름: `gwangju-map` 입력 → **Create repository**
4. 로컬에서 아래 명령어 실행:
```bash
cd gwangju-map
git init
git add .
git commit -m "첫 배포"
git remote add origin https://github.com/[내아이디]/gwangju-map.git
git push -u origin main
```

### 2단계 - Render.com 설정
1. https://render.com 접속 → Google 계정으로 가입
2. **New +** → **Web Service** 클릭
3. GitHub 연결 → `gwangju-map` 저장소 선택
4. 설정값 입력:
   - **Name**: gwangju-map (자유롭게)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free ✅
5. **Create Web Service** 클릭

### 3단계 - 완료
- 약 2~3분 후 `https://gwangju-map-xxxx.onrender.com` 형태의 URL 생성
- 이 URL을 모바일 홈화면에 바로가기로 추가하면 앱처럼 사용 가능

---

## 📱 모바일 홈화면 추가 방법

### iPhone (Safari)
1. 사이트 접속 → 하단 공유 버튼(□↑) 탭
2. **홈 화면에 추가** 선택

### 안드로이드 (Chrome)
1. 사이트 접속 → 우측 상단 ⋮ 메뉴
2. **홈 화면에 추가** 선택

---

## ⚠️ Render.com 무료 플랜 제한
- 15분 동안 접속이 없으면 서버가 슬립(절전)됨
- 다시 접속하면 30~60초 후 깨어남 (첫 로딩만 느림)
- 해결책: 매월 업그레이드 없이 그냥 사용하거나, 아침에 한 번 먼저 열어두기

---

## 🔧 업종 추가하는 방법

`public/index.html` 파일의 `BIZ_LIST` 배열에 추가:
```javascript
{id:'업종코드', name:'표시이름', color:'#색상코드'},
```

업종코드는 localdata.go.kr 사이트에서 확인 가능.

---

## 📞 문의
공공데이터 API 문의: 1566-0025
