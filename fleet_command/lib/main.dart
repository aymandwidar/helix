import 'package:flutter/material.dart';
import 'views/dashboard_view.dart';

void main() {
  runApp(const FleetCommandApp());
}

class FleetCommandApp extends StatelessWidget {
  const FleetCommandApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fleet Command',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFFFFD700), // Helix Gold
        scaffoldBackgroundColor: const Color(0xFF000000),
        fontFamily: 'Inter',
      ),
      home: const DashboardView(),
    );
  }
}
