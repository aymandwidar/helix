import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../visual_strand_graph.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../api_lab_view.dart';

class ArchitectView extends StatefulWidget {
  const ArchitectView({super.key});

  @override
  State<ArchitectView> createState() => _ArchitectViewState();
}

class _ArchitectViewState extends State<ArchitectView> {
  int _selectedTabIndex = 0; // 0: Code, 1: Brain, 2: Lab
  final List<String> _logs = [
    "[SYSTEM] Helix v10.0 Engine Ready...",
    "[INFO] Connected to Supabase Cluster",
    "[INFO] OpenRouter API: Active (Model: Llama-3-70b)",
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0a0a12),
      body: Row(
        children: [
          // Left Pane: File Tree
          Container(
            width: 250,
            decoration: const BoxDecoration(
              border: Border(right: BorderSide(color: Color(0xFF333333))),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text("PROJECT", style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1)),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      _buildFileTreeItem("lib", isFolder: true),
                      _buildFileTreeItem("  models", isFolder: true),
                      _buildFileTreeItem("    user.dart", isFolder: false),
                      _buildFileTreeItem("  services", isFolder: true),
                      _buildFileTreeItem("  main.dart", isFolder: false),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Center Pane: Code Editor OR Graph OR Lab
          Expanded(
            flex: 2,
            child: Column(
              children: [
                // Top Bar: View Switcher
                Container(
                  height: 48,
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: Color(0xFF333333))),
                    color: Color(0xFF050505),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 16),
                      _buildTab("CODE", _selectedTabIndex == 0, () => setState(() => _selectedTabIndex = 0)),
                      const SizedBox(width: 16),
                      _buildTab("BRAIN", _selectedTabIndex == 1, () => setState(() => _selectedTabIndex = 1)),
                      const SizedBox(width: 16),
                      _buildTab("LAB", _selectedTabIndex == 2, () => setState(() => _selectedTabIndex = 2)),
                    ],
                  ),
                ),

                // Main Content
                Expanded(
                  child: _buildMainContent(),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomSheet: Container(
        height: 200,
        decoration: const BoxDecoration(
            color: Color(0xFF050505),
            border: Border(top: BorderSide(color: Color(0xFF333333)))),
        child: Column(
          children: [
             Padding(
               padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
               child: Row(
                 mainAxisAlignment: MainAxisAlignment.spaceBetween,
                 children: [
                   Text("TERMINAL", style: GoogleFonts.firaCode(color: const Color(0xFFB0B0B0), fontSize: 12)),
                   TextButton(onPressed: (){}, child: Text("Compile & Run", style: GoogleFonts.firaCode(color: const Color(0xFFFFD700))))
                 ],
               ),
             ),
             const Divider(color: Color(0xFF333333), height: 1),
             Expanded(
               child: ListView.builder(
                 padding: const EdgeInsets.all(16),
                 itemCount: _logs.length,
                 itemBuilder: (context, index) {
                   return Text(
                     _logs[index],
                     style: GoogleFonts.firaCode(
                       color: _logs[index].contains("[ERROR]") ? Colors.red : const Color(0xFF00FF00),
                       fontSize: 12,
                     ),
                   );
                 },
               ),
             ),
          ],
        ),
      ),
    );
  }

  Widget _buildTab(String label, bool isActive, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isActive ? const Color(0xFFFFD700) : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            color: isActive ? Colors.white : Colors.grey,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  Widget _buildFileTreeItem(String title, {required bool isFolder}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            isFolder ? Icons.folder : Icons.insert_drive_file,
            color: isFolder ? const Color(0xFFFFD700) : const Color(0xFFB0B0B0),
            size: 16,
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: GoogleFonts.firaCode(
              color: const Color(0xFFB0B0B0),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent() {
    switch (_selectedTabIndex) {
      case 1:
        return const VisualStrandGraph().animate().fadeIn();
      case 2:
        return const ApiLabView().animate().fadeIn();
      default:
        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "// user.dart",
                style: GoogleFonts.firaCode(color: const Color(0xFFB0B0B0)),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF050505),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFF333333)),
                  ),
                  child: Text(
                    "class User {\n  final String id;\n  final String name;\n\n  User({required this.id, required this.name});\n}",
                    style: GoogleFonts.firaCode(
                      color: const Color(0xFF00FF00),
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
    }
  }
}
