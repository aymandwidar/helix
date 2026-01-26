import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import 'modes/creator_view.dart';
import 'modes/architect_view.dart';
import 'package:google_fonts/google_fonts.dart';

class ModeSwitchShell extends StatelessWidget {
  const ModeSwitchShell({super.key});

  @override
  Widget build(BuildContext context) {
    final isDev = context.watch<AppState>().isDeveloperMode;
    
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0a0a12),
        elevation: 0,
        title: Text(
          "HELIX STUDIO",
          style: GoogleFonts.inter(
             color: Colors.white,
             fontWeight: FontWeight.bold,
             letterSpacing: 2,
          ),
        ),
        actions: [
          Switch(
            value: isDev, 
            activeColor: const Color(0xFFFFD700),
            onChanged: (_) => context.read<AppState>().toggleMode(),
          ),
          const SizedBox(width: 20),
        ],
      ),
      body: isDev ? const ArchitectView() : const CreatorView(),
    );
  }
}
