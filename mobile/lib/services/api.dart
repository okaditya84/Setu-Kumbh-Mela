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

  Future<Map<String, dynamic>> announcement(String id, String language) async =>
      (_decode(await http.get(_u('/cases/$id/announcement', {'language': language}), headers: _headers)) as Map)
          .cast<String, dynamic>();

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

  Future<List<String>> geoLocations() async =>
      ((_decode(await http.get(_u('/geo/locations'), headers: _headers)) as Map)['locations'] as List).cast<String>();

  Future<Map<String, dynamic>> geoLayers() async => (_decode(await http.get(_u('/geo/layers'), headers: _headers)) as Map).cast<String, dynamic>();
  Future<List<dynamic>> geoCases() async => (_decode(await http.get(_u('/geo/cases', {'only_open': 'true'}), headers: _headers)) as Map)['cases'] as List;
  Future<List<dynamic>> geoHotspots() async => (_decode(await http.get(_u('/geo/hotspots'), headers: _headers)) as Map)['hotspots'] as List;

  Future<Map<String, dynamic>> syncPush(List<Map<String, dynamic>> cases) async =>
      (_decode(await http.post(_u('/sync/push'), headers: _headers, body: jsonEncode({'cases': cases}))) as Map).cast<String, dynamic>();

  Future<Map<String, dynamic>> adminMetrics() async => (_decode(await http.get(_u('/admin/metrics'), headers: _headers)) as Map).cast<String, dynamic>();
}

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}
