import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'local_db.dart';

/// Watches connectivity and drains the offline queue when back online.
class SyncService extends ChangeNotifier {
  final ApiClient api;
  int pending = 0;
  bool online = true;
  bool _syncing = false;
  StreamSubscription? _sub;
  Timer? _timer;

  SyncService(this.api);

  Future<void> start() async {
    await refresh();
    _sub = Connectivity().onConnectivityChanged.listen((result) {
      online = !result.contains(ConnectivityResult.none);
      notifyListeners();
      if (online) syncNow();
    });
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => syncNow());
    syncNow();
  }

  Future<void> refresh() async {
    pending = await LocalDb.pendingCount();
    notifyListeners();
  }

  Future<void> syncNow() async {
    if (_syncing || api.token == null) return;
    _syncing = true;
    try {
      final items = await LocalDb.pending();
      for (final item in items) {
        try {
          await api.syncPush([item['payload'] as Map<String, dynamic>]);
          await LocalDb.markSynced(item['client_uuid'] as String);
        } catch (_) {
          // leave queued; will retry next tick
        }
      }
      await refresh();
    } finally {
      _syncing = false;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    _timer?.cancel();
    super.dispose();
  }
}
