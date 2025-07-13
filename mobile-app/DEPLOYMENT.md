# Mobile App Deployment Guide

This document provides comprehensive instructions for building, deploying, and distributing the YouTube Summarizer mobile app for iOS and Android platforms.

## Prerequisites

### Development Environment
- **Node.js** 18+ with npm/yarn
- **Expo CLI** (`npm install -g @expo/cli`)
- **EAS CLI** (`npm install -g eas-cli`)
- **Git** for version control

### Platform-specific Requirements

#### iOS Development
- **macOS** (required for iOS builds)
- **Xcode** 13+ with iOS SDK
- **Apple Developer Account** ($99/year for App Store distribution)
- **iOS Simulator** (included with Xcode)

#### Android Development
- **Android Studio** with Android SDK
- **Java Development Kit (JDK)** 8+
- **Google Play Console Account** ($25 one-time fee)
- **Android Emulator** or physical device

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the mobile-app directory:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Web App API URL
EXPO_PUBLIC_WEB_APP_URL=https://your-deployed-web-app.com

# App Configuration
EXPO_PUBLIC_APP_NAME=YouTube Summarizer
EXPO_PUBLIC_APP_VERSION=1.0.0
```

### 2. Install Dependencies

```bash
cd mobile-app
npm install
```

### 3. Development Testing

Test the app on different platforms:

```bash
# Start the development server
npm start

# Test on specific platforms
npm run ios     # iOS Simulator (macOS only)
npm run android # Android Emulator
npm run web     # Web browser (for testing)
```

## Building for Production

### 1. Configure EAS Build

Initialize EAS configuration:

```bash
eas init
eas build:configure
```

This creates an `eas.json` configuration file.

### 2. Update app.json

Ensure your `app.json` contains production-ready configuration:

```json
{
  "expo": {
    "name": "YouTube Summarizer",
    "slug": "youtube-summarizer-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#007AFF"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.youtubesummarizer.mobile"
    },
    "android": {
      "package": "com.youtubesummarizer.mobile"
    }
  }
}
```

### 3. Build for Platforms

#### Android Build

```bash
# Build APK for internal testing
eas build --platform android --profile preview

# Build AAB for Google Play Store
eas build --platform android --profile production
```

#### iOS Build

```bash
# Build for TestFlight
eas build --platform ios --profile preview

# Build for App Store
eas build --platform ios --profile production
```

## App Store Distribution

### Google Play Store (Android)

1. **Create Google Play Console Account**
   - Visit [Google Play Console](https://play.google.com/console)
   - Pay $25 one-time registration fee

2. **Upload App Bundle**
   - Create new application in console
   - Upload the AAB file from EAS build
   - Complete store listing information

3. **Configure App Details**
   - App description and screenshots
   - Privacy policy and terms of service
   - Content rating and target audience

4. **Submit for Review**
   - Complete all required sections
   - Submit for review (typically 24-48 hours)

### Apple App Store (iOS)

1. **Apple Developer Account**
   - Register at [Apple Developer](https://developer.apple.com)
   - Pay $99 annual fee

2. **App Store Connect**
   - Create new app in [App Store Connect](https://appstoreconnect.apple.com)
   - Configure app information and metadata

3. **Upload Build**
   - Use the IPA file from EAS build
   - Upload via Xcode or Transporter app

4. **Submit for Review**
   - Complete app information
   - Submit for review (typically 24-48 hours)

## Testing and Quality Assurance

### Testing Strategies

1. **Device Testing**
   - Test on multiple device sizes (phones/tablets)
   - Test on different OS versions
   - Test with different network conditions

2. **Functionality Testing**
   - YouTube URL input validation
   - Video summarization workflow
   - Authentication flow
   - Summary history and display

3. **Performance Testing**
   - App startup time
   - API response handling
   - Memory usage monitoring

### Beta Testing

#### Android (Google Play Console)

1. **Internal Testing**
   - Upload APK to internal testing track
   - Add test users via email

2. **Closed Testing**
   - Create closed testing track
   - Distribute via Play Store link

#### iOS (TestFlight)

1. **TestFlight Distribution**
   - Upload build to App Store Connect
   - Add beta testers via email
   - Distribute via TestFlight app

## Continuous Integration/Deployment

### GitHub Actions Setup

Create `.github/workflows/mobile-build.yml`:

```yaml
name: Mobile App Build

on:
  push:
    branches: [mobile]
  pull_request:
    branches: [mobile]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd mobile-app
        npm install
        
    - name: Run tests
      run: |
        cd mobile-app
        npm test
        
    - name: Build for EAS
      run: |
        cd mobile-app
        npx eas build --platform all --non-interactive
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

## Monitoring and Analytics

### Crash Reporting

Install crash reporting:

```bash
npx expo install expo-crash-analytics
```

### Performance Monitoring

Consider integrating:
- **Sentry** for error tracking
- **Firebase Analytics** for user behavior
- **Bugsnag** for crash reporting

## Maintenance and Updates

### Over-the-Air (OTA) Updates

Use Expo Updates for non-native changes:

```bash
# Publish update
eas update --branch production --message "Bug fixes and improvements"
```

### Native Updates

For changes requiring native code updates:
1. Increment version in `app.json`
2. Build new binary with EAS
3. Submit to app stores

## Security Considerations

### API Security
- Use environment variables for sensitive data
- Implement proper authentication headers
- Validate all user inputs

### App Security
- Enable code obfuscation for production builds
- Implement certificate pinning for API calls
- Use secure storage for sensitive data

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check EAS build logs
   - Verify all dependencies are compatible
   - Ensure environment variables are set

2. **Supabase Connection Issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review authentication flow

3. **YouTube API Issues**
   - Verify video URL parsing
   - Check API endpoint availability
   - Monitor rate limits

### Debug Tools

- **React Native Debugger** for debugging
- **Flipper** for network inspection
- **EAS CLI logs** for build issues

## Support and Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Mobile Documentation](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://support.google.com/googleplay/android-developer/answer/9858738)