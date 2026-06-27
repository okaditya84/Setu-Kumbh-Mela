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
  // Preview (no auto-register) state.
  bool _registered = false; // user explicitly registered the report
  String? _registeredCaseId;

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

  /// Copies the editable form fields into [_draft] (without assigning a
  /// client_uuid — that's only done at register/enqueue time).
  void _syncDraftFromForm() {
    _draft
      ..personName = _name.text.trim().isEmpty ? null : _name.text.trim()
      ..physicalDescription = _desc.text.trim().isEmpty ? null : _desc.text.trim()
      ..reporterMobile = _mobile.text.trim().isEmpty ? null : _mobile.text.trim()
      ..photoUrl = _photoB64;
  }

  /// "Find matches": preview matches WITHOUT persisting the report. Offline we
  /// still enqueue (no server to preview against), as before.
  Future<void> _findMatches() async {
    if (_isEmpty) return;
    setState(() => _submitting = true);
    _syncDraftFromForm();
    final sync = context.read<SyncService>();
    final api = context.read<AuthProvider>().api;
    try {
      if (!sync.online) {
        _draft.clientUuid ??= const Uuid().v4();
        await LocalDb.enqueue(_draft.clientUuid!, _draft.toJson());
        await sync.refresh();
        setState(() => _savedOffline = true);
        return;
      }
      final res = await api.previewCase(_draft);
      setState(() => _matches = res);
    } catch (_) {
      _draft.clientUuid ??= const Uuid().v4();
      await LocalDb.enqueue(_draft.clientUuid!, _draft.toJson());
      await sync.refresh();
      setState(() => _savedOffline = true);
    } finally {
      setState(() => _submitting = false);
    }
  }

  /// Persists the previewed report. Returns the registered case id, or null on
  /// failure. Safe to call repeatedly (idempotent via client_uuid).
  Future<String?> _ensureRegistered() async {
    if (_registered && _registeredCaseId != null) return _registeredCaseId;
    final api = context.read<AuthProvider>().api;
    _syncDraftFromForm();
    _draft.clientUuid ??= const Uuid().v4();
    final res = await api.createCase(_draft);
    _registered = true;
    _registeredCaseId = res.queryCaseId;
    return _registeredCaseId;
  }

  /// "Register this report" button.
  Future<void> _register() async {
    setState(() => _submitting = true);
    try {
      await _ensureRegistered();
      setState(() {});
    } finally {
      setState(() => _submitting = false);
    }
  }

  /// Disambiguation answer. Since preview doesn't persist, we apply the answer
  /// to the local draft and re-preview rather than calling the server refine
  /// endpoint (which needs a persisted case).
  Future<void> _refine(String field, String value) async {
    setState(() => _submitting = true);
    try {
      switch (field) {
        case 'gender':
          _draft.gender = value;
          break;
        case 'age_band':
          _draft.ageBand = value;
          break;
        case 'language':
          _draft.language = value;
          break;
        case 'state':
          _draft.state = value;
          break;
        case 'district':
          _draft.district = value;
          break;
        case 'last_seen_location':
          _draft.lastSeenLocation = value;
          break;
        case 'stable':
        default:
          // Append a stable/clarifying detail to the description.
          final cur = _desc.text.trim();
          _desc.text = cur.isEmpty ? value : '$cur; $value';
          break;
      }
      _syncDraftFromForm();
      final res = await context.read<AuthProvider>().api.previewCase(_draft);
      setState(() => _matches = res);
    } catch (_) {} finally {
      setState(() => _submitting = false);
    }
  }

  Future<void> _confirm(String candidateId) async {
    setState(() => _submitting = true);
    try {
      final api = context.read<AuthProvider>().api;
      // Register first (if needed) so the new report has a real id to link.
      final created = await _ensureRegistered();
      if (created == null) return;
      final missing = widget.caseType == 'missing' ? created : candidateId;
      final found = widget.caseType == 'found' ? created : candidateId;
      await api.decideMatch(missing, found, 'confirm');
      setState(() => _reunited = true);
    } finally {
      setState(() => _submitting = false);
    }
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

    // Registered (and not reunited): confirmation screen.
    if (_registered) {
      return Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.verified, color: kTeal, size: 72),
              const SizedBox(height: 12),
              const Text('Registered — searchable at every center',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(_name.text.trim().isEmpty ? '' : _name.text.trim(), style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 16),
              if (_registeredCaseId != null)
                FilledButton.icon(
                  onPressed: () => Navigator.pushReplacement(context,
                      MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: _registeredCaseId!))),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Open this report'),
                ),
              const SizedBox(height: 8),
              TextButton(onPressed: () => Navigator.popUntil(context, (r) => r.isFirst), child: Text(t('nav.home'))),
            ]),
          ),
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
              FilledButton.icon(onPressed: (_submitting || _isEmpty) ? null : _findMatches, icon: const Icon(Icons.search), label: Text(t('intake.submit'))),
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

  Widget _summaryCard() {
    final missing = widget.caseType == 'missing';
    final heading = missing ? 'You are filing a MISSING report:' : 'You are filing a FOUND person:';
    final fields = <String>[
      if (_name.text.trim().isNotEmpty) _name.text.trim(),
      if (_draft.gender != null) _draft.gender!,
      if (_draft.ageBand != null) _draft.ageBand!,
      if (_draft.language != null && _draft.language!.isNotEmpty) _draft.language!,
      if (_draft.state != null && _draft.state!.isNotEmpty) _draft.state!,
      if (_draft.lastSeenLocation != null && _draft.lastSeenLocation!.isNotEmpty) _draft.lastSeenLocation!,
    ];
    return Card(
      color: missing ? kSaffronLight : const Color(0xFFCCFBF1),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_photoB64 != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(base64Decode(_photoB64!.substring(_photoB64!.indexOf(',') + 1)), width: 56, height: 56, fit: BoxFit.cover),
              ),
            ),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(heading, style: TextStyle(fontWeight: FontWeight.bold, color: missing ? kSaffron : kTeal)),
              const SizedBox(height: 4),
              Text(fields.isEmpty ? '(details only in description)' : fields.join(' · ')),
              if (_desc.text.trim().isNotEmpty)
                Padding(padding: const EdgeInsets.only(top: 4), child: Text('“${_desc.text.trim()}”', style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.black54))),
            ]),
          ),
        ]),
      ),
    );
  }

  List<Widget> _results(String Function(String) t) {
    final m = _matches!;
    return [
      _summaryCard(),
      const SizedBox(height: 4),
      Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('match.title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
      const Padding(
        padding: EdgeInsets.only(top: 2, bottom: 4),
        child: Text('Other reports that may be the SAME person, from any center — confirm to reunite.',
            style: TextStyle(fontSize: 12.5, color: Colors.black54)),
      ),
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
              confirming: _submitting,
              onConfirm: () => _confirm(c.caseOut.id),
              onView: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c.caseOut.id))),
            ),
          )),
      const SizedBox(height: 8),
      // Nothing is persisted until the user explicitly registers.
      FilledButton.icon(
        onPressed: _submitting ? null : _register,
        icon: const Icon(Icons.how_to_reg),
        label: const Text('Register this report'),
      ),
      const Padding(
        padding: EdgeInsets.only(top: 6),
        child: Text('Your report is not saved yet. Register to make it searchable at every center.',
            style: TextStyle(fontSize: 12, color: Colors.black45), textAlign: TextAlign.center),
      ),
    ];
  }
}
