/// Data models mirroring the backend API contract (see docs/API.md).

class AuthInfo {
  final String accessToken;
  final String role;
  final String center;
  final String fullName;
  AuthInfo({required this.accessToken, required this.role, required this.center, required this.fullName});

  factory AuthInfo.fromJson(Map<String, dynamic> j) => AuthInfo(
        accessToken: j['access_token'] ?? '',
        role: j['role'] ?? 'volunteer',
        center: j['center'] ?? '',
        fullName: j['full_name'] ?? '',
      );

  Map<String, dynamic> toJson() =>
      {'access_token': accessToken, 'role': role, 'center': center, 'full_name': fullName};
}

class CaseDraft {
  String? clientUuid;
  String caseType; // missing | found
  String? personName, gender, ageBand, state, district, language;
  String? lastSeenLocation, physicalDescription, reportingCenter, reporterMobile;
  String? photoUrl, secretQuestion, secretAnswer, remarks;
  double? lastSeenLat, lastSeenLng;

  CaseDraft({this.caseType = 'found'});

  Map<String, dynamic> toJson() => {
        if (clientUuid != null) 'client_uuid': clientUuid,
        'case_type': caseType,
        'person_name': personName,
        'gender': gender,
        'age_band': ageBand,
        'state': state,
        'district': district,
        'language': language,
        'last_seen_location': lastSeenLocation,
        'last_seen_lat': lastSeenLat,
        'last_seen_lng': lastSeenLng,
        'physical_description': physicalDescription,
        'reporting_center': reportingCenter,
        'reporter_mobile': reporterMobile,
        'photo_url': photoUrl,
        'secret_question': secretQuestion,
        'secret_answer': secretAnswer,
        'remarks': remarks,
      };
}

class CaseOut {
  final String id, clientUuid, caseId, caseType, status;
  final String? personName, gender, ageBand, state, district, language;
  final String? lastSeenLocation, physicalDescription, reportingCenter, reporterMobileMasked, photoUrl, secretQuestion;
  final double? lastSeenLat, lastSeenLng;
  final bool hasSecret;
  final Map<String, dynamic> normalized;

  CaseOut.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        clientUuid = j['client_uuid'] ?? '',
        caseId = j['case_id'] ?? '',
        caseType = j['case_type'] ?? 'missing',
        status = j['status'] ?? 'Pending',
        personName = j['person_name'],
        gender = j['gender'],
        ageBand = j['age_band'],
        state = j['state'],
        district = j['district'],
        language = j['language'],
        lastSeenLocation = j['last_seen_location'],
        physicalDescription = j['physical_description'],
        reportingCenter = j['reporting_center'],
        reporterMobileMasked = j['reporter_mobile_masked'],
        photoUrl = j['photo_url'],
        secretQuestion = j['secret_question'],
        lastSeenLat = (j['last_seen_lat'] as num?)?.toDouble(),
        lastSeenLng = (j['last_seen_lng'] as num?)?.toDouble(),
        hasSecret = j['has_secret'] ?? false,
        normalized = (j['normalized'] as Map?)?.cast<String, dynamic>() ?? {};
}

class MatchCandidate {
  final CaseOut caseOut;
  final double score, probability;
  final String tier, explanation;
  final List<Map<String, dynamic>> breakdown;

  MatchCandidate.fromJson(Map<String, dynamic> j)
      : caseOut = CaseOut.fromJson(j['case']),
        score = (j['score'] as num).toDouble(),
        probability = (j['probability'] as num).toDouble(),
        tier = j['tier'] ?? 'weak',
        explanation = j['explanation'] ?? '',
        breakdown = (j['breakdown'] as List).cast<Map<String, dynamic>>();
}

class MatchResponse {
  final String queryCaseId;
  final List<MatchCandidate> candidates;
  final bool needsDisambiguation;
  final List<Map<String, dynamic>> disambiguationQuestions;
  final int totalConsidered;

  MatchResponse.fromJson(Map<String, dynamic> j)
      : queryCaseId = j['query_case_id'],
        candidates = (j['candidates'] as List).map((c) => MatchCandidate.fromJson(c)).toList(),
        needsDisambiguation = j['needs_disambiguation'] ?? false,
        disambiguationQuestions = (j['disambiguation_questions'] as List).cast<Map<String, dynamic>>(),
        totalConsidered = j['total_considered'] ?? 0;
}

class IntakeDraft {
  final String? caseType, personName, gender, ageBand, language, state, district, lastSeenLocation, physicalDescription;
  final List<String> colors, stable;
  IntakeDraft.fromJson(Map<String, dynamic> j)
      : caseType = j['case_type'],
        personName = j['person_name'],
        gender = j['gender'],
        ageBand = j['age_band'],
        language = j['language'],
        state = j['state'],
        district = j['district'],
        lastSeenLocation = j['last_seen_location'],
        physicalDescription = j['physical_description'],
        colors = (j['colors'] as List?)?.cast<String>() ?? [],
        stable = (j['stable'] as List?)?.cast<String>() ?? [];
}
