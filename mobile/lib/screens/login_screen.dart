import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';
import '../services/auth.dart';
import '../theme.dart';
import '../widgets/language_sheet.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().login(_user.text.trim(), _pass.text);
    } catch (_) {
      setState(() => _error = context.read<AppStrings>().t('login.error'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AppStrings>().t;
    return Scaffold(
      appBar: AppBar(actions: [
        IconButton(onPressed: () => showLanguageSheet(context), icon: const Icon(Icons.language)),
      ]),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: kSaffron, borderRadius: BorderRadius.circular(18)),
                  alignment: Alignment.center,
                  child: const Text('से', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(height: 12),
                Text(t('app.name'), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                Text(t('app.tagline'), style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Align(alignment: Alignment.centerLeft, child: Text(t('login.title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                        const SizedBox(height: 16),
                        TextField(controller: _user, decoration: InputDecoration(labelText: t('login.username')), textInputAction: TextInputAction.next),
                        const SizedBox(height: 12),
                        TextField(controller: _pass, decoration: InputDecoration(labelText: t('login.password')), obscureText: true, onSubmitted: (_) => _submit()),
                        if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _loading ? null : _submit, child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(t('login.submit'))),
                        const SizedBox(height: 8),
                        Text(t('login.demo'), style: const TextStyle(fontSize: 11, color: Colors.black38), textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
