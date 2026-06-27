import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../models/models.dart';
import '../theme.dart';
import 'case_badges.dart';

class MatchCardWidget extends StatefulWidget {
  final MatchCandidate cand;
  final VoidCallback? onConfirm;
  final VoidCallback? onView; // open full record: photo + voice playback
  final bool confirming;
  const MatchCardWidget({super.key, required this.cand, this.onConfirm, this.onView, this.confirming = false});

  @override
  State<MatchCardWidget> createState() => _MatchCardWidgetState();
}

class _MatchCardWidgetState extends State<MatchCardWidget> {
  bool _open = false;

  Color get _tierColor => switch (widget.cand.tier) {
        'strong' => Colors.green,
        'possible' => Colors.amber.shade700,
        _ => Colors.grey,
      };

  Widget _avatar(CaseOut c) {
    final url = c.photoUrl;
    if (url != null && url.startsWith('data:image')) {
      try {
        final b64 = url.substring(url.indexOf(',') + 1);
        return CircleAvatar(radius: 24, backgroundImage: MemoryImage(base64Decode(b64)));
      } catch (_) {}
    } else if (url != null && url.startsWith('http')) {
      return CircleAvatar(radius: 24, backgroundImage: NetworkImage(url));
    }
    return CircleAvatar(radius: 24, backgroundColor: const Color(0xFFF1F5F9), child: Text((c.personName ?? '?').characters.first));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    final c = widget.cand.caseOut;
    final pct = (widget.cand.probability * 100).round();
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LinearProgressIndicator(value: widget.cand.probability, color: _tierColor, backgroundColor: Colors.transparent, minHeight: 4),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _avatar(c),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.personName ?? t('common.unknown'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          const SizedBox(height: 2),
                          // Make the candidate's TYPE obvious: a found person at
                          // another center is a match to reunite with, not a relative.
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: (c.caseType == 'missing' ? kSaffron : kTeal).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                typeLabel(c.caseType),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: c.caseType == 'missing' ? kSaffron : kTeal,
                                ),
                              ),
                            ),
                            if (c.reportingCenter != null && c.reportingCenter!.isNotEmpty)
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: Text('@ ${c.reportingCenter}',
                                      style: const TextStyle(color: Colors.black54, fontSize: 11),
                                      overflow: TextOverflow.ellipsis),
                                ),
                              ),
                          ]),
                          const SizedBox(height: 2),
                          Text('${c.caseId} · ${c.gender ?? ''} · ${c.ageBand ?? ''}', style: const TextStyle(color: Colors.black54, fontSize: 12)),
                        ],
                      ),
                    ),
                    Chip(
                      label: Text('${t('match.${widget.cand.tier}')} · $pct%', style: const TextStyle(fontSize: 11)),
                      backgroundColor: _tierColor.withOpacity(0.12),
                      side: BorderSide.none,
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
                  child: Text(widget.cand.explanation, style: const TextStyle(fontSize: 13)),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton.icon(
                      onPressed: () => setState(() => _open = !_open),
                      icon: Icon(_open ? Icons.expand_less : Icons.expand_more, size: 18),
                      label: Text(t('match.why')),
                    ),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      if (widget.onView != null)
                        IconButton(
                          onPressed: widget.onView,
                          tooltip: 'Photo & voice',
                          icon: const Icon(Icons.photo_camera_front, color: Color(0xFFEA580C)),
                        ),
                      if (widget.onConfirm != null)
                        FilledButton.tonalIcon(
                          onPressed: widget.confirming ? null : widget.onConfirm,
                          icon: const Icon(Icons.handshake, size: 18),
                          label: Text(t('match.confirmReunion')),
                          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0D9488), foregroundColor: Colors.white),
                        ),
                    ]),
                  ],
                ),
                if (_open)
                  ...widget.cand.breakdown.map((b) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(child: Text(b['detail']?.toString() ?? '', style: const TextStyle(fontSize: 12, color: Colors.black54))),
                            Text('${(b['weight'] as num) >= 0 ? '+' : ''}${b['weight']}',
                                style: TextStyle(fontSize: 12, color: (b['weight'] as num) >= 0 ? Colors.green : Colors.red)),
                          ],
                        ),
                      )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
