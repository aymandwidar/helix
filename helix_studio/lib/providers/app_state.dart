import 'package:flutter/material.dart';

class AppState extends ChangeNotifier {
  bool _isDeveloperMode = false;

  bool get isDeveloperMode => _isDeveloperMode;

  void toggleMode() {
    _isDeveloperMode = !_isDeveloperMode;
    notifyListeners();
  }

  void setMode(bool isDeveloper) {
    if (_isDeveloperMode != isDeveloper) {
      _isDeveloperMode = isDeveloper;
      notifyListeners();
    }
  }

  String? _supabaseConnectionString;
  String? get supabaseConnectionString => _supabaseConnectionString;

  void setConnectionString(String value) {
    _supabaseConnectionString = value;
    notifyListeners();
  }

  String? _vercelToken;
  String? get vercelToken => _vercelToken;

  void setVercelToken(String value) {
    _vercelToken = value;
    notifyListeners();
  }

  // Target selection state (web or flutter)
  String _selectedTarget = 'web'; // Default to web
  String get selectedTarget => _selectedTarget;

  void setTarget(String target) {
    if (target != 'web' && target != 'flutter') {
      debugPrint('⚠️ Invalid target: $target. Defaulting to web.');
      _selectedTarget = 'web';
    } else {
      _selectedTarget = target;
      debugPrint('🎯 Target updated to: $_selectedTarget');
    }
    notifyListeners();
  }

  // Getter for CLI-safe target (defensive programming)
  String get cliTarget => _selectedTarget == 'flutter' ? 'flutter' : 'web';
}
