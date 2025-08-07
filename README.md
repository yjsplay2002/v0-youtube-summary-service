# YouTube Summary Service - Universal Monorepo

A comprehensive YouTube video summarization service built with Next.js, React Native, and shared TypeScript utilities.

## Project Structure

This is a monorepo containing four main packages:

```
youtube-summary-service/
├── packages/
│   ├── server/          # Next.js backend API server
│   ├── web/             # Next.js web client  
│   ├── mobile/          # React Native mobile app
│   └── shared/          # Shared TypeScript types and utilities
├── package.json         # Root workspace configuration
└── README.md
```

## Packages

### 🖥️ Server (`packages/server`)
- **Framework**: Next.js 15.2.4
- **Purpose**: Backend API server with database integration
- **Key Features**:
  - RESTful API endpoints for video summaries
  - Supabase database integration
  - YouTube transcript processing
  - RAG (Retrieval-Augmented Generation) support
  - Multi-language summary support

### 🌐 Web (`packages/web`)
- **Framework**: Next.js 15.2.4 (Client-only)
- **Purpose**: Web-based frontend client
- **Key Features**:
  - Responsive web interface
  - API client for server communication
  - Modern React with TypeScript
  - Tailwind CSS styling

### 📱 Mobile (`packages/mobile`)
- **Framework**: React Native with Expo
- **Purpose**: Native mobile application
- **Key Features**:
  - Cross-platform iOS/Android support
  - Native UI components
  - API client integration
  - Expo Router for navigation

### 📦 Shared (`packages/shared`)
- **Purpose**: Common types, utilities, and constants
- **Key Features**:
  - TypeScript type definitions
  - API response interfaces
  - Utility functions (YouTube URL parsing, date formatting, etc.)
  - Zod validation schemas

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- For mobile development: Expo CLI

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd v0-youtube-summary-service
```

2. Install dependencies:
```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### Development

#### Start the server:
```bash
npm run dev
# or
cd packages/server && npm run dev
```
Server runs on http://localhost:3000

#### Start the web client:
```bash
cd packages/web && npm run dev
```
Web client runs on http://localhost:3001

#### Start the mobile app:
```bash
cd packages/mobile && npm run start
```
Follow the Expo CLI instructions to run on iOS/Android simulator or device.

#### Build shared package:
```bash
cd packages/shared && npm run build
```

### Environment Variables

Create `.env.local` files in the server and web packages:

**packages/server/.env.local:**
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
```

**packages/web/.env.local:**
```
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

## API Endpoints

The server provides the following REST API endpoints:

- `GET /api/summaries` - Get paginated list of summaries
- `GET /api/video-summary-by-language` - Get summary for specific video/language
- `GET /api/video-languages` - Get available languages for a video
- `POST /api/rag/process-video` - Process video for RAG functionality
- `POST /api/add-to-my-summaries` - Add summary to user's collection

## Architecture

### Monorepo Benefits
- **Code Sharing**: Common types and utilities in `shared` package
- **Consistent Dependencies**: Centralized dependency management
- **Unified Development**: Single repository for all components
- **Type Safety**: Shared TypeScript definitions across all packages

### Communication Flow
```
Mobile App ──HTTP API──> Server ──Database──> Supabase
Web Client ──HTTP API──> Server ──Database──> Supabase
     │                      │
     └──shared types────────┘
```

## Scripts

### Root Level
- `npm run dev` - Start web development server
- `npm run build` - Build all packages
- `npm run start` - Start production server
- `npm run lint` - Run linting on all packages

### Package Level
Each package has its own scripts accessible via:
```bash
cd packages/<package-name>
npm run <script>
```

## Technologies

- **Frontend**: React, Next.js, TypeScript, Tailwind CSS
- **Mobile**: React Native, Expo, TypeScript
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT, Anthropic Claude
- **Validation**: Zod
- **Styling**: Tailwind CSS, Radix UI components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in the appropriate package(s)
4. Update shared types if needed
5. Test across all affected packages
6. Submit a pull request

## License

This project is licensed under the MIT License.
