# Setu — Mobile (Flutter)

Field app for volunteers: voice-first intake, cross-center matching, offline
queue + auto-sync, camera, voice samples, multilingual, map. Android now,
iOS-ready (same Dart code).

## First-time setup
This repo holds the Dart code (`lib/`) and `pubspec.yaml`. Generate the native
Android/iOS project shells once, then run:

```bash
cd mobile
flutter create . --org app.setu --platforms=android,ios   # generates android/ ios/
flutter pub get
```

Then add the permissions below (they aren't auto-added by `flutter create`).

### Android — `android/app/src/main/AndroidManifest.xml`
Add inside `<manifest>` (above `<application>`):
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```
Set `minSdkVersion` to **23** in `android/app/build.gradle` (speech/record need it).
To allow HTTP to a local backend during testing, add to the `<application>` tag:
`android:usesCleartextTraffic="true"`.

### iOS — `ios/Runner/Info.plist`
```xml
<key>NSMicrophoneUsageDescription</key><string>To record a voice description / sample.</string>
<key>NSSpeechRecognitionUsageDescription</key><string>To turn your spoken report into a form.</string>
<key>NSCameraUsageDescription</key><string>To photograph a found person for their family.</string>
<key>NSLocationWhenInUseUsageDescription</key><string>To show nearby help on the map.</string>
```

## Run

### On an Android phone over USB (what we use)
1. Enable **Developer options → USB debugging** on the phone, plug it in.
2. Start the backend on your laptop: `cd ../backend && uvicorn app.main:app --host 0.0.0.0`.
3. Tunnel the phone's localhost to the laptop so no IP config is needed:
   ```bash
   adb reverse tcp:8000 tcp:8000
   ```
4. Run with the API base pointing at the tunnel:
   ```bash
   flutter run --dart-define=API_BASE=http://127.0.0.1:8000
   ```

### Android emulator
```bash
flutter run --dart-define=API_BASE=http://10.0.2.2:8000
```

### Against the deployed backend
```bash
flutter run --dart-define=API_BASE=https://your-backend.onrender.com
```

**Demo logins:** `volunteer / volunteer123` · `admin / admin123`

## Architecture
- `lib/services/api.dart` — typed client for the same API the web app uses.
- `lib/services/local_db.dart` + `sync.dart` — sqflite offline queue, idempotent
  auto-sync on reconnect (by `client_uuid`).
- `lib/screens/intake_screen.dart` — the big voice button (on-device
  `speech_to_text` in any Indian locale) → `/intake/parse` → prefilled form → matches.
- `lib/screens/case_detail_screen.dart` — record/playback voice samples,
  multilingual announcement + TTS, anti-impersonation verify, reunion.
- `lib/screens/map_screen.dart` — `flutter_map` + OpenStreetMap (no key).
- `lib/i18n/strings.dart` — en/hi/mr UI; all Indian languages for voice + alerts.
