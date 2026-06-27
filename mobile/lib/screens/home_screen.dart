import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../services/auth.dart';
import '../services/sync.dart';
import '../theme.dart';
import '../widgets/language_sheet.dart';
import 'intake_screen.dart';
import 'map_screen.dart';
import 'cases_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncService>();
    final name = auth.auth?.fullName ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Hero header ──────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  color: kSaffron,
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top bar: logo + actions
                    Row(
                      children: [
                        Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.25),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: const Text('से', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                        ),
                        const SizedBox(width: 10),
                        Text(t('app.name'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20)),
                        const Spacer(),
                        _HeaderBtn(icon: Icons.language_rounded, onTap: () => showLanguageSheet(context)),
                        const SizedBox(width: 4),
                        _HeaderBtn(icon: Icons.logout_rounded, onTap: () => context.read<AuthProvider>().logout()),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // Greeting
                    Text(
                      '${t('home.greeting')}, $name 🙏',
                      style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      t('app.tagline'),
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2),
                    ),
                  ],
                ),
              ),
            ),

            // ── Sync banner (only visible when needed) ───────────────
            if (!sync.online || sync.pending > 0)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: _SyncBanner(sync: sync, t: t),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Primary actions ──────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _PrimaryCard(
                    icon: Icons.person_search_rounded,
                    iconBg: kSaffronLight,
                    iconColor: kSaffron,
                    title: t('home.reportMissing'),
                    subtitle: 'File a new missing person report',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const IntakeScreen(caseType: 'missing'))),
                  ),
                  const SizedBox(height: 12),
                  _PrimaryCard(
                    icon: Icons.how_to_reg_rounded,
                    iconBg: const Color(0xFFCCFBF1),
                    iconColor: kTeal,
                    title: t('home.reportFound'),
                    subtitle: 'Register a person that has been found',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const IntakeScreen(caseType: 'found'))),
                  ),
                  const SizedBox(height: 20),
                  // Secondary actions row
                  Row(
                    children: [
                      Expanded(
                        child: _SecondaryCard(
                          icon: Icons.map_rounded,
                          label: t('home.map'),
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MapScreen())),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SecondaryCard(
                          icon: Icons.list_alt_rounded,
                          label: t('home.cases'),
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CasesScreen())),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Small icon button used in the header ────────────────────────────────────
class _HeaderBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _HeaderBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.2),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

// ── Sync / offline status banner ─────────────────────────────────────────────
class _SyncBanner extends StatelessWidget {
  final SyncService sync;
  final String Function(String) t;
  const _SyncBanner({required this.sync, required this.t});

  @override
  Widget build(BuildContext context) {
    final isOnline = sync.online;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isOnline ? const Color(0xFFFFF3CD) : const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(
          isOnline ? Icons.sync_rounded : Icons.wifi_off_rounded,
          size: 16,
          color: isOnline ? const Color(0xFF92400E) : Colors.white70,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            isOnline ? '${sync.pending} pending — syncing…' : t('common.offline'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isOnline ? const Color(0xFF92400E) : Colors.white,
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Large primary action card ─────────────────────────────────────────────────
class _PrimaryCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg, iconColor;
  final String title, subtitle;
  final VoidCallback onTap;
  const _PrimaryCard({
    required this.icon, required this.iconBg, required this.iconColor,
    required this.title, required this.subtitle, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(children: [
            Container(
              width: 54, height: 54,
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(16)),
              child: Icon(icon, color: iconColor, size: 26),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              ]),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFFD1D5DB)),
          ]),
        ),
      ),
    );
  }
}

// ── Small secondary action card ───────────────────────────────────────────────
class _SecondaryCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _SecondaryCard({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: kSaffron),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF374151))),
            ],
          ),
        ),
      ),
    );
  }
}
