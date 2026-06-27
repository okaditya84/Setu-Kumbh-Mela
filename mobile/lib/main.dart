import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'i18n/strings.dart';
import 'services/auth.dart';
import 'services/sync.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SetuApp());
}

class SetuApp extends StatefulWidget {
  const SetuApp({super.key});
  @override
  State<SetuApp> createState() => _SetuAppState();
}

class _SetuAppState extends State<SetuApp> {
  // Created once for the app's lifetime (not rebuilt on every frame).
  final AuthProvider _auth = AuthProvider();
  late final AppStrings _strings = AppStrings();
  late final SyncService _sync = SyncService(_auth.api);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _strings),
        ChangeNotifierProvider.value(value: _sync),
      ],
      child: MaterialApp(
        title: 'Setu',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: kLanguages.map((l) => Locale(l.code)).toList(),
        home: const _Boot(),
      ),
    );
  }
}

class _Boot extends StatefulWidget {
  const _Boot();
  @override
  State<_Boot> createState() => _BootState();
}

class _BootState extends State<_Boot> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await context.read<AppStrings>().load();
    await context.read<AuthProvider>().load();
    await context.read<SyncService>().start();
    if (mounted) setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: kSaffron)));
    }
    final loggedIn = context.watch<AuthProvider>().isLoggedIn;
    return loggedIn ? const HomeScreen() : const LoginScreen();
  }
}
