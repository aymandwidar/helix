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
    
    // Initialize target from AppState logging
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final appState = context.read<AppState>();
      debugPrint('🎯 Initial target from AppState: ${appState.selectedTarget}');
    });
  }

  // Target state now managed in AppState provider (not local)

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
    
    // Get target from AppState (reliable source of truth)
    final appState = context.read<AppState>();
    final target = appState.cliTarget; // Use defensive getter
    debugPrint("🎯 [CreatorView] Target from AppState: $target");

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
       
       // DEFENSIVE CLI CONSTRUCTION
       final List<String> args = [
         '/c', 'npx', 'ts-node', 'src/bin/helix.ts', 'spawn', prompt
       ];
       
       // Explicitly add --target flag based on AppState
       if (target == 'flutter') {
         args.addAll(['--target', 'flutter']);
         debugPrint("✅ [CreatorView] CLI Args include: --target flutter");
       } else {
         args.addAll(['--target', 'web']);
         debugPrint("✅ [CreatorView] CLI Args include: --target web (default)");
       }
       
       debugPrint("=" * 50);
       debugPrint("🚀 HELIX CLI SPAWN COMMAND");
       debugPrint("Target Selected: $target");
       debugPrint("Command: cmd ${args.join(' ')}");
       debugPrint("=" * 50);
       
       // REAL BUILDER CODE
       final process = await Process.start(
         'cmd',
         args,
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

  Future<void> _deployApp() async {
    // ... existing deploy code ...
  }

  // ... existing _showSettings ...

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final selectedTarget = appState.selectedTarget;
    
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
              onPressed: _showSettings, // Fixed typo: _showSupabaseSettings -> _showSettings
              tooltip: "Configure Database",
            ),
          ),

          // Chat Area
          Center(
            child: _messages.isEmpty
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        selectedTarget == 'web' ? Icons.language : Icons.smartphone, 
                        size: 64, 
                        color: Colors.white10
                      ),
                      const SizedBox(height: 20),
                      Text(
                        selectedTarget == 'web' ? "Describe your Web App..." : "Describe your Mobile App...",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.1),
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 180, top: 50, left: 20, right: 20),
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
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFFFD700),
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                          icon: const Icon(Icons.auto_awesome),
                          label: const Text("Magic Build"),
                          onPressed: _submitPrompt,
                        ).animate().fadeIn(),
                        const SizedBox(width: 10),
                         IconButton(
                           style: IconButton.styleFrom(
                             backgroundColor: Colors.white10,
                             padding: const EdgeInsets.all(12),
                           ),
                           icon: const Icon(Icons.rocket_launch, color: Colors.greenAccent),
                           tooltip: "Deploy to Vercel",
                           onPressed: _deployApp,
                         ).animate().fadeIn(),
                      ],
                    ),
                  ),
                
                // Target Selector
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildTargetOption('web', Icons.language, "Web"),
                      _buildTargetOption('flutter', Icons.smartphone, "Mobile"),
                    ],
                  ),
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

  Widget _buildTargetOption(String value, IconData icon, String label) {
    final appState = context.watch<AppState>(); // Watch for changes
    final isSelected = appState.selectedTarget == value;
    
    return GestureDetector(
      onTap: () {
        context.read<AppState>().setTarget(value);
        debugPrint("🎯 [CreatorView] User selected target: $value");
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFD700) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: isSelected ? Colors.black : Colors.white54),
            if (isSelected) ...[
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            ]
          ],
        ),
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
