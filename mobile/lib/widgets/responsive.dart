import 'package:flutter/material.dart';

/// Centers a long single-column body and caps its width on large screens
/// (tablets / desktop) so content isn't awkwardly stretched edge-to-edge.
/// On phones (narrower than [maxWidth]) it's a no-op pass-through.
class ResponsiveBody extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  const ResponsiveBody({super.key, required this.child, this.maxWidth = 640});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
