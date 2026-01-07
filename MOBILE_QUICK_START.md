# Mobile App - Quick Start Guide

## ✅ Setup Complete!

Both Android and iOS platforms have been initialized. The mobile apps are ready to build!

## 📱 Next Steps

### Android Development

#### Open in Android Studio
```bash
npm run cap:open:android
```

Or manually:
```bash
cd android
```
Then open the `android` folder in Android Studio.

#### Run on Device/Emulator
1. Connect Android device via USB (with USB debugging enabled)
2. OR start Android Emulator from Android Studio
3. Click the green "Run" button in Android Studio

### iOS Development (macOS only)

#### Open in Xcode
```bash
npm run cap:open:ios
```

Or manually open `ios/App/App.xcworkspace` in Xcode.

#### Run on Device/Simulator
1. Select a simulator or connect iOS device
2. Click the "Run" button (▶️) in Xcode
3. For physical devices: Configure signing in Project Settings

## 🔄 Development Workflow

### After Making Code Changes

1. **Build the web app**:
   ```bash
   npm run build
   ```

2. **Sync to mobile**:
   ```bash
   npx cap sync
   ```

3. **Or use the combined command**:
   ```bash
   npm run cap:build
   ```

### Quick Commands

| Command | Description |
|---------|-------------|
| `npm run mobile:android` | Build + open Android Studio |
| `npm run mobile:ios` | Build + open Xcode |
| `npm run cap:build` | Build web + sync both platforms |
| `npm run cap:sync` | Sync changes to both platforms |

## 🔧 Important Configuration

### Backend API Connection

The app currently points to `http://localhost:4000`. For mobile devices:

**Edit `src/lib/api.ts`**:

```typescript
// For Android Emulator
const API_URL = 'http://10.0.2.2:4000';

// For iOS Simulator  
const API_URL = 'http://localhost:4000';

// For Physical Devices (use your computer's IP)
const API_URL = 'http://YOUR_COMPUTER_IP:4000';
```

Find your IP:
- Mac/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- Windows: `ipconfig`

### GPS Permissions

#### Android
Permissions are auto-configured in `android/app/src/main/AndroidManifest.xml`:
- `ACCESS_FINE_LOCATION` ✅
- `ACCESS_COARSE_LOCATION` ✅

#### iOS
Add to `ios/App/App/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TerritoryRun needs your location to track runs</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>TerritoryRun needs continuous location for accurate tracking</string>
```

## 🐛 Troubleshooting

### "Cannot connect to API"
1. Ensure backend is running: `cd backend && npm run dev`
2. Check API_URL matches your setup
3. For physical devices, use computer's IP address
4. Ensure device is on same WiFi network

### Android Build Errors
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### iOS Build Errors
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
npx cap sync ios
```

### GPS Not Working
- Grant location permissions in device settings
- Android: Settings > Apps > TerritoryRun > Permissions
- iOS: Settings > Privacy > Location Services

## 📚 Full Documentation

See [MOBILE_SETUP.md](MOBILE_SETUP.md) for complete mobile development guide including:
- Detailed Android/iOS setup requirements
- Production build instructions
- App Store deployment guide
- Testing GPS on simulators/emulators

## 🎯 Project Structure

```
territory-runner-main/
├── android/          # Android Studio project
├── ios/              # Xcode project  
├── dist/             # Built web assets (synced to mobile)
├── src/              # React source code
├── backend/          # Node.js API server
└── capacitor.config.ts  # Mobile app configuration
```

## 🚀 Current Features

- ✅ GPS-accurate run tracking
- ✅ Real-time distance calculation
- ✅ Territory claiming system
- ✅ Interactive maps (OpenStreetMap)
- ✅ Friend/team territory colors
- ✅ User authentication
- ✅ Leaderboard
- ✅ Competitions

Happy building! 🏃‍♂️📱
