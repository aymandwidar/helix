import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/app_state.dart';
import 'screens/onboarding.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase (Using placeholder usage as per v10 protocol requirements)
  // await Supabase.initialize(url: '...', anonKey: '...');

  runApp(const HelixStudioApp());
}

class HelixStudioApp extends StatelessWidget {
  const HelixStudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppState()),
      ],
      child: MaterialApp(
        title: 'Helix Studio',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          scaffoldBackgroundColor: const Color(0xFF0a0a12),
          primaryColor: const Color(0xFFFFD700),
          useMaterial3: true,
          brightness: Brightness.dark,
        ),
        home: const OnboardingScreen(),
      ),
    );
  }
}
