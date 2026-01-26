import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/app_state.dart';
import 'mode_switch_shell.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0a0a12),
      body: Row(
        children: [
          // Creator Choice
          Expanded(
            child: InkWell(
              onTap: () {
                context.read<AppState>().setMode(false);
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const ModeSwitchShell()),
                );
              },
              child: Container(
                color: const Color(0xFF0a0a12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.lightbulb_outline, size: 80, color: Color(0xFFFFD700)),
                    const SizedBox(height: 20),
                    Text(
                      "I have an idea",
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      "Creator Mode",
                      style: GoogleFonts.inter(color: const Color(0xFFB0B0B0)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          Container(width: 1, color: const Color(0xFF333333)), // Divider
          
          // Architect Choice
          Expanded(
            child: InkWell(
              onTap: () {
                context.read<AppState>().setMode(true);
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const ModeSwitchShell()),
                );
              },
              child: Container(
                color: const Color(0xFF050505),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.code, size: 80, color: Colors.blueGrey),
                    const SizedBox(height: 20),
                    Text(
                      "I have a spec",
                      style: GoogleFonts.firaCode(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      "Architect Mode",
                      style: GoogleFonts.firaCode(color: const Color(0xFFB0B0B0)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ).animate().fadeIn(duration: 800.ms),
    );
  }
}
