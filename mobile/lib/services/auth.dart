import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'api.dart';

/// Holds the session and a configured [ApiClient]. Token persists across launches.
class AuthProvider extends ChangeNotifier {
  AuthInfo? _auth;
  final ApiClient api = ApiClient();

  AuthInfo? get auth => _auth;
  bool get isLoggedIn => _auth != null;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString('auth');
    if (raw != null) {
      _auth = AuthInfo.fromJson(jsonDecode(raw));
      api.token = _auth!.accessToken;
    }
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final info = await api.login(username, password);
    _auth = info;
    api.token = info.accessToken;
    final p = await SharedPreferences.getInstance();
    await p.setString('auth', jsonEncode(info.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    _auth = null;
    api.token = null;
    final p = await SharedPreferences.getInstance();
    await p.remove('auth');
    notifyListeners();
  }
}
