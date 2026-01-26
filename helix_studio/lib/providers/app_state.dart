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
}
