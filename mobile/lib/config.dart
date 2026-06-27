/// Runtime config. Override the API base at launch with:
///   flutter run --dart-define=API_BASE=http://10.0.2.2:8000
///
/// Tips:
///   * Android emulator -> host machine: http://10.0.2.2:8000
///   * Physical phone over USB:  run `adb reverse tcp:8000 tcp:8000`
///     once, then use http://127.0.0.1:8000 (the phone tunnels to your laptop).
///   * Production: your Render URL, e.g. https://setu-backend.onrender.com
class Config {
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    // Physical device over USB (requires: adb reverse tcp:8000 tcp:8000)
    // For Android emulator use: http://10.0.2.2:8000
    defaultValue: 'http://127.0.0.1:8000',
  );
  static String get api => '$apiBase/api/v1';

  static const double defaultLat = 19.9975;
  static const double defaultLng = 73.7898;
  static const double defaultZoom = 12;

  static const List<String> ageBands = [
    '0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+'
  ];
  static const List<String> genders = ['Male', 'Female', 'Unknown'];
}
