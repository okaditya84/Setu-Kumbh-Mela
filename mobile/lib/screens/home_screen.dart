import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../services/auth.dart';
import '../services/sync.dart';
import '../theme.dart';
import '../widgets/language_sheet.dart';
import '../widgets/responsive.dart';
import 'intake_screen.dart';
import 'map_screen.dart';
import 'cases_screen.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _unread = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refreshUnread();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _refreshUnread());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refreshUnread() async {
    try {
      final n = await context.read<AuthProvider>().api.unreadCount();
      if (mounted && n != _unread) setState(() => _unread = n);
    } catch (_) {}
  }

  Future<void> _openNotifications() async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
    await _refreshUnread();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncService>();

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Container(width: 30, height: 30, decoration: BoxDecoration(color: kSaffron, borderRadius: BorderRadius.circular(8)), alignment: Alignment.center, child: const Text('से', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
          const SizedBox(width: 8),
          Text(t('app.name'), style: const TextStyle(fontWeight: FontWeight.w900)),
        ]),
        actions: [
          _BellButton(unread: _unread, onTap: _openNotifications),
          IconButton(onPressed: () => showLanguageSheet(context), icon: const Icon(Icons.language)),
          IconButton(onPressed: () => context.read<AuthProvider>().logout(), icon: const Icon(Icons.logout)),
        ],
      ),
      body: SafeArea(
        child: ResponsiveBody(
          child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (!sync.online || sync.pending > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: sync.online ? const Color(0xFFFEF3C7) : const Color(0xFF1E293B), borderRadius: BorderRadius.circular(10)),
                child: Row(children: [
                  Icon(sync.online ? Icons.sync : Icons.wifi_off, size: 18, color: sync.online ? Colors.brown : Colors.white),
                  const SizedBox(width: 8),
                  Expanded(child: Text(sync.online ? '${sync.pending} pending → syncing' : t('common.offline'), style: TextStyle(color: sync.online ? Colors.brown : Colors.white, fontSize: 13))),
                ]),
              ),
            Text('${t('home.greeting')}, ${auth.auth?.fullName ?? ''} 🙏', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            _BigAction(
              color: kSaffronLight, iconColor: kSaffron, icon: Icons.search,
              title: t('home.reportMissing'),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const IntakeScreen(caseType: 'missing'))),
            ),
            const SizedBox(height: 12),
            _BigAction(
              color: const Color(0xFFCCFBF1), iconColor: kTeal, icon: Icons.person_add_alt_1,
              title: t('home.reportFound'),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const IntakeScreen(caseType: 'found'))),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _SmallAction(icon: Icons.map, label: t('home.map'), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MapScreen())))),
              const SizedBox(width: 12),
              Expanded(child: _SmallAction(icon: Icons.list_alt, label: t('home.cases'), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CasesScreen())))),
            ]),
          ],
          ),
        ),
      ),
    );
  }
}

class _BellButton extends StatelessWidget {
  final int unread;
  final VoidCallback onTap;
  const _BellButton({required this.unread, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(onPressed: onTap, icon: const Icon(Icons.notifications_none)),
        if (unread > 0)
          Positioned(
            top: 8,
            right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(10)),
              alignment: Alignment.center,
              child: Text(
                unread > 99 ? '99+' : '$unread',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
              ),
            ),
          ),
      ],
    );
  }
}

class _BigAction extends StatelessWidget {
  final Color color, iconColor;
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  const _BigAction({required this.color, required this.iconColor, required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(children: [
            Container(width: 52, height: 52, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: iconColor, size: 28)),
            const SizedBox(width: 16),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold))),
            const Icon(Icons.chevron_right, color: Colors.black26),
          ]),
        ),
      ),
    );
  }
}

class _SmallAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _SmallAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [Icon(icon, color: Colors.black45), const SizedBox(width: 10), Text(label, style: const TextStyle(fontWeight: FontWeight.w600))]),
        ),
      ),
    );
  }
}
