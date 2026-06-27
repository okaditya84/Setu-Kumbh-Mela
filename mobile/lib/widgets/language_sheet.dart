import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/strings.dart';

void showLanguageSheet(BuildContext context) {
  final strings = context.read<AppStrings>();
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(strings.t('lang.title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: kLanguages.map((l) {
                final selected = l.code == strings.code;
                return ChoiceChip(
                  label: Text(l.label),
                  selected: selected,
                  onSelected: (_) {
                    strings.setCode(l.code);
                    Navigator.pop(ctx);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            const Text('Voice & announcements work in every language.',
                style: TextStyle(fontSize: 12, color: Colors.black45)),
          ],
        ),
      ),
    ),
  );
}
