import 'dart:convert';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Offline-first queue. Intake done with no network is stored here and replayed
/// (idempotently, by client_uuid) when connectivity returns.
class LocalDb {
  static Database? _db;

  static Future<Database> get db async {
    if (_db != null) return _db!;
    final path = p.join(await getDatabasesPath(), 'setu.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (d, _) async {
        await d.execute('''
          CREATE TABLE queue (
            client_uuid TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            queued_at INTEGER NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
          )
        ''');
      },
    );
    return _db!;
  }

  static Future<void> enqueue(String clientUuid, Map<String, dynamic> payload) async {
    final d = await db;
    await d.insert(
      'queue',
      {
        'client_uuid': clientUuid,
        'payload': jsonEncode(payload),
        'queued_at': DateTime.now().millisecondsSinceEpoch,
        'synced': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<List<Map<String, dynamic>>> pending() async {
    final d = await db;
    final rows = await d.query('queue', where: 'synced = 0', orderBy: 'queued_at ASC');
    return rows.map((r) => {'client_uuid': r['client_uuid'], 'payload': jsonDecode(r['payload'] as String)}).toList();
  }

  static Future<int> pendingCount() async {
    final d = await db;
    final c = Sqflite.firstIntValue(await d.rawQuery('SELECT COUNT(*) FROM queue WHERE synced = 0'));
    return c ?? 0;
  }

  static Future<void> markSynced(String clientUuid) async {
    final d = await db;
    await d.update('queue', {'synced': 1}, where: 'client_uuid = ?', whereArgs: [clientUuid]);
  }
}
