import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import 'dart:io';

class DeployView extends StatefulWidget {
  const DeployView({Key? key}) : super(key: key);

  @override
  State<DeployView> createState() => _DeployViewState();
}

class _DeployViewState extends State<DeployView> {
  String _selectedPlatform = 'vercel';
  String _selectedEnv = 'preview';
  bool _isDeploying = false;
  String _deploymentUrl = '';
  String _deploymentLog = '';

  Future<void> _deploy() async {
    setState(() {
      _isDeploying = true;
      _deploymentLog = 'Starting deployment...\n';
      _deploymentUrl = '';
    });

    try {
      final appState = Provider.of<AppState>(context, listen: false);
      final projectPath = appState.currentProjectPath ?? 'D:\\AI Projects\\Helix\\build-a-flutter';

      // Run helix deploy command
      final process = await Process.start(
        'cmd',
        [
          '/c',
          'npx',
          'ts-node',
          'src/bin/helix.ts',
          'deploy',
          '--platform',
          _selectedPlatform,
          '--env',
          _selectedEnv,
        ],
        runInShell: true,
        workingDirectory: 'D:\\AI Projects\\Helix',
      );

      process.stdout.transform(SystemEncoding().decoder).listen((data) {
        setState(() {
          _deploymentLog += data;
        });

        // Extract URL from output
        final urlMatch = RegExp(r'https://[^\s]+').firstMatch(data);
        if (urlMatch != null) {
          setState(() {
            _deploymentUrl = urlMatch.group(0)!;
          });
        }
      });

      process.stderr.transform(SystemEncoding().decoder).listen((data) {
        setState(() {
          _deploymentLog += 'ERROR: $data';
        });
      });

      final exitCode = await process.exitCode;
      setState(() {
        _isDeploying = false;
        if (exitCode == 0) {
          _deploymentLog += '\n✅ Deployment successful!';
        } else {
          _deploymentLog += '\n❌ Deployment failed';
        }
      });
    } catch (e) {
      setState(() {
        _isDeploying = false;
        _deploymentLog += '\n❌ Error: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      body: Stack(
        children: [
          // Background gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF0A0A0F),
                  const Color(0xFF1A1A2E).withOpacity(0.8),
                  const Color(0xFF16213E).withOpacity(0.5),
                ],
              ),
            ),
          ),
          
          // Content
          Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    const Icon(Icons.rocket_launch, color: Color(0xFFD4AF37), size: 32),
                    const SizedBox(width: 12),
                    const Text(
                      'Helix Deploy',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'One-command production deployment',
                  style: TextStyle(color: Colors.white54, fontSize: 14),
                ),
                const SizedBox(height: 32),

                // Platform selector
                _buildPlatformSelector(),
                const SizedBox(height: 24),

                // Environment selector
                _buildEnvironmentSelector(),
                const SizedBox(height: 24),

                // Deploy button
                Center(
                  child: ElevatedButton(
                    onPressed: _isDeploying ? null : _deploy,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD4AF37),
                      foregroundColor: const Color(0xFF0A0A0F),
                      padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isDeploying)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0A0A0F)),
                          )
                        else
                          const Icon(Icons.cloud_upload),
                        const SizedBox(width: 12),
                        Text(
                          _isDeploying ? 'Deploying...' : 'Deploy to Production',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // Deployment URL
                if (_deploymentUrl.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A2E).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFD4AF37).withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle, color: Color(0xFFD4AF37)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SelectableText(
                            _deploymentUrl,
                            style: const TextStyle(color: Colors.white70),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.open_in_new, color: Color(0xFFD4AF37)),
                          onPressed: () {
                            // Open URL in browser
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Deployment log
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        _deploymentLog.isEmpty ? 'Deployment logs will appear here...' : _deploymentLog,
                        style: TextStyle(
                          color: _deploymentLog.isEmpty ? Colors.white24 : Colors.white70,
                          fontFamily: 'monospace',
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Platform',
          style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildPlatformOption('vercel', Icons.cloud, 'Vercel'),
            const SizedBox(width: 12),
            _buildPlatformOption('railway', Icons.train, 'Railway'),
            const SizedBox(width: 12),
            _buildPlatformOption('fly', Icons.flight, 'Fly.io'),
          ],
        ),
      ],
    );
  }

  Widget _buildPlatformOption(String platform, IconData icon, String label) {
    final selected = _selectedPlatform == platform;
    return InkWell(
      onTap: () => setState(() => _selectedPlatform = platform),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFD4AF37).withOpacity(0.2) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFFD4AF37) : Colors.white.withOpacity(0.1),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: selected ? const Color(0xFFD4AF37) : Colors.white54, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: selected ? const Color(0xFFD4AF37) : Colors.white54,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEnvironmentSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Environment',
          style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildEnvOption('preview', 'Preview'),
            const SizedBox(width: 12),
            _buildEnvOption('production', 'Production'),
          ],
        ),
      ],
    );
  }

  Widget _buildEnvOption(String env, String label) {
    final selected = _selectedEnv == env;
    return InkWell(
      onTap: () => setState(() => _selectedEnv = env),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFD4AF37).withOpacity(0.2) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFFD4AF37) : Colors.white.withOpacity(0.1),
            width: selected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? const Color(0xFFD4AF37) : Colors.white54,
            fontWeight: selected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
