import 'package:flutter/material.dart';

/// Shared helpers + widgets for presenting a case's STATUS prominently and its
/// TYPE subtly, so the two never read as contradictory equal-weight badges.

/// Background/foreground colours for a case status.
({Color bg, Color fg}) statusColors(String status) {
  switch (status) {
    case 'Reunited':
      return (bg: const Color(0xFFD1FAE5), fg: const Color(0xFF047857)); // green
    case 'Transferred to hospital':
      return (bg: const Color(0xFFDBEAFE), fg: const Color(0xFF1D4ED8)); // blue
    case 'Unresolved':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFFB91C1C)); // red
    case 'Pending':
    default:
      return (bg: const Color(0xFFE2E8F0), fg: const Color(0xFF475569)); // grey
  }
}

/// Subtle muted label for the case type, e.g. "Missing report" / "Found person".
String typeLabel(String caseType) => caseType == 'missing' ? 'Missing report' : 'Found person';

/// Prominent coloured chip showing the case status.
class StatusChip extends StatelessWidget {
  final String status;
  final bool compact;
  const StatusChip({super.key, required this.status, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final c = statusColors(status);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 10, vertical: compact ? 3 : 5),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(20)),
      child: Text(
        status,
        style: TextStyle(color: c.fg, fontSize: compact ? 11 : 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Tiny subtle outlined tag showing the case type.
class TypeTag extends StatelessWidget {
  final String caseType;
  const TypeTag({super.key, required this.caseType});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Text(
        typeLabel(caseType),
        style: const TextStyle(color: Colors.black54, fontSize: 10.5, fontWeight: FontWeight.w600),
      ),
    );
  }
}
