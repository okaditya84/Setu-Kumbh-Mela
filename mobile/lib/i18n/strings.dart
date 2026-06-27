import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// Lightweight i18n. UI ships in English/Hindi/Marathi (missing keys fall back
/// to English); every listed language is usable for voice + announcements.
class LangDef {
  final String code, label, speechLocale, announceName;
  final bool ui;
  const LangDef(this.code, this.label, this.speechLocale, this.announceName, this.ui);
}

const List<LangDef> kLanguages = [
  LangDef('en', 'English', 'en-IN', 'English', true),
  LangDef('hi', 'हिन्दी', 'hi-IN', 'Hindi', true),
  LangDef('mr', 'मराठी', 'mr-IN', 'Marathi', true),
  LangDef('bn', 'বাংলা', 'bn-IN', 'Bengali', false),
  LangDef('ta', 'தமிழ்', 'ta-IN', 'Tamil', false),
  LangDef('te', 'తెలుగు', 'te-IN', 'Telugu', false),
  LangDef('gu', 'ગુજરાતી', 'gu-IN', 'Gujarati', false),
  LangDef('kn', 'ಕನ್ನಡ', 'kn-IN', 'Kannada', false),
  LangDef('ml', 'മലയാളം', 'ml-IN', 'Malayalam', false),
  LangDef('pa', 'ਪੰਜਾਬੀ', 'pa-IN', 'Punjabi', false),
  LangDef('or', 'ଓଡ଼ିଆ', 'or-IN', 'Odia', false),
  LangDef('ur', 'اردو', 'ur-IN', 'Urdu', false),
];

const Map<String, Map<String, String>> _dicts = {
  'en': {
    'app.name': 'Setu',
    'app.tagline': 'Kumbh Lost & Found Network',
    'login.title': 'Sign in',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.error': 'Wrong username or password',
    'login.demo': 'Demo: volunteer / volunteer123 · admin / admin123',
    'nav.home': 'Home',
    'common.missing': 'Missing',
    'common.found': 'Found',
    'common.male': 'Male',
    'common.female': 'Female',
    'common.unknown': 'Unknown',
    'common.loading': 'Loading…',
    'common.offline': 'Offline — saved on device, will sync',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'home.greeting': 'Namaste',
    'home.reportMissing': 'Report a missing person',
    'home.reportFound': 'Register a found person',
    'home.map': 'Live map',
    'home.cases': 'All cases',
    'intake.tapToSpeak': 'Tap and speak',
    'intake.listening': 'Listening…',
    'intake.speakHint': 'Speak in any language — e.g. “elderly lady, white saree, ~65, speaks Marathi, lost near Ramkund”',
    'intake.fillManually': 'Or fill manually',
    'intake.name': 'Name',
    'intake.gender': 'Gender',
    'intake.age': 'Age group',
    'intake.language': 'Language',
    'intake.lastSeen': 'Last seen',
    'intake.description': 'Description',
    'intake.mobile': 'Family contact',
    'intake.photo': 'Photo',
    'intake.takePhoto': 'Take photo',
    'intake.secretQ': 'Secret question',
    'intake.secretA': 'Answer only family knows',
    'intake.submit': 'Find matches',
    'intake.scanning': 'Searching all centers…',
    'match.title': 'Possible matches',
    'match.strong': 'Strong match',
    'match.possible': 'Possible match',
    'match.weak': 'Weak match',
    'match.why': 'Why',
    'match.noMatches': 'No matches yet — report saved and searchable everywhere.',
    'match.confirmReunion': 'Confirm reunion',
    'match.reunited': 'Reunited! Both reports closed.',
    'case.announcement': 'Announcement',
    'case.makeAnnouncement': 'Make announcement',
    'case.play': 'Play aloud',
    'case.verify': 'Verify family',
    'case.markReunited': 'Mark reunited',
    'map.title': 'Live map',
    'lang.title': 'Language / भाषा',
  },
  'hi': {
    'app.tagline': 'कुंभ खोया-पाया नेटवर्क',
    'login.title': 'साइन इन करें',
    'login.username': 'यूज़रनेम',
    'login.password': 'पासवर्ड',
    'login.submit': 'साइन इन करें',
    'login.error': 'गलत यूज़रनेम या पासवर्ड',
    'nav.home': 'होम',
    'common.missing': 'लापता',
    'common.found': 'मिला',
    'common.male': 'पुरुष',
    'common.female': 'महिला',
    'common.unknown': 'अज्ञात',
    'common.loading': 'लोड हो रहा है…',
    'common.offline': 'ऑफ़लाइन — डिवाइस पर सहेजा, बाद में सिंक होगा',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'home.greeting': 'नमस्ते',
    'home.reportMissing': 'लापता व्यक्ति की रिपोर्ट करें',
    'home.reportFound': 'मिले व्यक्ति को दर्ज करें',
    'home.map': 'लाइव नक्शा',
    'home.cases': 'सभी मामले',
    'intake.tapToSpeak': 'दबाएँ और बोलें',
    'intake.listening': 'सुन रहे हैं…',
    'intake.speakHint': 'किसी भी भाषा में बोलें — जैसे “बुज़ुर्ग महिला, सफेद साड़ी, ~65, मराठी, रामकुंड के पास खोई”',
    'intake.fillManually': 'या स्वयं भरें',
    'intake.name': 'नाम',
    'intake.gender': 'लिंग',
    'intake.age': 'आयु वर्ग',
    'intake.language': 'भाषा',
    'intake.lastSeen': 'आख़िरी बार देखा',
    'intake.description': 'विवरण',
    'intake.mobile': 'परिवार संपर्क',
    'intake.photo': 'फ़ोटो',
    'intake.takePhoto': 'फ़ोटो लें',
    'intake.secretQ': 'गुप्त प्रश्न',
    'intake.secretA': 'उत्तर जो केवल परिवार जानता है',
    'intake.submit': 'मिलान खोजें',
    'intake.scanning': 'सभी केंद्रों में खोज रहे हैं…',
    'match.title': 'संभावित मिलान',
    'match.strong': 'मज़बूत मिलान',
    'match.possible': 'संभावित मिलान',
    'match.weak': 'कमज़ोर मिलान',
    'match.why': 'कारण',
    'match.noMatches': 'अभी कोई मिलान नहीं — रिपोर्ट सहेजी गई, हर केंद्र पर खोजी जा सकती है।',
    'match.confirmReunion': 'पुनर्मिलन की पुष्टि करें',
    'match.reunited': 'मिल गए! दोनों रिपोर्टें बंद।',
    'case.announcement': 'घोषणा',
    'case.makeAnnouncement': 'घोषणा बनाएँ',
    'case.play': 'ज़ोर से चलाएँ',
    'case.verify': 'परिवार सत्यापित करें',
    'case.markReunited': 'मिलाया गया चिह्नित करें',
    'map.title': 'लाइव नक्शा',
    'lang.title': 'भाषा / Language',
  },
  'mr': {
    'app.tagline': 'कुंभ हरवले-सापडले नेटवर्क',
    'login.title': 'साइन इन करा',
    'login.username': 'वापरकर्तानाव',
    'login.password': 'पासवर्ड',
    'login.submit': 'साइन इन करा',
    'login.error': 'चुकीचे वापरकर्तानाव किंवा पासवर्ड',
    'nav.home': 'मुख्यपृष्ठ',
    'common.missing': 'हरवलेले',
    'common.found': 'सापडलेले',
    'common.male': 'पुरुष',
    'common.female': 'स्त्री',
    'common.unknown': 'अज्ञात',
    'common.loading': 'लोड होत आहे…',
    'common.offline': 'ऑफलाइन — डिव्हाइसवर जतन, नंतर सिंक होईल',
    'common.cancel': 'रद्द करा',
    'common.confirm': 'खात्री करा',
    'home.greeting': 'नमस्कार',
    'home.reportMissing': 'हरवलेल्या व्यक्तीची नोंद करा',
    'home.reportFound': 'सापडलेल्या व्यक्तीची नोंद करा',
    'home.map': 'थेट नकाशा',
    'home.cases': 'सर्व प्रकरणे',
    'intake.tapToSpeak': 'दाबा आणि बोला',
    'intake.listening': 'ऐकत आहोत…',
    'intake.speakHint': 'कोणत्याही भाषेत बोला — उदा. “वृद्ध स्त्री, पांढरी साडी, ~65, मराठी, रामकुंडाजवळ हरवली”',
    'intake.fillManually': 'किंवा स्वतः भरा',
    'intake.name': 'नाव',
    'intake.gender': 'लिंग',
    'intake.age': 'वयोगट',
    'intake.language': 'भाषा',
    'intake.lastSeen': 'शेवटचे दिसले',
    'intake.description': 'वर्णन',
    'intake.mobile': 'कुटुंब संपर्क',
    'intake.photo': 'फोटो',
    'intake.takePhoto': 'फोटो काढा',
    'intake.secretQ': 'गुप्त प्रश्न',
    'intake.secretA': 'फक्त कुटुंबाला माहीत उत्तर',
    'intake.submit': 'जुळणी शोधा',
    'intake.scanning': 'सर्व केंद्रांमध्ये शोधत आहोत…',
    'match.title': 'संभाव्य जुळणी',
    'match.strong': 'मजबूत जुळणी',
    'match.possible': 'संभाव्य जुळणी',
    'match.weak': 'कमकुवत जुळणी',
    'match.why': 'कारण',
    'match.noMatches': 'अद्याप जुळणी नाही — नोंद जतन, सर्व केंद्रांवर शोधता येईल.',
    'match.confirmReunion': 'पुनर्भेटीची खात्री करा',
    'match.reunited': 'पुन्हा भेटले! दोन्ही नोंदी बंद.',
    'case.announcement': 'घोषणा',
    'case.makeAnnouncement': 'घोषणा तयार करा',
    'case.play': 'मोठ्याने वाजवा',
    'case.verify': 'कुटुंब पडताळा',
    'case.markReunited': 'पुन्हा भेटले म्हणून खूण करा',
    'map.title': 'थेट नकाशा',
    'lang.title': 'भाषा / Language',
  },
};

class AppStrings extends ChangeNotifier {
  String _code = 'en';
  // For languages not bundled (anything beyond en/hi/mr) we fetch the dictionary
  // live from the backend (LLM-translated + cached) and hold it here.
  Map<String, String>? _dynamic;
  String get code => _code;
  LangDef get lang => kLanguages.firstWhere((l) => l.code == _code, orElse: () => kLanguages[0]);

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    _code = p.getString('lang') ?? 'en';
    if (!_dicts.containsKey(_code)) await _loadDynamic(_code);
    notifyListeners();
  }

  Future<void> setCode(String c) async {
    _code = c;
    final p = await SharedPreferences.getInstance();
    await p.setString('lang', c);
    notifyListeners();
    if (!_dicts.containsKey(c)) await _loadDynamic(c);
  }

  Future<void> _loadDynamic(String c) async {
    final p = await SharedPreferences.getInstance();
    final cached = p.getString('dict.$c');
    if (cached != null) {
      _dynamic = Map<String, String>.from(jsonDecode(cached));
      notifyListeners();
      return;
    }
    try {
      final r = await http.get(Uri.parse('${Config.api}/i18n/$c')).timeout(const Duration(seconds: 90));
      if (r.statusCode == 200) {
        final d = (jsonDecode(r.body)['dict'] as Map).cast<String, String>();
        _dynamic = d;
        await p.setString('dict.$c', jsonEncode(d));
        notifyListeners();
      }
    } catch (_) {
      // stay on English fallback
    }
  }

  String t(String key) {
    if (_dicts.containsKey(_code)) {
      return _dicts[_code]?[key] ?? _dicts['en']![key] ?? key;
    }
    return _dynamic?[key] ?? _dicts['en']![key] ?? key;
  }
}
