import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../i18n/strings.dart';
import '../services/auth.dart';
import '../theme.dart';
import 'case_detail_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  List<dynamic> _cases = [], _hotspots = [], _police = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([api.geoCases(), api.geoHotspots(), api.geoLayers()]);
      _cases = results[0] as List;
      _hotspots = results[1] as List;
      _police = (results[2] as Map)['police_stations'] as List? ?? [];
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('map.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kSaffron))
          : FlutterMap(
              options: const MapOptions(
                initialCenter: LatLng(Config.defaultLat, Config.defaultLng),
                initialZoom: Config.defaultZoom,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'app.setu.mobile',
                ),
                CircleLayer(
                  circles: _hotspots.map((h) {
                    final risk = (h['risk_score'] as num?)?.toDouble() ?? 1.0;
                    return CircleMarker(
                      point: LatLng((h['lat'] as num).toDouble(), (h['lng'] as num).toDouble()),
                      radius: 8 + risk * 10,
                      useRadiusInMeter: false,
                      color: Colors.red.withOpacity(0.18),
                      borderColor: Colors.red,
                      borderStrokeWidth: 1,
                    );
                  }).toList(),
                ),
                MarkerLayer(
                  markers: [
                    ..._police.map((s) => Marker(
                          point: LatLng((s['lat'] as num).toDouble(), (s['lng'] as num).toDouble()),
                          width: 24, height: 24,
                          child: const Icon(Icons.local_police, color: Color(0xFF1D4ED8), size: 22),
                        )),
                    ..._cases.map((c) => Marker(
                          point: LatLng((c['lat'] as num).toDouble(), (c['lng'] as num).toDouble()),
                          width: 26, height: 26,
                          child: GestureDetector(
                            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c['id']))),
                            child: Icon(Icons.location_on, size: 26, color: c['case_type'] == 'missing' ? kSaffron : kTeal),
                          ),
                        )),
                  ],
                ),
                const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap')]),
              ],
            ),
    );
  }
}
