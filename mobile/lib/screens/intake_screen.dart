import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:uuid/uuid.dart';

import '../config.dart';
import '../i18n/strings.dart';
import '../models/models.dart';
import '../services/auth.dart';
import '../services/local_db.dart';
import '../services/sync.dart';
import '../theme.dart';
import '../widgets/match_card.dart';
import '../widgets/responsive.dart';
import 'case_detail_screen.dart';

class IntakeScreen extends StatefulWidget {
  final String caseType;
  const IntakeScreen({super.key, required this.caseType});
  @override
  State<IntakeScreen> createState() => _IntakeScreenState();
}

class _IntakeScreenState extends State<IntakeScreen> {
  final _stt = SpeechToText();
  final _rec = AudioRecorder();
  final _draft = CaseDraft();
  final _picker = ImagePicker();
  bool _sttReady = false, _listening = false, _recording = false, _submitting = false, _parsing = false;
  String _heard = '';
  String? _photoB64;
  MatchResponse? _matches;
  bool _savedOffline = false, _reunited = false;

  // text controllers
  final _name = TextEditingController();
  final _desc = TextEditingController();
  final _mobile = TextEditingController();

  @override
  void initState() {
    super.initState();
    _draft.caseType = widget.caseType;
    _stt.initialize(onStatus: (s) {
      if (s == 'done' || s == 'notListening') setState(() => _listening = false);
    }).then((ok) => setState(() => _sttReady = ok));
  }

  @override
  void dispose() {
    _rec.dispose();
    super.dispose();
  }

  /// Big voice button. We RECORD the audio and let the server auto-detect the
  /// spoken language — independent of the UI language — so the reporter can
  /// speak any language. On-device speech_to_text is only an offline fallback.
  Future<void> _toggleRecord() async {
    if (_recording) {
      String? path;
      try {
        path = await _rec.stop();
      } catch (_) {}
      setState(() => _recording = false);
      if (path != null) await _transcribeRecording(path);
      return;
    }
    if (_listening) {
      // Tapping again while the STT fallback is running stops it.
      await _stt.stop();
      setState(() => _listening = false);
      await _parseTranscript(_heard);
      return;
    }
    if (!await _rec.hasPermission()) {
      await _startOnDeviceFallback();
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      final path = p.join(dir.path, 'intake_${DateTime.now().millisecondsSinceEpoch}.m4a');
      await _rec.start(const RecordConfig(), path: path);
      setState(() {
        _recording = true;
        _heard = '';
      });
    } catch (_) {
      await _startOnDeviceFallback();
    }
  }

  /// Sends recorded audio to the server for auto-detect transcription + draft.
  /// Falls back to on-device speech_to_text if the server call fails.
  Future<void> _transcribeRecording(String path) async {
    setState(() => _parsing = true);
    try {
      final api = context.read<AuthProvider>().api;
      final bytes = await File(path).readAsBytes();
      final res = await api.intakeVoice(bytes, caseType: widget.caseType);
      final transcript = res['transcript']?.toString() ?? '';
      final draft = res['draft'] as Map?;
      setState(() {
        _heard = transcript;
        if (draft != null) _applyDraft(IntakeDraft.fromJson(draft.cast<String, dynamic>()), transcript);
      });
    } catch (_) {
      // No connectivity / server STT unavailable -> on-device fallback.
      await _startOnDeviceFallback();
    } finally {
      if (mounted) setState(() => _parsing = false);
    }
  }

  /// On-device speech_to_text fallback. We deliberately do NOT force the UI
  /// language as the spoken language — leave localeId unset so the device
  /// default is used.
  Future<void> _startOnDeviceFallback() async {
    if (!_sttReady) return;
    setState(() {
      _listening = true;
      _heard = '';
    });
    await _stt.listen(
      listenOptions: SpeechListenOptions(partialResults: true),
      onResult: (r) => setState(() => _heard = r.recognizedWords),
    );
  }

  Future<void> _parseTranscript(String transcript) async {
    if (transcript.trim().isEmpty) return;
    setState(() => _parsing = true);
    try {
      final api = context.read<AuthProvider>().api;
      final d = await api.parseText(transcript, widget.caseType);
      setState(() => _applyDraft(d, transcript));
    } catch (_) {
      _desc.text = transcript;
    } finally {
      if (mounted) setState(() => _parsing = false);
    }
  }

  /// Prefills the form from a parsed draft (shared by server + on-device paths).
  void _applyDraft(IntakeDraft d, String transcript) {
    _name.text = d.personName ?? _name.text;
    _draft.gender = d.gender ?? _draft.gender;
    _draft.ageBand = d.ageBand ?? _draft.ageBand;
    _draft.language = d.language ?? _draft.language;
    _draft.state = d.state ?? _draft.state;
    _draft.lastSeenLocation = d.lastSeenLocation ?? _draft.lastSeenLocation;
    _desc.text = d.physicalDescription ?? (transcript.isNotEmpty ? transcript : _desc.text);
  }

  Future<void> _takePhoto() async {
    final img = await _picker.pickImage(source: ImageSource.camera, maxWidth: 640, imageQuality: 70);
    if (img == null) return;
    final bytes = await img.readAsBytes();
    setState(() => _photoB64 = 'data:image/jpeg;base64,${base64Encode(bytes)}');
  }

  /// True when the report has no usable identifying data at all, so we should
  /// not let a blank report be submitted to the matcher.
  bool get _isEmpty =>
      _name.text.trim().isEmpty &&
      _desc.text.trim().isEmpty &&
      _draft.gender == null &&
      _draft.ageBand == null &&
      (_draft.language == null || _draft.language!.isEmpty) &&
      (_draft.state == null || _draft.state!.isEmpty) &&
      (_draft.lastSeenLocation == null || _draft.lastSeenLocation!.isEmpty) &&
      _photoB64 == null;

  Future<void> _submit() async {
    if (_isEmpty) return;
    setState(() => _submitting = true);
    _draft
      ..clientUuid = const Uuid().v4()
      ..personName = _name.text.trim().isEmpty ? null : _name.text.trim()
      ..physicalDescription = _desc.text.trim().isEmpty ? null : _desc.text.trim()
      ..reporterMobile = _mobile.text.trim().isEmpty ? null : _mobile.text.trim()
      ..photoUrl = _photoB64;
    final sync = context.read<SyncService>();
    final api = context.read<AuthProvider>().api;
    try {
      if (!sync.online) {
        await LocalDb.enqueue(_draft.clientUuid!, _draft.toJson());
        await sync.refresh();
        setState(() => _savedOffline = true);
        return;
      }
      final res = await api.createCase(_draft);
      setState(() => _matches = res);
    } catch (_) {
      await LocalDb.enqueue(_draft.clientUuid!, _draft.toJson());
      await sync.refresh();
      setState(() => _savedOffline = true);
    } finally {
      setState(() => _submitting = false);
    }
  }

  Future<void> _refine(String field, String value) async {
    if (_matches == null) return;
    final key = field == 'stable' ? 'add_stable' : field;
    setState(() => _submitting = true);
    try {
      final res = await context.read<AuthProvider>().api.refineCase(_matches!.queryCaseId, {key: value});
      setState(() => _matches = res);
    } finally {
      setState(() => _submitting = false);
    }
  }

  Future<void> _confirm(String candidateId) async {
    final api = context.read<AuthProvider>().api;
    final created = _matches!.queryCaseId;
    final missing = widget.caseType == 'missing' ? created : candidateId;
    final found = widget.caseType == 'found' ? created : candidateId;
    await api.decideMatch(missing, found, 'confirm');
    setState(() => _reunited = true);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    final title = widget.caseType == 'missing' ? t('home.reportMissing') : t('home.reportFound');

    if (_reunited) {
      return Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 72),
            const SizedBox(height: 12),
            Text(t('match.reunited'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => Navigator.popUntil(context, (r) => r.isFirst), child: Text(t('nav.home'))),
          ]),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: ResponsiveBody(
          child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_matches == null && !_savedOffline) ...[
              // Big voice button
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Builder(builder: (context) {
                    final active = _recording || _listening;
                    return Column(children: [
                    GestureDetector(
                      onTap: _toggleRecord,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 128, height: 128,
                        decoration: BoxDecoration(color: active ? Colors.red : kSaffron, shape: BoxShape.circle, boxShadow: [BoxShadow(color: (active ? Colors.red : kSaffron).withOpacity(0.4), blurRadius: 24, spreadRadius: active ? 8 : 2)]),
                        child: Icon(active ? Icons.stop : Icons.mic, color: Colors.white, size: 56),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(active ? t('intake.listening') : t('intake.tapToSpeak'), style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (_heard.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6), child: Text('“$_heard”', style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.black54), textAlign: TextAlign.center)),
                    if (_parsing) const Padding(padding: EdgeInsets.only(top: 8), child: Text('✨', style: TextStyle(fontSize: 18))),
                    if (!active && _heard.isEmpty && !_parsing) Padding(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6), child: Text(t('intake.speakHint'), style: const TextStyle(fontSize: 12, color: Colors.black38), textAlign: TextAlign.center)),
                  ]);
                  }),
                ),
              ),
              const SizedBox(height: 8),
              Text(t('intake.fillManually'), style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black54)),
              const SizedBox(height: 8),
              _form(t),
              const SizedBox(height: 16),
              FilledButton.icon(onPressed: (_submitting || _isEmpty) ? null : _submit, icon: const Icon(Icons.send), label: Text(t('intake.submit'))),
              if (_isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Add at least one detail (name, description, gender, age, language, location or photo) to search.',
                      style: TextStyle(fontSize: 12, color: Colors.black45), textAlign: TextAlign.center),
                ),
            ],
            if (_submitting) Padding(padding: const EdgeInsets.all(24), child: Column(children: [const CircularProgressIndicator(color: kSaffron), const SizedBox(height: 12), Text(t('intake.scanning'))])),
            if (_savedOffline) Padding(padding: const EdgeInsets.all(24), child: Column(children: [const Icon(Icons.wifi_off, color: Colors.amber, size: 56), const SizedBox(height: 12), Text(t('common.offline'), textAlign: TextAlign.center)])),
            if (_matches != null) ..._results(t),
          ],
          ),
        ),
      ),
    );
  }

  Widget _form(String Function(String) t) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          TextField(controller: _name, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: t('intake.name'))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _draft.gender,
            decoration: InputDecoration(labelText: t('intake.gender')),
            items: Config.genders.map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
            onChanged: (v) => setState(() => _draft.gender = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _draft.ageBand,
            decoration: InputDecoration(labelText: t('intake.age')),
            items: Config.ageBands.map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
            onChanged: (v) => setState(() => _draft.ageBand = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _draft.language,
            decoration: InputDecoration(labelText: t('intake.language')),
            items: kLanguages.map((l) => DropdownMenuItem(value: l.announceName, child: Text(l.announceName))).toList(),
            onChanged: (v) => setState(() => _draft.language = v),
          ),
          const SizedBox(height: 12),
          TextField(controller: _desc, maxLines: 2, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: t('intake.description'))),
          const SizedBox(height: 12),
          TextField(controller: _mobile, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('intake.mobile'))),
          const SizedBox(height: 12),
          Row(children: [
            OutlinedButton.icon(onPressed: _takePhoto, icon: const Icon(Icons.camera_alt), label: Text(t('intake.takePhoto'))),
            const SizedBox(width: 12),
            if (_photoB64 != null) const Icon(Icons.check_circle, color: Colors.green),
          ]),
        ]),
      ),
    );
  }

  List<Widget> _results(String Function(String) t) {
    final m = _matches!;
    return [
      Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(t('match.title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
      if (m.needsDisambiguation && m.disambiguationQuestions.isNotEmpty)
        Card(
          color: const Color(0xFFFEF3C7),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: m.disambiguationQuestions.map((q) {
                final opts = (q['options'] as List?)?.cast<String>() ?? [];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(q['question']?.toString() ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Wrap(spacing: 6, runSpacing: 6, children: opts.map((o) => ActionChip(
                          label: Text(o, style: const TextStyle(fontSize: 12)),
                          onPressed: () => _refine(q['field']?.toString() ?? '', o),
                        )).toList()),
                  ]),
                );
              }).toList(),
            ),
          ),
        ),
      if (m.candidates.isEmpty)
        Card(child: Padding(padding: const EdgeInsets.all(20), child: Text(t('match.noMatches')))),
      ...m.candidates.map((c) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: MatchCardWidget(
              cand: c,
              onConfirm: () => _confirm(c.caseOut.id),
              onView: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c.caseOut.id))),
            ),
          )),
    ];
  }
}
