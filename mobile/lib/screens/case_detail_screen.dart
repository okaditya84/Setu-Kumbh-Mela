import 'dart:convert';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';

import '../i18n/strings.dart';
import '../models/models.dart';
import '../services/auth.dart';
import '../theme.dart';
import '../widgets/match_card.dart';

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  const CaseDetailScreen({super.key, required this.caseId});
  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  final _rec = AudioRecorder();
  final _player = AudioPlayer();
  final _tts = FlutterTts();
  CaseOut? _case;
  MatchResponse? _matches;
  List<dynamic> _voices = [];
  String? _announcement;
  bool _busy = false, _recording = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _rec.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<AuthProvider>().api;
    final c = await api.getCase(widget.caseId);
    final m = await api.caseMatches(widget.caseId);
    final v = await api.listVoice(widget.caseId);
    if (mounted) setState(() { _case = c; _matches = m; _voices = v; });
  }

  Future<void> _toggleRecord() async {
    final api = context.read<AuthProvider>().api;
    if (_recording) {
      final path = await _rec.stop();
      setState(() => _recording = false);
      if (path != null) {
        final bytes = await File(path).readAsBytes();
        await api.uploadVoice(widget.caseId, bytes, language: context.read<AppStrings>().lang.announceName);
        await _load();
      }
      return;
    }
    if (await _rec.hasPermission()) {
      final dir = await getTemporaryDirectory();
      final path = p.join(dir.path, 'sample_${DateTime.now().millisecondsSinceEpoch}.m4a');
      await _rec.start(const RecordConfig(), path: path);
      setState(() => _recording = true);
    }
  }

  Future<void> _announce() async {
    setState(() => _busy = true);
    try {
      final lang = context.read<AppStrings>().lang;
      final a = await context.read<AuthProvider>().api.announcement(widget.caseId, lang.announceName);
      setState(() => _announcement = a['text']);
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _speak(String text) async {
    await _tts.setLanguage(context.read<AppStrings>().lang.speechLocale);
    await _tts.speak(text);
  }

  Future<void> _confirm(String candidateId) async {
    final api = context.read<AuthProvider>().api;
    final missing = _case!.caseType == 'missing' ? _case!.id : candidateId;
    final found = _case!.caseType == 'found' ? _case!.id : candidateId;
    setState(() => _busy = true);
    try {
      await api.decideMatch(missing, found, 'confirm');
      await _load();
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final ctrl = TextEditingController();
    final t = context.read<AppStrings>().t;
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('case.verify')),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          if (_case?.secretQuestion != null) Text('❝ ${_case!.secretQuestion} ❞', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(controller: ctrl, decoration: const InputDecoration(hintText: '…')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('common.cancel'))),
          FilledButton(
            onPressed: () async {
              final res = await context.read<AuthProvider>().api.verify(widget.caseId, ctrl.text);
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  backgroundColor: res['verified'] == true ? Colors.green : Colors.red,
                  content: Text(res['message'] ?? ''),
                ));
              }
            },
            child: Text(t('common.confirm')),
          ),
        ],
      ),
    );
  }

  Widget _photo(String? url) {
    if (url != null && url.startsWith('data:image')) {
      try {
        return ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(base64Decode(url.substring(url.indexOf(',') + 1)), width: 72, height: 72, fit: BoxFit.cover));
      } catch (_) {}
    } else if (url != null && url.startsWith('http')) {
      return ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(url, width: 72, height: 72, fit: BoxFit.cover));
    }
    return Container(width: 72, height: 72, decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.person, color: Colors.black26, size: 36));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    final c = _case;
    if (c == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator(color: kSaffron)));
    }
    return Scaffold(
      appBar: AppBar(title: Text(c.caseId)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _photo(c.photoUrl),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(c.personName ?? t('common.unknown'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Text('${c.gender ?? ''} · ${c.ageBand ?? ''} · ${c.language ?? ''}', style: const TextStyle(color: Colors.black54)),
                      Text('${c.state ?? ''} · ${c.lastSeenLocation ?? ''}', style: const TextStyle(color: Colors.black54)),
                      Chip(label: Text(c.status), visualDensity: VisualDensity.compact),
                    ]),
                  ),
                ]),
                if (c.physicalDescription != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(c.physicalDescription!)),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(onPressed: _busy ? null : _announce, icon: const Icon(Icons.campaign), label: Text(t('case.makeAnnouncement'))),
            OutlinedButton.icon(onPressed: _toggleRecord, icon: Icon(_recording ? Icons.stop : Icons.mic), label: Text(_recording ? '● rec' : 'Voice')),
            if (c.hasSecret) OutlinedButton.icon(onPressed: _verify, icon: const Icon(Icons.verified_user), label: Text(t('case.verify'))),
            if (c.status != 'Reunited')
              FilledButton.icon(onPressed: _busy ? null : () async { await context.read<AuthProvider>().api.updateStatus(widget.caseId, 'Reunited'); await _load(); }, icon: const Icon(Icons.check), label: Text(t('case.markReunited'))),
          ]),
          if (_announcement != null) ...[
            const SizedBox(height: 12),
            Card(
              color: kSaffronLight,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t('case.announcement'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(_announcement!),
                  const SizedBox(height: 8),
                  FilledButton.icon(onPressed: () => _speak(_announcement!), icon: const Icon(Icons.volume_up), label: Text(t('case.play'))),
                ]),
              ),
            ),
          ],
          if (_voices.isNotEmpty) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Voice samples', style: TextStyle(fontWeight: FontWeight.bold)),
                  ..._voices.map((v) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: IconButton(icon: const Icon(Icons.play_circle, color: kSaffron), onPressed: () => _player.play(UrlSource(context.read<AuthProvider>().api.audioUrl(v['id'])))),
                        title: Text(v['kind'] ?? 'sample'),
                        subtitle: v['transcript'] != null ? Text('“${v['transcript']}”', style: const TextStyle(fontStyle: FontStyle.italic)) : null,
                      )),
                ]),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(t('match.title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          if (_matches != null && _matches!.candidates.isNotEmpty)
            ..._matches!.candidates.map((m) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: MatchCardWidget(
                    cand: m,
                    confirming: _busy,
                    onConfirm: c.status != 'Reunited' ? () => _confirm(m.caseOut.id) : null,
                    onView: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: m.caseOut.id))),
                  ),
                ))
          else
            Card(child: Padding(padding: const EdgeInsets.all(20), child: Text(t('match.noMatches')))),
        ],
      ),
    );
  }
}
