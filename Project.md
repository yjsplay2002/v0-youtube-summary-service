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

## Next Steps
- [x] 서버 액션 상태 공유 문제 해결 (Map 대신 파일 시스템 사용)
- [x] 유튜브 ID 추출 함수 방어 코드 추가(TypeError 방지)
- [ ] 실제 유튜브 영상으로 자막 가져오기 및 요약 기능 테스트 ← **다음 작업 제안**
- [ ] 사용자 인터페이스 개선 (로딩 상태, 오류 처리 등)
- [ ] 요약 결과를 영구적으로 저장하기 위한 DB 연동 구현 (파일 시스템 대신)
