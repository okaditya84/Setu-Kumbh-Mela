import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/models.dart';

/// Thin API client. A single [token] is injected on every authenticated call.
class ApiClient {
  String? token;
  ApiClient({this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Uri _u(String path, [Map<String, String>? q]) => Uri.parse('${Config.api}$path').replace(queryParameters: q);

  dynamic _decode(http.Response r) {
    if (r.statusCode >= 200 && r.statusCode < 300) {
      return r.body.isEmpty ? null : jsonDecode(r.body);
    }
    String detail = r.reasonPhrase ?? 'Error ${r.statusCode}';
    try {
      detail = jsonDecode(r.body)['detail'] ?? detail;
    } catch (_) {}
    throw ApiException(r.statusCode, detail);
  }

  Future<AuthInfo> login(String username, String password) async {
    final r = await http.post(_u('/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}));
    return AuthInfo.fromJson(_decode(r));
  }

  Future<MatchResponse> createCase(CaseDraft d) async {
    final r = await http.post(_u('/cases'), headers: _headers, body: jsonEncode(d.toJson()));
    return MatchResponse.fromJson(_decode(r));
  }

  Future<List<CaseOut>> listCases({String? caseType, String? q, int limit = 60}) async {
    final params = {'limit': '$limit', if (caseType != null) 'case_type': caseType, if (q != null && q.isNotEmpty) 'q': q};
    final r = await http.get(_u('/cases', params), headers: _headers);
    return (_decode(r) as List).map((e) => CaseOut.fromJson(e)).toList();
  }

  Future<CaseOut> getCase(String id) async => CaseOut.fromJson(_decode(await http.get(_u('/cases/$id'), headers: _headers)));

  Future<MatchResponse> caseMatches(String id) async =>
      MatchResponse.fromJson(_decode(await http.get(_u('/cases/$id/matches'), headers: _headers)));

  Future<MatchResponse> refineCase(String id, Map<String, String> answer) async =>
      MatchResponse.fromJson(_decode(
          await http.post(_u('/cases/$id/refine'), headers: _headers, body: jsonEncode(answer))));

  Future<void> decideMatch(String missingId, String foundId, String decision) async {
    _decode(await http.post(_u('/matches/decide'),
        headers: _headers,
        body: jsonEncode({'missing_case_id': missingId, 'found_case_id': foundId, 'decision': decision})));
  }

  Future<CaseOut> updateStatus(String id, String status) async => CaseOut.fromJson(_decode(
      await http.patch(_u('/cases/$id/status'), headers: _headers, body: jsonEncode({'status': status}))));

  Future<IntakeDraft> parseText(String transcript, String? caseType) async {
    final r = await http.post(_u('/intake/parse'),
        headers: _headers, body: jsonEncode({'transcript': transcript, 'case_type': caseType}));
    return IntakeDraft.fromJson(_decode(r)['draft']);
  }

  /// Uploads recorded intake audio for server-side AUTO-DETECT transcription
  /// (language sent empty so the spoken language is detected independently of
  /// the UI language). Returns {transcript, draft, stt_available}.
  Future<Map<String, dynamic>> intakeVoice(Uint8List bytes, {String caseType = 'found'}) async {
    final req = http.MultipartRequest('POST', _u('/intake/voice'))
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['case_type'] = caseType
      ..fields['language'] = ''
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: 'intake.m4a'));
    final res = await http.Response.fromStream(await req.send());
    return (_decode(res) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> announcement(String id, String language) async =>
      (_decode(await http.get(_u('/cases/$id/announcement', {'language': language}), headers: _headers)) as Map)
          .cast<String, dynamic>();

  /// Server-side text-to-speech in the target [language]. Returns wav bytes,
  /// or null when the backend can't synthesise that language (HTTP 204).
  Future<Uint8List?> tts(String text, String language) async {
    final res = await http.post(_u('/tts'), headers: _headers, body: jsonEncode({'text': text, 'language': language}));
    if (res.statusCode == 204) return null;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, 'TTS failed');
    }
    return res.bodyBytes.isEmpty ? null : res.bodyBytes;
  }

  Future<Map<String, dynamic>> verify(String id, String answer) async =>
      (_decode(await http.post(_u('/cases/$id/verify'), headers: _headers, body: jsonEncode({'answer': answer}))) as Map)
          .cast<String, dynamic>();

  Future<Map<String, dynamic>> uploadVoice(String caseId, Uint8List bytes, {String kind = 'description', String language = ''}) async {
    final req = http.MultipartRequest('POST', _u('/cases/$caseId/voice'))
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['kind'] = kind
      ..fields['language'] = language
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: 'voice.m4a'));
    final res = await http.Response.fromStream(await req.send());
    return (_decode(res) as Map).cast<String, dynamic>();
  }

  Future<List<dynamic>> listVoice(String caseId) async => _decode(await http.get(_u('/cases/$caseId/voice'), headers: _headers)) as List;
  String audioUrl(String sampleId) => '${Config.api}/voice/$sampleId/audio';

  /// Fetches the raw audio bytes for a voice sample WITH the bearer token,
  /// so playback works for this protected endpoint (a plain URL source 401s).
  Future<Uint8List> audioBytes(String sampleId) async {
    final res = await http.get(_u('/voice/$sampleId/audio'), headers: _headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, 'Could not load audio');
    }
    return res.bodyBytes;
  }

  Future<List<String>> geoLocations() async =>
      ((_decode(await http.get(_u('/geo/locations'), headers: _headers)) as Map)['locations'] as List).cast<String>();

  Future<Map<String, dynamic>> geoLayers() async => (_decode(await http.get(_u('/geo/layers'), headers: _headers)) as Map).cast<String, dynamic>();
  Future<List<dynamic>> geoCases() async => (_decode(await http.get(_u('/geo/cases', {'only_open': 'true'}), headers: _headers)) as Map)['cases'] as List;
  Future<List<dynamic>> geoHotspots() async => (_decode(await http.get(_u('/geo/hotspots'), headers: _headers)) as Map)['hotspots'] as List;

  Future<Map<String, dynamic>> syncPush(List<Map<String, dynamic>> cases) async =>
      (_decode(await http.post(_u('/sync/push'), headers: _headers, body: jsonEncode({'cases': cases}))) as Map).cast<String, dynamic>();

  Future<Map<String, dynamic>> adminMetrics() async => (_decode(await http.get(_u('/admin/metrics'), headers: _headers)) as Map).cast<String, dynamic>();

  // ---- Center notifications ----

  Future<List<NotificationItem>> listNotifications() async {
    final data = (_decode(await http.get(_u('/notifications'), headers: _headers)) as Map)['notifications'] as List? ?? [];
    return data.map((e) => NotificationItem.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<int> unreadCount() async =>
      ((_decode(await http.get(_u('/notifications/unread-count'), headers: _headers)) as Map)['count'] as num?)?.toInt() ?? 0;

  Future<void> markRead(String id) async {
    _decode(await http.post(_u('/notifications/$id/read'), headers: _headers));
  }

  Future<void> markAllRead() async {
    _decode(await http.post(_u('/notifications/read-all'), headers: _headers));
  }
}

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}
