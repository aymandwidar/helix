import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../widgets/glow_input.dart';
import 'dart:io';
import 'dart:convert';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';

class CreatorView extends StatefulWidget {
  const CreatorView({super.key});

  @override
  State<CreatorView> createState() => _CreatorViewState();
}

class _CreatorViewState extends State<CreatorView> {
  final TextEditingController _promptController = TextEditingController();
  bool _isTyping = false;
  bool _isLoading = false;
  final List<String> _messages = [];

  @override
  void initState() {
    super.initState();
    _promptController.addListener(() {
      setState(() {
        _isTyping = _promptController.text.isNotEmpty;
      });
    });
  }

  Future<void> _submitPrompt() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;

    setState(() {
      _isLoading = true;
      _messages.add(prompt); // Optimistic UI
      _promptController.clear();
    });

    debugPrint("🚀 [CreatorView] Submit Triggered via UI");
    debugPrint("📝 [CreatorView] Prompt: $prompt");

    try {
       // Validate Connection
       final connectionString = context.read<AppState>().supabaseConnectionString;
       debugPrint("🔌 [CreatorView] Connection String: $connectionString");
       
       if (connectionString == null || connectionString.isEmpty) {
         debugPrint("⚠️ [CreatorView] No Connection String found. Prompting user.");
         if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("Please configure Supabase first (Settings Icon)"), 
                backgroundColor: Colors.orange,
              ),
            );
         }
         // Don't return, just warn, maybe we want to allow local gen?
       }

       debugPrint("⏳ [CreatorView] Starting Real Build...");
       
       // REAL BUILDER CODE
       // Using npx ts-node because Helix is a TypeScript CLI in the parent directory
       final process = await Process.start(
         'cmd', 
         ['/c', 'npx', 'ts-node', 'src/bin/helix.ts', 'spawn', prompt],
         runInShell: true,
         workingDirectory: 'D:\\AI Projects\\Helix', 
       );

       // Pipe output to console
       process.stdout.transform(utf8.decoder).listen((data) {
         debugPrint("[HELIX ENGINE]: $data");
         if (mounted) {
            // Update UI with logs if needed, or just suppress
         }
       });

       process.stderr.transform(utf8.decoder).listen((data) {
         debugPrint("[HELIX ERROR]: $data");
       });

       // Wait for process (or let it run in bg)
       // For now we just await the exit code to clear loading state
       final exitCode = await process.exitCode;
       debugPrint("✅ [CreatorView] Build finished with code $exitCode");

    } catch (e, stack) {
      debugPrint("❌ [CreatorView] CRITICAL ERROR during submission:");
      debugPrint(e.toString());
      debugPrint(stack.toString());
      
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
         );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        debugPrint("🏁 [CreatorView] Loading state cleared.");
      }
    }
  }

  void _showSupabaseSettings() {
    final controller = TextEditingController(
      text: context.read<AppState>().supabaseConnectionString ?? '',
    );
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1a1a2e),
        title: const Text("Supabase Autopilot", style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
             const Text(
              "Enter your Connection String to enable automatic schema deployment.",
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
             const SizedBox(height: 10),
             TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: "postgres://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
                hintStyle: TextStyle(color: Colors.white24),
                enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFFFD700))),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            child: const Text("Cancel"),
            onPressed: () => Navigator.pop(context),
          ),
          TextButton(
            child: const Text("Save", style: TextStyle(color: Color(0xFFFFD700))),
            onPressed: () {
              context.read<AppState>().setConnectionString(controller.text);
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Supabase Connection Saved!")),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0a0a12),
      body: Stack(
        children: [
          // Top Right Settings Button
          Positioned(
            top: 40,
            right: 20,
            child: IconButton(
              icon: const Icon(Icons.settings, color: Colors.white24),
              onPressed: _showSupabaseSettings,
              tooltip: "Configure Database",
            ),
          ),

          // Chat Area
          Center(
            child: _messages.isEmpty
                ? Text(
                    "Describe your app...",
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.1),
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 150, top: 50, left: 20, right: 20),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      return _buildChatBubble(_messages[index]);
                    },
                  ),
          ),

          // Input Area
          Positioned(
            bottom: 50,
            left: 20,
            right: 20,
            child: Column(
              children: [
                if (_isLoading)
                   const Padding(
                     padding: EdgeInsets.only(bottom: 16.0),
                     child: CircularProgressIndicator(color: Color(0xFFFFD700)),
                   )
                else if (_isTyping)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFFD700),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(30),
                          ),
                        ),
                        icon: const Icon(Icons.auto_awesome),
                        label: const Text("Magic Build"),
                        onPressed: _submitPrompt,
                      ).animate().fadeIn(),
                  ),
                GlowInput(
                  controller: _promptController,
                  hintText: "E.g. A marketplace for vintage watches...",
                  onSubmit: _isLoading ? null : _submitPrompt,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatBubble(String message) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Text(
          message,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
    ).animate().fadeIn().scale();
  }
}
