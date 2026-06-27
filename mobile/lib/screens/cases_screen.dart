import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../models/models.dart';
import '../services/auth.dart';
import '../theme.dart';
import 'case_detail_screen.dart';

class CasesScreen extends StatefulWidget {
  const CasesScreen({super.key});
  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends State<CasesScreen> {
  final _q = TextEditingController();
  List<CaseOut> _cases = [];
  bool _loading = true;
  bool _error = false;
  String? _type;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = false; });
    try {
      _cases = await context.read<AuthProvider>().api.listCases(caseType: _type, q: _q.text);
    } catch (_) {
      if (mounted) setState(() => _error = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────
            Container(
              decoration: const BoxDecoration(
                color: kSaffron,
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                    Text(t('home.cases'),
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                  ]),
                  const SizedBox(height: 12),
                  // Search bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: TextField(
                        controller: _q,
                        onSubmitted: (_) => _load(),
                        decoration: InputDecoration(
                          hintText: 'Search by name or location…',
                          hintStyle: const TextStyle(color: Color(0xFFADB5BD), fontSize: 14),
                          prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFFADB5BD), size: 20),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.arrow_forward_rounded, color: kSaffron, size: 20),
                            onPressed: _load,
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Filter chips ─────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Row(children: [
                _FilterChip(label: t('home.cases'), type: null, current: _type, onSelect: (v) { setState(() => _type = v); _load(); }),
                const SizedBox(width: 8),
                _FilterChip(label: t('common.missing'), type: 'missing', current: _type, onSelect: (v) { setState(() => _type = v); _load(); }),
                const SizedBox(width: 8),
                _FilterChip(label: t('common.found'), type: 'found', current: _type, onSelect: (v) { setState(() => _type = v); _load(); }),
              ]),
            ),

            // ── Content ──────────────────────────────────────────────
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: kSaffron))
                  : _error
                      ? _ErrorState(onRetry: _load)
                      : _cases.isEmpty
                          ? Center(child: Text(t('match.noMatches'), style: const TextStyle(color: Colors.black45)))
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: _cases.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) {
                                final c = _cases[i];
                                final isMissing = c.caseType == 'missing';
                                return Material(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c.id))),
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(children: [
                                        // Avatar circle
                                        Container(
                                          width: 44, height: 44,
                                          decoration: BoxDecoration(
                                            color: isMissing ? kSaffronLight : const Color(0xFFCCFBF1),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            isMissing ? Icons.person_search_rounded : Icons.how_to_reg_rounded,
                                            color: isMissing ? kSaffron : kTeal,
                                            size: 22,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                            Text(
                                              c.personName ?? t('common.unknown'),
                                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                                            ),
                                            const SizedBox(height: 3),
                                            Text(
                                              '${c.caseId}  ·  ${[c.gender, c.ageBand, c.lastSeenLocation].where((e) => e != null && e.isNotEmpty).join(' · ')}',
                                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF6B7280)),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ]),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: isMissing ? kSaffronLight : const Color(0xFFCCFBF1),
                                            borderRadius: BorderRadius.circular(20),
                                          ),
                                          child: Text(
                                            isMissing ? t('common.missing') : t('common.found'),
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: isMissing ? kSaffron : kTeal,
                                            ),
                                          ),
                                        ),
                                      ]),
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Filter chip ───────────────────────────────────────────────────────────────
class _FilterChip extends StatelessWidget {
  final String label;
  final String? type;
  final String? current;
  final void Function(String?) onSelect;
  const _FilterChip({required this.label, required this.type, required this.current, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final selected = current == type;
    return GestureDetector(
      onTap: () => onSelect(type),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? kSaffron : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? kSaffron : const Color(0xFFE5E7EB)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const Color(0xFF6B7280),
          ),
        ),
      ),
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(color: kSaffronLight, shape: BoxShape.circle),
            child: const Icon(Icons.wifi_off_rounded, size: 36, color: kSaffron),
          ),
          const SizedBox(height: 16),
          const Text('Could not load cases', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          const SizedBox(height: 6),
          const Text('Check your connection and try again', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: onRetry,
            style: FilledButton.styleFrom(backgroundColor: kSaffron, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
    );
  }
}
