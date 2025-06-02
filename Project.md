# Project Task List

## [2025-05-14]

### Fix TypeScript process.env Error
- [x] Install @types/node as a dev dependency (`npm i --save-dev @types/node`)
- [x] Ensure tsconfig.json includes Node.js types (add "types": ["node"] to compilerOptions if missing)
- [x] Verify error is resolved after changes

### YouTube 자막 처리 개선
- [x] DOMParser 사용 제거 및 transcript XML 원본을 OpenAI API에 직접 전달하도록 코드 수정

---

## [2025-05-15]

### Fetch YouTube Transcript using youtube-transcript package
- [x] Install youtube-transcript npm package
- [x] Implement transcript fetching logic in app/actions.ts
- [x] Verify transcript fetching works as expected

### Code Refactoring
- [x] actions.ts를 용도별로 함수 분리 및 파일 분할 (youtube.ts, summary.ts 등)
- [x] 중복 코드 제거 및 오류 수정

### 작업 리스트

- [x] dev 브랜치 생성 및 푸쉬
- [x] 유튜브 링크 입력 시 영상 미리보기 자동 표시 기능 작업 시작
- [ ] 요약 타임스탬프 클릭 시 영상 seek 기능 진행중

### 로그 추가
- [x] 모든 함수에 로그 추가 (youtube.ts, summary.ts, actions.ts)
- [x] 입력/출력 데이터 로깅 처리

---

## [2025-05-15] (추가 작업)

### OpenAI API 요약 기능 구현
- [x] OpenAI 패키지 설치 (`npm install openai`)
- [x] summary.ts에 OpenAI API 호출 코드 구현
- [x] 시스템 프롬프트 설정 (학술적/캐주얼 내용에 따른 요약 스타일 조정)
- [x] 구조화된 카드 형태의 요약 포맷 구현

### 요약 결과 저장 기능 구현
- [x] actions.ts에 요약 결과를 파일 시스템에 저장하는 코드 추가
- [x] getSummary 함수와 연결하여 저장된 요약 가져오기 기능 구현

### 서버 액션 상태 공유 문제 해결
- [x] Map 객체 대신 파일 시스템 사용하여 요약 결과 저장 방식 변경
- [x] 요약 파일 저장 및 읽기 함수 구현

### 서버 액션 비동기 함수 변경
- [x] saveSummary 함수를 async 함수로 변경 (Server Actions must be async functions 오류 해결)
- [x] 비동기 파일 쓰기/읽기 사용 (fs.promises API 적용)

---

## [2025-06-02]

### React 무한 리렌더링 오류 해결
- [x] Select 컴포넌트의 onValueChange 핸들러에서 발생한 "Maximum update depth exceeded" 오류 수정
- [x] 타입 캐스팅 방식을 개선하여 무한 리렌더링 문제 해결 (1차 시도)
- [x] Radix UI Select 컴포넌트를 HTML select 엘리먼트로 교체하여 근본적 해결
- [x] reset-context.tsx에서 useCallback을 사용하여 함수 메모이제이션으로 무한 리렌더링 해결
- [x] 개발 서버 재시작 및 모든 오류 해결 확인

### React 무한 루프 오류 해결
- [x] Select 컴포넌트와 관련된 'Maximum update depth exceeded' 오류 수정
- [x] youtube-form.tsx에서 상태 업데이트 로직 개선
- [x] 상태 업데이트를 비동기적으로 분리하여 렌더링 사이클 충돌 방지

---

## Next Steps
- [x] 서버 액션 상태 공유 문제 해결 (Map 대신 파일 시스템 사용)
- [x] 유튜브 ID 추출 함수 방어 코드 추가(TypeError 방지)
- [ ] 실제 유튜브 영상으로 자막 가져오기 및 요약 기능 테스트
- [x] youtubei.js 패키지 설치 및 타입 선언 파일 추가 (Cannot find module 'youtubei.js' 오류 해결)
- [ ] 사용자 인터페이스 개선 (로딩 상태, 오류 처리 등)
- [ ] pnpm lockfile 오류 근본적 해결 (lockfile 재생성 및 커밋)
- [ ] 요약 결과를 영구적으로 저장하기 위한 DB 연동 구현 (파일 시스템 대신)

---

## [2025-06-02] (추가 작업)

### 페이지 네비게이션 및 UI 개선
- [x] 요약 완료 후 해당 비디오 요약 페이지로 자동 이동 기능 구현 (이미 구현되어 있음)
- [x] 모바일에서 히스토리 네비게이션 접힘 상태일 때 썸네일 숨기기 및 펼치기/접기 아이콘만 표시
- [x] 반응형 네비게이션 UI 개선
- [x] 모바일에서 사이드바 기본 접힘 상태로 설정
- [x] 모바일에서 접힌 사이드바는 fixed 포지션으로 오버레이 표시

### 구현된 기능 상세
1. **자동 페이지 이동**: 요약 완료 시 `router.push()` 를 통해 해당 비디오 요약 페이지로 자동 이동
2. **모바일 반응형 사이드바**: 
   - 768px 미만에서 모바일 모드 감지
   - 모바일에서는 기본적으로 접힌 상태로 시작
   - 접힌 상태에서는 썸네일 숨기고 아이콘만 표시
   - 접힌 사이드바는 fixed 포지션으로 오버레이 형태로 표시

### 추가 UI 개선 작업
- [x] 요약 완료 후 유튜브 링크 입력폼 초기화
- [x] 요약 완료 후 영상 디테일 표시 초기화  
- [x] 모바일에서 네비게이션 닫힌 상태일 때 히스토리 목록 숨기기 (열고 닫는 버튼만 표시)
- [x] 모바일에서 네비게이션 열린 상태일 때 전체 정보 표시

### 구현된 추가 기능 상세
1. **폼 초기화**: 요약 완료 후 YouTube URL 입력폼, 영상 정보, 요약 존재 상태, 오류 메시지 모두 초기화
2. **모바일 네비게이션 최적화**: 
   - 접힌 상태: 헤더의 토글 버튼만 표시, 모든 콘텐츠(히스토리 목록, 푸터) 숨김
   - 열린 상태: 전체 정보 표시 (제목, 새로운 요약 버튼, 히스토리 목록, 푸터)
