# 복약 관리시스템 MVP

약 정보를 등록하고, 정해진 시간에 알림을 받으며, 오늘의 복약 상태와 날짜별 이력을 확인하는 웹앱 MVP입니다.

## 기술 스택

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite
- Notification: Web Notification API + 앱 내부 알림
- UI: 한국어, 모바일 우선 카드형 디자인

## 주요 기능

- 약 정보 CRUD
- 복용량, 복용 횟수, 복용 타이밍, 여러 알림 시간 관리
- 중요 약, 주의사항, 금기 음식/약물 기록
- 오늘 복약 현황 시간순 표시
- 완료 / 건너뜀 / 미복용 상태 관리
- 오늘 복약률 및 상태별 카운트 표시
- 브라우저 알림 권한 요청과 권한 거부 안내
- 브라우저 알림 실패 시 앱 내부 알림 표시
- 같은 날짜, 같은 약, 같은 시간 중복 알림 방지
- 날짜별 복약 이력 조회

## 화면

- `/`: 오늘의 복약 현황
- `/medicines`: 약 목록
- `/medicines/new`: 약 등록
- `/medicines/:id/edit`: 약 수정
- `/history`: 복약 이력

## 설치

```bash
npm install
```

## 개발 실행

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## 프로덕션 실행

```bash
npm run build
npm start
```

빌드 후에는 http://localhost:4000 에서 프론트엔드와 API가 함께 제공됩니다.

## 테스트

```bash
npm test
```

스모크 테스트는 임시 SQLite DB로 약 CRUD, 오늘 일정 생성, 복약 이력 저장 API를 확인합니다.

## API

- `GET /api/medicines`
- `GET /api/medicines/:id`
- `POST /api/medicines`
- `PUT /api/medicines/:id`
- `DELETE /api/medicines/:id`
- `GET /api/today`
- `GET /api/history?date=YYYY-MM-DD`
- `POST /api/history`

## 데이터 저장

SQLite 파일은 기본적으로 `server/data/medication.sqlite`에 생성됩니다.
