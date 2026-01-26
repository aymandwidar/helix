// This is a basic Flutter widget test.
import 'package:provider/provider.dart';
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:a_behavioral_wealth/main.dart';

void main() {
  testWidgets('Counter increments smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (context) => CitadelState(),
        child: const CitadelApp(),
      ),
    );

    // Verify that the title shows up.
    expect(find.text('Citadel'), findsOneWidget);
    expect(find.byIcon(Icons.add), findsOneWidget);
  });
}
