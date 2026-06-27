import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/auth.dart';
import '../theme.dart';
import '../widgets/responsive.dart';
import 'case_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await context.read<AuthProvider>().api.listNotifications();
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await context.read<AuthProvider>().api.markAllRead();
      if (mounted) {
        setState(() {
          for (final n in _items) {
            n.read = true;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _open(NotificationItem n) async {
    final api = context.read<AuthProvider>().api;
    if (!n.read) {
      try {
        await api.markRead(n.id);
        if (mounted) setState(() => n.read = true);
      } catch (_) {}
    }
    final caseId = n.targetCaseId;
    if (caseId != null && caseId.isNotEmpty && mounted) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: caseId)));
    }
  }

  static String _relativeTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt.toLocal());
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _items.any((n) => !n.read);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(onPressed: _markAllRead, child: const Text('Mark all read')),
        ],
      ),
      body: ResponsiveBody(
        child: _loading
          ? const Center(child: CircularProgressIndicator(color: kSaffron))
          : _items.isEmpty
              ? const Center(child: Text('No notifications yet'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final n = _items[i];
                      return Container(
                        color: n.read ? null : kSaffronLight,
                        child: ListTile(
                          leading: Icon(
                            n.read ? Icons.notifications_none : Icons.notifications_active,
                            color: n.read ? Colors.black38 : kSaffron,
                          ),
                          title: Text(
                            n.title,
                            style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w800),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (n.body.isNotEmpty) Text(n.body),
                              const SizedBox(height: 4),
                              Text(_relativeTime(n.createdAt), style: const TextStyle(fontSize: 11, color: Colors.black45)),
                            ],
                          ),
                          isThreeLine: n.body.isNotEmpty,
                          onTap: () => _open(n),
                        ),
                      );
                    },
                  ),
                ),
      ),
    );
  }
}
