# 🎉 TerritoryRun Mobile Apps - Setup Complete!

## ✅ What's Been Done

### 1. **Capacitor Configuration**
- Updated `capacitor.config.ts` with proper app ID and settings
- Configured for production builds
- Set up splash screen and Android schema

### 2. **Platform Initialization**
- ✅ **Android** platform added → `android/` directory
- ✅ **iOS** platform added → `ios/` directory
- ✅ Web assets built and synced → `dist/` directory

### 3. **NPM Scripts Added**
New commands available in `package.json`:
```json
"cap:sync": "cap sync",
"cap:build": "npm run build && cap sync",
"cap:open:android": "cap open android",
"cap:open:ios": "cap open ios",
"cap:run:android": "cap run android",
"cap:run:ios": "cap run ios",
"mobile:android": "npm run build && cap sync android && cap open android",
"mobile:ios": "npm run build && cap sync ios && cap open ios"
```

### 4. **Documentation Created**
- 📄 `MOBILE_QUICK_START.md` - Quick reference guide
- 📄 `MOBILE_SETUP.md` - Comprehensive mobile development guide

## 🚀 Ready to Build!

### For Android:
```bash
npm run mobile:android
```
This will:
1. Build the web app
2. Sync to Android
3. Open Android Studio

### For iOS (macOS only):
```bash
npm run mobile:ios
```
This will:
1. Build the web app
2. Sync to iOS
3. Open Xcode

## 📱 App Details

**App ID**: `com.territoryrun.app`  
**App Name**: TerritoryRun  
**Platforms**: Android 7.0+, iOS 13.0+

## 🔑 Key Features Ready for Mobile

1. **GPS Tracking** - High-accuracy location tracking
2. **Maps** - OpenStreetMap with territory overlays
3. **Real-time Distance** - Haversine formula calculations
4. **Territory System** - 50m buffer around running paths
5. **Color-coded Territories**:
   - 🔵 Blue - Your territories
   - 🟢 Green - Friends' territories
   - 🟣 Purple - Team members' territories
   - 🔴 Red - Other players' territories
6. **Authentication** - JWT-based secure login
7. **Social Features** - Friends and teams
8. **Competitions** - Compete with others

## ⚙️ Configuration Needed

### 1. Backend API URL
**File**: `src/lib/api.ts`

Update for mobile devices:
```typescript
// Android Emulator
const API_URL = 'http://10.0.2.2:4000';

// iOS Simulator
const API_URL = 'http://localhost:4000';

// Physical Devices
const API_URL = 'http://YOUR_IP:4000';
```

### 2. iOS Location Permissions
**File**: `ios/App/App/Info.plist`

Add:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TerritoryRun needs your location to track your runs and claim territory</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>TerritoryRun needs continuous location access to accurately track your running routes</string>
```

## 📦 Project Structure

```
territory-runner-main/
├── 📱 android/                    # Android Studio project
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── assets/public/     # Web assets
│   └── build.gradle
│
├── 📱 ios/                        # Xcode project
│   └── App/
│       ├── App.xcodeproj/
│       ├── App.xcworkspace/       # Open this in Xcode
│       └── App/
│           ├── Info.plist         # Add permissions here
│           └── public/            # Web assets
│
├── 🌐 src/                        # React source code
│   ├── components/
│   │   ├── RealTerritoryMap.tsx   # Map with territories
│   │   └── LiveRunMap.tsx         # Active run tracking
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── ActiveRun.tsx          # GPS tracking page
│   │   └── ...
│   └── lib/
│       ├── api.ts                 # API client (UPDATE HERE)
│       └── geoutils.ts            # GPS calculations
│
├── 🖥️ backend/                    # Node.js API
│   └── src/
│       ├── server.js
│       ├── runRoutes.js           # Territory acquisition
│       └── ...
│
├── 📦 dist/                       # Built web app
│   ├── index.html
│   └── assets/
│
├── ⚙️ capacitor.config.ts         # Mobile app config
├── 📱 package.json                # NPM scripts
└── 📚 MOBILE_QUICK_START.md       # Quick guide
```

## 🎯 Development Workflow

### Day-to-day development:

1. **Make changes** to React code in `src/`
2. **Test in browser**: `npm run dev`
3. **Build for mobile**: `npm run build`
4. **Sync to platforms**: `npx cap sync`
5. **Open and run**:
   - Android: `npm run cap:open:android`
   - iOS: `npm run cap:open:ios`

### Quick iteration:
```bash
# One command to build and open
npm run mobile:android
# or
npm run mobile:ios
```

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to backend"
**Solution**: Update API URL in `src/lib/api.ts` to use your computer's IP address

### Issue: GPS not working
**Solution**: 
- Grant location permissions in device settings
- For iOS: Add descriptions in Info.plist
- For Android: Permissions already configured in AndroidManifest.xml

### Issue: Build errors
**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
npx cap sync
```

## 📖 Next Steps

1. **Review Documentation**:
   - Read `MOBILE_QUICK_START.md` for quick commands
   - Read `MOBILE_SETUP.md` for detailed setup

2. **Configure API URL**:
   - Edit `src/lib/api.ts`
   - Set your development machine's IP

3. **Add iOS Permissions**:
   - Edit `ios/App/App/Info.plist`
   - Add location usage descriptions

4. **Open in IDE**:
   ```bash
   npm run mobile:android  # For Android
   npm run mobile:ios      # For iOS
   ```

5. **Run on Device/Simulator**:
   - Click Run button in Android Studio or Xcode
   - Test GPS tracking features

## 🚀 Deployment

### Google Play Store
- Build signed APK/Bundle in Android Studio
- Create developer account ($25 one-time)
- Upload and publish

### Apple App Store
- Archive in Xcode
- Submit via App Store Connect
- Requires Apple Developer Program ($99/year)

See `MOBILE_SETUP.md` for detailed deployment instructions.

## 🎊 You're All Set!

The TerritoryRun mobile apps are ready to build and test. Start with:

```bash
npm run mobile:android
```

Or for iOS:

```bash
npm run mobile:ios
```

Happy mobile development! 🏃‍♂️📱
