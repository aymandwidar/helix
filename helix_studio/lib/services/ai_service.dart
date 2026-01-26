class AIService {
  static final AIService _instance = AIService._internal();

  factory AIService() {
    return _instance;
  }

  AIService._internal();

  Future<String> generateCode(String prompt) async {
    // TODO: Implement OpenRouter integration
    return "// Generated code for: $prompt";
  }
}
