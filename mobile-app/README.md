# YouTube Summarizer Mobile App

A React Native mobile application that provides AI-powered YouTube video summarization for iOS and Android platforms.

## Features

- 🎥 YouTube video URL input and validation
- 🤖 AI-powered video summarization using multiple models
- 📱 Native iOS and Android support
- 🔐 User authentication with Supabase
- 📊 Video summary history and management
- 🌐 Multi-language support

## Technology Stack

- **React Native** with Expo for cross-platform development
- **TypeScript** for type safety
- **Supabase** for backend and authentication
- **Expo Router** for navigation (to be implemented)

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Installation

1. Navigate to the mobile app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Supabase:
   - Update `src/lib/supabase.ts` with your Supabase project URL and API key
   - Ensure your Supabase project has the same database schema as the web app

4. Start the development server:
   ```bash
   npm start
   ```

5. Run on your preferred platform:
   ```bash
   # iOS (requires macOS and Xcode)
   npm run ios
   
   # Android (requires Android Studio)
   npm run android
   
   # Web (for testing)
   npm run web
   ```

## Project Structure

```
mobile-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── YouTubeForm.tsx
│   │   └── SummaryDisplay.tsx
│   ├── screens/             # Screen components
│   │   ├── HomeScreen.tsx
│   │   └── AuthScreen.tsx
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx
│   ├── api/                 # API service functions
│   │   └── video-service.ts
│   ├── lib/                 # Utility libraries
│   │   ├── supabase.ts
│   │   └── youtube-utils.ts
│   └── types/               # TypeScript type definitions
│       └── index.ts
├── App.tsx                  # Main app component
├── app.json                 # Expo configuration
└── package.json             # Dependencies and scripts
```

## Current Implementation Status

### ✅ Completed
- Basic React Native app structure with Expo
- Authentication system with Supabase
- YouTube URL input and validation
- Video summary display interface
- User interface for summary history
- TypeScript type definitions
- Basic navigation flow

### 🚧 In Progress / TODO
- API integration with backend summarization service
- Video player integration
- Advanced navigation with Expo Router
- Multi-language summary support
- Offline storage capabilities
- Push notifications
- Video thumbnail caching

## Key Components

### YouTubeForm
Handles YouTube URL input and triggers video summarization.

### SummaryDisplay
Displays video summary with metadata and provides link to original video.

### AuthScreen
Handles user authentication (sign in/sign up) with Supabase.

### HomeScreen
Main screen showing the YouTube form and user's summary history.

## Supabase Integration

The mobile app uses the same Supabase backend as the web application, ensuring data consistency across platforms. Key features:

- User authentication
- Video summary storage and retrieval
- Real-time updates (to be implemented)

## Building for Production

### Android
```bash
expo build:android
```

### iOS
```bash
expo build:ios
```

Note: For production builds, you'll need to configure signing certificates and app store credentials.

## Contributing

This mobile app is part of the larger YouTube Summarizer project. When contributing:

1. Maintain consistency with the web app's functionality
2. Follow React Native best practices
3. Ensure TypeScript types are properly defined
4. Test on both iOS and Android platforms

## Known Issues

- API integration is not yet complete (placeholder implementation)
- Video player component needs implementation
- Some advanced features from the web app are not yet ported

## Future Enhancements

- Offline mode with local storage
- Push notifications for summary completion
- Video sharing capabilities
- Advanced filtering and search
- Settings and preferences screen
- Dark mode support