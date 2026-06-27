import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../models/models.dart';
import '../services/auth.dart';
import '../widgets/case_badges.dart';
import '../widgets/responsive.dart';
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
  String? _type;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _cases = await context.read<AuthProvider>().api.listCases(caseType: _type, q: _q.text);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('home.cases'))),
      body: ResponsiveBody(
        child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _q,
              decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: 'Search…', suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward), onPressed: _load)),
              onSubmitted: (_) => _load(),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _filter(t('home.cases'), null),
              _filter(t('common.missing'), 'missing'),
              _filter(t('common.found'), 'found'),
            ],
          ),
          Expanded(
            child: _loading
                ? Center(child: Text(t('common.loading')))
                : ListView.builder(
                    itemCount: _cases.length,
                    itemBuilder: (_, i) {
                      final c = _cases[i];
                      return ListTile(
                        isThreeLine: true,
                        title: Row(children: [
                          Expanded(child: Text(c.personName ?? t('common.unknown'))),
                          TypeTag(caseType: c.caseType),
                        ]),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${c.caseId} · ${c.gender ?? ''} · ${c.ageBand ?? ''} · ${c.lastSeenLocation ?? ''}'),
                            const SizedBox(height: 6),
                            Align(alignment: Alignment.centerLeft, child: StatusChip(status: c.status, compact: true)),
                          ],
                        ),
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c.id))),
                      );
                    },
                  ),
          ),
        ],
        ),
      ),
    );
  }

  Widget _filter(String label, String? type) {
    final selected = _type == type;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) {
          setState(() => _type = type);
          _load();
        },
      ),
    );
  }
}
