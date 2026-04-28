# 올잇 v2 - 깔끔한 분리 버전 📦

## 📁 폴더 구조

```
src/
├── App.jsx              ← 메인 라우팅 (간단)
├── main.jsx             ← React 시작점
├── index.css            ← 전역 스타일
├── shared/              ← 공통 코드 (재사용)
│   ├── themes.js        ← 다크/라이트 테마
│   └── users.js         ← 시뮬 계정 데이터
└── pages/               ← 각 화면별 분리
    ├── LoginScreen.jsx  ← 로그인 (908줄)
    ├── EngineerApp.jsx  ← 기사님 풀 기능 (2099줄)
    ├── HappycallApp.jsx ← 해피콜 풀 기능 (1644줄)
    ├── AdminApp.jsx     ← 대표님 대시보드 (728줄)
    └── PrincipalApp.jsx ← 원청 풀 기능 (1134줄)
```

## 🎯 주요 변경

1. **각 역할별 독립 컴포넌트**
   - 한 파일 = 한 역할
   - 수정 시 해당 파일만 열면 됨

2. **로그인 → 자동 라우팅**
   - 로그인 후 역할별 화면 자동 이동
   - 로그아웃 버튼으로 다시 로그인 화면

3. **공통 코드 분리**
   - THEMES, USERS는 한 곳에서 관리
   - 변경 시 한 파일만 수정

## 🚀 사용 방법

### 방법 1: PowerShell로 자동 복사 (추천)
PowerShell에서 한 번에:

```powershell
# 1. 기존 src 폴더 백업
cd C:\Users\butto\Desktop\ollit
Rename-Item src src-backup

# 2. 새 src 폴더 만들기
mkdir src
mkdir src\shared
mkdir src\pages

# 3. 다운로드한 파일들 복사
# (다운로드 폴더에 ollit-v2 폴더가 있다고 가정)
copy $env:USERPROFILE\Downloads\ollit-v2\*.jsx src\
copy $env:USERPROFILE\Downloads\ollit-v2\*.css src\
copy $env:USERPROFILE\Downloads\ollit-v2\shared\*.js src\shared\
copy $env:USERPROFILE\Downloads\ollit-v2\pages\*.jsx src\pages\

# 4. 확인
dir src
dir src\shared
dir src\pages

# 5. 빌드 테스트
npm run build
```

### 방법 2: VS Code로 수동 복사

각 파일을 VS Code에서 열고 내용 복사 → 붙여넣기

## 🎉 배포

```powershell
git add .
git commit -m "feat: 4개 역할 풀 기능 분리 통합"
git push

# Vercel 자동 재배포 (1-2분)
# https://ollit.vercel.app/ 접속!
```

## ✅ 테스트 시나리오

1. 로그인 화면 → 김쿨가이 클릭 → 로그인
2. 원청 대표님 화면 (카톡 파싱)
3. 우상단 로그아웃 → 로그인 화면
4. 김동효 → 기사님 풀 화면 (작업 상세, 출발/도착)
5. 김지혜 → 해피콜 풀 화면
6. 이대표 → 대표 대시보드

각 화면 모두 풀 기능 작동!
