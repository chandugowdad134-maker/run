# TerritoryRun - Mobile App Setup Guide

## Prerequisites

### For Android Development
- **Android Studio** (latest version)
  - Download from: https://developer.android.com/studio
  - Install Android SDK (API 33+)
  - Install Android SDK Build-Tools
  - Set up Android Virtual Device (AVD) for testing

### For iOS Development (macOS only)
- **Xcode** (latest version from App Store)
- **CocoaPods** (install with: `sudo gem install cocoapods`)
- **Apple Developer Account** (for device testing/deployment)

## Quick Start

### 1. Build the Web App
```bash
npm run build
```

### 2. Initialize Mobile Platforms (First Time Only)
```bash
# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios
```

### 3. Update Mobile Apps (After Code Changes)
```bash
# Sync all platforms
npm run cap:sync

# Or sync specific platform
npx cap sync android
npx cap sync ios
```

## Development Workflow

### Android Development

#### Option 1: Using Android Studio
```bash
# Build and open in Android Studio
npm run mobile:android
```

Then in Android Studio:
1. Select device/emulator
2. Click Run button (green play icon)

#### Option 2: Direct Run (with connected device)
```bash
npm run cap:run:android
```

### iOS Development (macOS only)

#### Option 1: Using Xcode
```bash
# Build and open in Xcode
npm run mobile:ios
```

Then in Xcode:
1. Select simulator/device
2. Click Run button
3. For physical device: Set up signing in Project > Signing & Capabilities

#### Option 2: Direct Run
```bash
npm run cap:run:ios
```

## Important Configurations

### GPS/Location Permissions

#### Android (`android/app/src/main/AndroidManifest.xml`)
Already configured in capacitor, but verify these permissions exist:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

#### iOS (`ios/App/App/Info.plist`)
Add these keys:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TerritoryRun needs your location to track your runs and claim territory</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>TerritoryRun needs continuous location access to accurately track your running routes</string>
```

### Backend API Connection

For local development, update the API URL in your `.env` or `src/lib/api.ts`:

```typescript
// For Android Emulator (connects to host machine)
const API_URL = 'http://10.0.2.2:4000';

// For iOS Simulator (connects to host machine)
const API_URL = 'http://localhost:4000';

// For physical devices (use your computer's IP)
const API_URL = 'http://192.168.1.XXX:4000';
```

To find your IP address:
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

## NPM Scripts Reference

### Build & Sync
- `npm run cap:build` - Build web app and sync to all platforms
- `npm run cap:sync` - Sync changes to all platforms
- `npm run build` - Build web app only

### Open in IDE
- `npm run cap:open:android` - Open Android Studio
- `npm run cap:open:ios` - Open Xcode

### Run on Device
- `npm run cap:run:android` - Run on Android device/emulator
- `npm run cap:run:ios` - Run on iOS device/simulator

### All-in-One Commands
- `npm run mobile:android` - Build, sync, and open Android Studio
- `npm run mobile:ios` - Build, sync, and open Xcode

## Building for Production

### Android APK/Bundle

1. Open Android Studio: `npm run cap:open:android`
2. **Build > Generate Signed Bundle / APK**
3. Follow wizard to create keystore (first time)
4. Choose **Android App Bundle** (for Play Store) or **APK**
5. Select **release** build type
6. Output: `android/app/build/outputs/`

### iOS IPA

1. Open Xcode: `npm run cap:open:ios`
2. Select **Any iOS Device** or your connected device
3. **Product > Archive**
4. Once archived, click **Distribute App**
5. Choose distribution method (App Store, Ad Hoc, etc.)
6. Follow wizard for signing and export

## Testing GPS Features

### Android Emulator
1. Open Extended Controls (... button)
2. Go to Location tab
3. Enter coordinates or use map to simulate location
4. Enable "Save point" to create a route

### iOS Simulator
1. **Debug > Location > Custom Location**
2. Enter latitude/longitude
3. Or use **Debug > Location > City Run** for simulated movement

## Troubleshooting

### "Unable to connect to API"
- Check backend is running: `cd backend && npm run dev`
- Verify API URL matches your network setup
- Check device/emulator has internet access
- For physical devices, ensure same WiFi network

### GPS not working
- Check permissions granted in device settings
- Android: Settings > Apps > TerritoryRun > Permissions
- iOS: Settings > Privacy > Location Services

### Build errors
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
npx cap sync
```

### Android Gradle issues
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### iOS CocoaPods issues
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
npx cap sync ios
```

## App Store Deployment

### Google Play Store
1. Create developer account ($25 one-time fee)
2. Generate signed bundle (see above)
3. Create app listing in Play Console
4. Upload bundle
5. Complete store listing (screenshots, description)
6. Submit for review

### Apple App Store
1. Enroll in Apple Developer Program ($99/year)
2. Create App ID in developer portal
3. Create app in App Store Connect
4. Archive and distribute via Xcode (see above)
5. Complete app metadata
6. Submit for review

## Native Features Used

- **Geolocation**: High-accuracy GPS tracking
- **Background execution**: Continued tracking during runs
- **Camera** (future): Profile photos, territory photos
- **Push notifications** (future): Friend challenges, territory attacks

## Performance Tips

- GPS tracking runs efficiently in background
- Map tiles cached for offline viewing
- API calls optimized with request batching
- Database queries use spatial indexes

## Support

For Capacitor-specific issues:
- Documentation: https://capacitorjs.com/docs
- iOS Setup: https://capacitorjs.com/docs/ios
- Android Setup: https://capacitorjs.com/docs/android
