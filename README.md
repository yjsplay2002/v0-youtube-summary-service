# YouTube Summary Service

YouTube 동영상의 자막을 가져와서 AI를 활용해 요약을 생성하는 웹 애플리케이션입니다.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/yjsplay2002s-projects/v0-youtube-summary-service)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/yPhSPaVY9EE)

## 주요 기능

- 🎥 YouTube URL로부터 자동 자막 추출
- 🤖 AI를 활용한 동영상 요약 (Claude, GPT 지원)
- 🔐 Google OAuth를 통한 사용자 인증
- 👤 사용자별 개인 요약 히스토리 관리
- 📱 반응형 모바일 UI
- 🌙 다크/라이트 테마 지원
- 💾 Supabase 기반 데이터 저장

## 기술 스택

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Authentication**: Supabase Auth (Google OAuth)
- **Database**: Supabase (PostgreSQL)
- **AI Models**: Anthropic Claude, OpenAI GPT
- **Deployment**: Vercel

## 설치 및 설정

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/v0-youtube-summary-service.git
cd v0-youtube-summary-service
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 `.env.local`로 복사하고 필요한 값들을 설정하세요:

```bash
cp .env.example .env.local
```

### 4. Supabase 설정
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/001_create_video_summaries.sql` 실행
3. Authentication > Providers에서 Google OAuth 설정
4. 환경 변수에 Supabase URL과 Anon Key 추가

### 5. 개발 서버 실행
```bash
npm run dev
```

## 사용 방법

1. **로그인**: Google 계정으로 로그인
2. **요약 생성**: YouTube URL을 입력하고 요약 생성
3. **히스토리 확인**: 사이드바에서 이전 요약들 확인
4. **개인화**: 로그인한 사용자만 자신의 요약을 확인 가능

## 배포

Vercel에 배포된 버전: **[https://vercel.com/yjsplay2002s-projects/v0-youtube-summary-service](https://vercel.com/yjsplay2002s-projects/v0-youtube-summary-service)**

## 라이선스

MIT License