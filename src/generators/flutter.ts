/**
 * Helix Flutter Generator v4.4
 * Generates Flutter mobile apps from natural language prompts
 * Supports:
 *   - local (in-memory) and Supabase (cloud) database modes
 *   - OpenRouter AI integration with constitution-based persona extraction
 */

import execa = require("execa");
import * as fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { createCompletion, DEFAULT_MODEL } from "../openrouter";

export interface FlutterStrand {
    name: string;
    fields: Array<{ name: string; type: string }>;
}

/**
 * Extract AI directives from a constitution file
 * Looks for sections headed by "## AI DIRECTIVES" or "## AI CONSTITUTION"
 */
function extractAIDirectives(constitution: string): string {
    // Look for ## AI DIRECTIVES or ## AI CONSTITUTION section
    const patterns = [
        /##\s*AI\s*DIRECTIVES[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
        /##\s*AI\s*CONSTITUTION[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
        /##\s*🤖\s*INSTRUCTIONS[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
    ];

    for (const pattern of patterns) {
        const match = constitution.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    // Fallback: return default persona
    return "You are a helpful strategic analyst.";
}

/**
 * Generate a Flutter mobile app from a prompt
 * @param prompt - Natural language description
 * @param constitution - Optional context/guidelines
 * @param db - Database type: 'local' or 'supabase'
 * @param ai - AI provider: 'none' or 'openrouter'
 */
export async function generateFlutterApp(
    prompt: string,
    constitution?: string,
    db: string = "local",
    ai: string = "none"
): Promise<void> {
    console.log(chalk.magenta("\n📱 HELIX FLUTTER - Mobile App Generator\n"));

    // Generate project name from prompt
    const projectName = prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(" ")
        .slice(0, 3)
        .join("_")
        .substring(0, 30) || "helix_app";

    const projectPath = path.join(process.cwd(), projectName);

    // Check if directory exists
    if (fs.existsSync(projectPath)) {
        console.error(chalk.red(`❌ Directory "${projectName}" already exists`));
        process.exit(1);
    }

    // Extract AI persona if OpenRouter mode is enabled
    let aiPersona: string | undefined;
    if (ai === "openrouter" && constitution) {
        aiPersona = extractAIDirectives(constitution);
        console.log(chalk.green("🧠 AI Persona extracted from constitution"));
    }

    // Phase 1: Create Flutter project
    const spinner = ora("Creating Flutter project...").start();
    try {
        await execa("flutter", ["create", projectName, "--org", "com.helix"], {
            cwd: process.cwd(),
            stdio: "pipe",
        });
        spinner.succeed("Flutter project created");
    } catch (error) {
        spinner.fail("Failed to create Flutter project");
        console.error(chalk.red("Make sure Flutter is installed and in your PATH"));
        process.exit(1);
    }

    // Phase 2: Add dependencies
    const depSpinner = ora("Installing dependencies...").start();
    try {
        const deps = ["provider"];

        // Add Supabase if cloud mode
        if (db === "supabase") {
            deps.push("supabase_flutter");
        }

        // Add AI dependencies if OpenRouter mode
        if (ai === "openrouter") {
            deps.push("http");
            deps.push("flutter_markdown");
        }

        for (const dep of deps) {
            await execa("flutter", ["pub", "add", dep], {
                cwd: projectPath,
                stdio: "pipe",
            });
        }
        depSpinner.succeed(`Dependencies installed (${deps.join(", ")})`);
    } catch (error) {
        depSpinner.fail("Failed to install dependencies");
    }

    // Phase 3: Generate main.dart with AI
    const codeSpinner = ora("Generating Flutter code...").start();
    try {
        const mainDart = await generateMainDart(prompt, constitution, db, ai);
        await fs.writeFile(path.join(projectPath, "lib", "main.dart"), mainDart);
        codeSpinner.succeed("Flutter code generated");
    } catch (error) {
        codeSpinner.fail("Failed to generate code");
        console.error(error);
    }

    // Phase 4: Generate Supabase-specific files if cloud mode
    if (db === "supabase") {
        const supabaseSpinner = ora("Generating Supabase architecture...").start();
        try {
            // Generate supabase_service.dart
            const servicesDir = path.join(projectPath, "lib", "services");
            await fs.ensureDir(servicesDir);

            const serviceCode = await generateSupabaseService(prompt);
            await fs.writeFile(path.join(servicesDir, "supabase_service.dart"), serviceCode);

            // Generate supabase_schema.sql
            const schemaSQL = await generateSupabaseSchema(prompt);
            await fs.writeFile(path.join(projectPath, "supabase_schema.sql"), schemaSQL);

            supabaseSpinner.succeed("Supabase service & schema generated");
        } catch (error) {
            supabaseSpinner.fail("Failed to generate Supabase files");
            console.error(error);
        }
    }

    // Phase 5: Generate OpenRouter AI files if AI mode
    if (ai === "openrouter") {
        const aiSpinner = ora("Generating AI architecture...").start();
        try {
            const servicesDir = path.join(projectPath, "lib", "services");
            const screensDir = path.join(projectPath, "lib", "screens");
            await fs.ensureDir(servicesDir);
            await fs.ensureDir(screensDir);

            // Generate ai_service.dart with extracted persona
            const aiServiceCode = await generateAIService(aiPersona);
            await fs.writeFile(path.join(servicesDir, "ai_service.dart"), aiServiceCode);

            // Generate chat_screen.dart
            const chatScreenCode = await generateChatScreen(prompt);
            await fs.writeFile(path.join(screensDir, "chat_screen.dart"), chatScreenCode);

            aiSpinner.succeed("AI service & chat screen generated");
        } catch (error) {
            aiSpinner.fail("Failed to generate AI files");
            console.error(error);
        }
    }

    // Phase 6: Success message
    console.log(chalk.green("\n✅ Flutter app created successfully!\n"));
    console.log(chalk.cyan("Next steps:"));
    console.log(chalk.white(`  cd ${projectName}`));

    if (db === "supabase") {
        console.log(chalk.yellow("\n☁️  Supabase Setup Required:"));
        console.log(chalk.white("  1. Create a Supabase project at https://supabase.com"));
        console.log(chalk.white("  2. Run the SQL in supabase_schema.sql in the SQL Editor"));
        console.log(chalk.white("  3. Copy your URL and anon key to lib/main.dart"));
    }

    if (ai === "openrouter") {
        console.log(chalk.green("\n🤖 OpenRouter Setup Required:"));
        console.log(chalk.white("  1. Get an API key from https://openrouter.ai"));
        console.log(chalk.white("  2. Add OPENROUTER_API_KEY to lib/services/ai_service.dart"));
        console.log(chalk.white("  3. The AI persona has been extracted from your constitution"));
    }

    console.log(chalk.white("\n  flutter run"));
    console.log("");
}

/**
 * Regenerate main.dart for an EXISTING Flutter project
 * Used by "helix generate blueprint.helix --target flutter"
 */
export async function regenerateFlutterDart(
    prompt: string,
    constitution?: string,
    db: string = "local",
    ai: string = "none"
): Promise<void> {
    console.log(chalk.magenta("\n📱 HELIX FLUTTER - Regenerating main.dart\n"));

    // Check if we're in a Flutter project
    const libPath = path.join(process.cwd(), "lib");
    const pubspecPath = path.join(process.cwd(), "pubspec.yaml");

    if (!fs.existsSync(pubspecPath)) {
        // Not in a Flutter project - create a new one
        console.log(chalk.yellow("⚠️  Not in a Flutter project. Creating new app..."));
        await generateFlutterApp(prompt, constitution, db, ai);
        return;
    }

    // Regenerate main.dart
    const codeSpinner = ora("Regenerating Flutter code...").start();
    try {
        const mainDart = await generateMainDart(prompt, constitution, db, ai);
        await fs.ensureDir(libPath);
        await fs.writeFile(path.join(libPath, "main.dart"), mainDart);
        codeSpinner.succeed("Flutter code regenerated");
    } catch (error) {
        codeSpinner.fail("Failed to regenerate code");
        console.error(error);
        return;
    }

    console.log(chalk.green("\n✅ main.dart regenerated successfully!\n"));
    console.log(chalk.cyan("Run your app:"));
    console.log(chalk.white("  flutter run"));
    console.log("");
}

/**
 * Generate main.dart content using AI
 */
async function generateMainDart(
    prompt: string,
    constitution?: string,
    db: string = "local",
    ai: string = "none"
): Promise<string> {
    // Build different system prompts based on database mode
    const supabaseInstructions = db === "supabase" ? `
**SUPABASE CLOUD MODE (CRITICAL - MUST FOLLOW):**
You are generating a CLOUD-CONNECTED Flutter app using Supabase.

1. **Configuration:** Add these constants at the TOP of the file (after imports):
   const String SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const String SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

2. **Initialization:** In main(), initialize Supabase BEFORE runApp:
   await Supabase.initialize(url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY);

3. **Imports:** Include:
   import 'package:supabase_flutter/supabase_flutter.dart';

4. **Data Access:** Use SupabaseClient for ALL data operations:
   - Get client: Supabase.instance.client
   - Fetch: await client.from('table_name').select()
   - Insert: await client.from('table_name').insert(data)
   - Delete: await client.from('table_name').delete().eq('id', id)

5. **Realtime:** Use StreamBuilder with Supabase realtime:
   final stream = client.from('table_name').stream(primaryKey: ['id']);
   StreamBuilder<List<Map<String, dynamic>>>(stream: stream, ...)

6. **State Management:** The ChangeNotifier should:
   - Initialize by fetching from Supabase
   - Use Supabase for add/remove operations
   - Subscribe to realtime changes

7. **Table Name:** Use lowercase plural of the model (e.g., 'tasks', 'agents', 'items')

8. **main() must be async:** void main() async { ... }
` : "";

    const openrouterInstructions = ai === "openrouter" ? `
**OPENROUTER AI INTEGRATION (CRITICAL - MUST FOLLOW):**
You are generating a Flutter app with AI chat capabilities.

1. **Import AI Service:**
   import 'services/ai_service.dart';
   import 'screens/chat_screen.dart';

2. **AI FAB:** Add a SECOND FloatingActionButton for AI Analysis:
   FloatingActionButton.extended(
     heroTag: 'ai_fab',
     onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ChatScreen(dataContext: _serializeData()))),
     icon: Icon(Icons.psychology),
     label: Text('AI Analyst'),
     backgroundColor: Color(0xFF7F00FF),
   )

3. **Data Serialization:** Create a method that serializes current app data:
   String _serializeData() {
     // Convert current state to JSON string for AI context
     return jsonEncode(items.map((i) => i.toJson()).toList());
   }

4. **FloatingActionButton Layout:** Use a Column or Stack with two FABs:
   - Primary FAB: Add item (bottom right)
   - AI FAB: Open AI chat (above primary, with heroTag)

5. **Import json:** import 'dart:convert';
` : "";

    const systemPrompt = `You are a Senior Flutter Architect specializing in mobile app development.

TASK: Generate a COMPLETE, WORKING Flutter application in a SINGLE main.dart file.

STRICT REQUIREMENTS:
1. OUTPUT: Generate ONLY the Dart code for lib/main.dart. No explanations, no markdown.
2. TECH STACK:
   - Use MaterialApp with useMaterial3: true
   - Use Provider for state management (already imported)
   - Use ChangeNotifier pattern
3. THEME: Enforce 'Deep Void' Dark Mode:
   - scaffoldBackgroundColor: Color(0xFF0a0a12)
   - primaryColor: Color(0xFFFFD700) (gold accent)
   - Card backgrounds: Color(0xFF1a1a2e)
   - Text: Colors.white and Colors.white70
4. ARCHITECTURE:
   - Create a Data Model class for the main entity (with toJson method)
   - Create a ChangeNotifier class for state management
   - Wrap app in ChangeNotifierProvider
   - Create a Scaffold with AppBar
   - Add a FloatingActionButton that opens showModalBottomSheet for adding items
   - Use ListView.builder with Card widgets for the list
   - Each Card should have an onLongPress to delete
5. IMPORTS: Include all necessary imports at the top:
   import 'package:flutter/material.dart';
   import 'package:provider/provider.dart';
${supabaseInstructions}${openrouterInstructions}

**STRICT DART TYPING RULES (CRITICAL - MUST FOLLOW):**
1. Text Widgets: You CANNOT pass a non-String variable directly to a Text widget.
   - WRONG: Text(agent.rank)
   - RIGHT: Text(agent.rank.toString())
   - RIGHT: Text('\${agent.rank}')
2. String Interpolation: Always use interpolation for mixed content.
   - RIGHT: Text('Value: \${asset.value}')
   - RIGHT: Text('Count: \${items.length}')
3. Form Fields: When setting initialValue for TextFormField with numeric field, use .toString().
   - RIGHT: initialValue: item.count.toString()
4. NEVER assign an int, double, or num to a String variable without .toString().
5. ALL model properties displayed in Text widgets MUST use .toString() or string interpolation.

${constitution ? `CONSTITUTION/CONTEXT:\n${constitution}\n` : ""}

Generate a production-ready Flutter app based on the user's description. Make it visually polished with proper spacing, icons, and animations.`;

    const dbHint = db === "supabase"
        ? "\n\nIMPORTANT: This app uses SUPABASE for cloud database. Data must persist to Supabase, not local state. Use StreamBuilder for realtime updates."
        : "";

    const aiHint = ai === "openrouter"
        ? "\n\nIMPORTANT: This app has AI integration. Add an 'AI Analyst' FAB that opens a ChatScreen. Include data serialization for context injection."
        : "";

    const userPrompt = `Create a Flutter mobile app for: "${prompt}"${dbHint}${aiHint}

Generate the complete main.dart file with:
- A data model class (with toJson method for serialization)
- A ChangeNotifier state class with add/remove methods${db === "supabase" ? " (using Supabase client)" : ""}
- A main widget with the Deep Void dark theme
- ${db === "supabase" ? "StreamBuilder listening to Supabase realtime" : "ListView with Cards showing the data"}
- FloatingActionButton to add new items via bottom sheet
${ai === "openrouter" ? "- SECOND FloatingActionButton for 'AI Analyst' that navigates to ChatScreen" : ""}
- Form with TextFields for each property
- Delete on long press

Output ONLY the Dart code, no markdown or explanations.`;

    const response = await createCompletion(systemPrompt, userPrompt, {
        model: DEFAULT_MODEL,
        maxTokens: 4096,
    });

    // Clean up the response - remove markdown if present
    let code = response.trim();
    if (code.startsWith("```dart")) {
        code = code.slice(7);
    } else if (code.startsWith("```")) {
        code = code.slice(3);
    }
    if (code.endsWith("```")) {
        code = code.slice(0, -3);
    }

    return code.trim();
}

/**
 * Generate Supabase service layer
 */
async function generateSupabaseService(prompt: string): Promise<string> {
    const systemPrompt = `You are a Senior Flutter Architect generating a Supabase service layer.

TASK: Generate a SupabaseService class in Dart.

REQUIREMENTS:
1. OUTPUT: Generate ONLY the Dart code. No explanations, no markdown.
2. IMPORTS:
   import 'package:supabase_flutter/supabase_flutter.dart';
3. CLASS STRUCTURE:
   - Class name: SupabaseService
   - Get client via: Supabase.instance.client
   - Methods:
     * getAll() - Fetch all records with .select()
     * insert(Map<String, dynamic> data) - Insert new record
     * delete(String id) - Delete by id
     * subscribe() - Return realtime stream
4. TABLE: Use lowercase plural based on the data model (guess from prompt)
5. ERROR HANDLING: Include try-catch blocks

Generate clean, well-documented Dart code.`;

    const response = await createCompletion(systemPrompt, `Generate a Supabase service for: "${prompt}"`, {
        model: DEFAULT_MODEL,
        maxTokens: 2048,
    });

    let code = response.trim();
    if (code.startsWith("```dart")) {
        code = code.slice(7);
    } else if (code.startsWith("```")) {
        code = code.slice(3);
    }
    if (code.endsWith("```")) {
        code = code.slice(0, -3);
    }
    return code.trim();
}

/**
 * Generate Supabase PostgreSQL schema
 */
async function generateSupabaseSchema(prompt: string): Promise<string> {
    const systemPrompt = `You are a Senior Database Architect generating PostgreSQL schema for Supabase.

TASK: Generate a complete SQL schema file for Supabase.

REQUIREMENTS:
1. OUTPUT: Generate ONLY valid PostgreSQL SQL. No explanations, no markdown.
2. STRUCTURE:
   - CREATE TABLE statement with appropriate columns
   - Include: id (uuid, primary key, default gen_random_uuid())
   - Include: created_at (timestamptz, default now())
   - Include: updated_at (timestamptz, default now())
   - Add relevant columns based on the app description
3. ROW LEVEL SECURITY (CRITICAL):
   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
   - Create policies for SELECT, INSERT, UPDATE, DELETE
   - Use permissive policies allowing authenticated AND anon access (for demo)
   Example:
   CREATE POLICY "Allow public read" ON table_name FOR SELECT USING (true);
   CREATE POLICY "Allow public insert" ON table_name FOR INSERT WITH CHECK (true);
   CREATE POLICY "Allow public delete" ON table_name FOR DELETE USING (true);
4. REALTIME:
   - Add comment about enabling realtime in dashboard
5. TABLE NAME: Use lowercase plural (e.g., tasks, agents, items)
6. COLUMN TYPES: Use appropriate PostgreSQL types (text, integer, boolean, timestamptz, etc.)

Generate a production-ready PostgreSQL schema.`;

    const response = await createCompletion(systemPrompt, `Generate a Supabase PostgreSQL schema for: "${prompt}"`, {
        model: DEFAULT_MODEL,
        maxTokens: 2048,
    });

    let code = response.trim();
    if (code.startsWith("```sql")) {
        code = code.slice(6);
    } else if (code.startsWith("```")) {
        code = code.slice(3);
    }
    if (code.endsWith("```")) {
        code = code.slice(0, -3);
    }

    // Add header comment
    const header = `-- Helix Generated Supabase Schema
-- Generated for: ${prompt}
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file and run it
-- 4. Enable Realtime for the table in Table Editor > Realtime
--
-- ============================================================================

`;

    return header + code.trim();
}

/**
 * Generate OpenRouter AI service with persona injection
 */
async function generateAIService(persona?: string): Promise<string> {
    const defaultPersona = "You are a helpful strategic analyst.";
    const finalPersona = persona || defaultPersona;

    // Escape the persona for Dart string
    const escapedPersona = finalPersona
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");

    const systemPrompt = `You are a Senior Flutter Architect generating an OpenRouter AI service.

TASK: Generate an OpenRouterService class in Dart for AI chat functionality.

REQUIREMENTS:
1. OUTPUT: Generate ONLY the Dart code. No explanations, no markdown.
2. IMPORTS:
   import 'dart:convert';
   import 'package:http/http.dart' as http;
3. CONFIGURATION:
   - const String OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY';
   - const String _endpoint = 'https://openrouter.ai/api/v1/chat/completions';
   - const String _model = 'meta-llama/llama-3-8b-instruct:free';
4. SYSTEM PERSONA (CRITICAL - HARD-CODE THIS EXACT TEXT):
   const String _systemPersona = '''${escapedPersona}''';
5. CLASS STRUCTURE:
   - Class name: OpenRouterService
   - Singleton pattern with static instance
   - Method: Future<String> sendMessage(String userMessage, String dataContext)
     * Creates messages array with:
       - system message: _systemPersona + "\\n\\nCurrent Data Context: " + dataContext
       - user message
     * Makes POST request to _endpoint
     * Parses response and returns assistant content
6. ERROR HANDLING: Return error message on failure, don't throw
7. HEADERS:
   - 'Authorization': 'Bearer \$OPENROUTER_API_KEY'
   - 'Content-Type': 'application/json'
   - 'HTTP-Referer': 'https://helix-app.dev'
   - 'X-Title': 'Helix AI'

Generate clean, well-documented Dart code.`;

    const response = await createCompletion(systemPrompt, `Generate an OpenRouter AI service with the embedded system persona.`, {
        model: DEFAULT_MODEL,
        maxTokens: 2048,
    });

    let code = response.trim();
    if (code.startsWith("```dart")) {
        code = code.slice(7);
    } else if (code.startsWith("```")) {
        code = code.slice(3);
    }
    if (code.endsWith("```")) {
        code = code.slice(0, -3);
    }
    return code.trim();
}

/**
 * Generate AI Chat Screen
 */
async function generateChatScreen(prompt: string): Promise<string> {
    const systemPrompt = `You are a Senior Flutter Architect generating an AI chat screen.

TASK: Generate a ChatScreen widget in Dart for AI conversation.

REQUIREMENTS:
1. OUTPUT: Generate ONLY the Dart code. No explanations, no markdown.
2. IMPORTS:
   import 'package:flutter/material.dart';
   import 'package:flutter_markdown/flutter_markdown.dart';
   import '../services/ai_service.dart';
3. WIDGET: ChatScreen (StatefulWidget)
   - Constructor accepts: String dataContext (for app data context injection)
   - State holds: List<Map<String, String>> messages, TextEditingController, bool isLoading
4. THEME: Deep Void Dark Mode:
   - Scaffold background: Color(0xFF0a0a12)
   - User messages: Color(0xFF1a1a2e) with gold border
   - AI messages: Color(0xFF0f0f1a) with purple accent
5. UI STRUCTURE:
   - AppBar with title "4See AI Analyst" and back button
   - ListView.builder for messages
   - Each message shows role (You/AI) and content (use MarkdownBody for AI)
   - Bottom input area with TextField and send button
   - Loading indicator when waiting for response
6. SEND LOGIC:
   - Add user message to list
   - Call OpenRouterService.instance.sendMessage(userMessage, dataContext)
   - Add AI response to list
7. STYLING:
   - Rounded message bubbles with proper padding
   - Gold accent for user, purple for AI
   - Smooth scroll to bottom on new message

Generate clean, visually polished Dart code.`;

    const response = await createCompletion(systemPrompt, `Generate an AI chat screen for an app about: "${prompt}"`, {
        model: DEFAULT_MODEL,
        maxTokens: 2048,
    });

    let code = response.trim();
    if (code.startsWith("```dart")) {
        code = code.slice(7);
    } else if (code.startsWith("```")) {
        code = code.slice(3);
    }
    if (code.endsWith("```")) {
        code = code.slice(0, -3);
    }
    return code.trim();
}

/**
 * Parse the prompt to extract data model structure
 */
export function parseFlutterPrompt(prompt: string): FlutterStrand[] {
    // Simple extraction - AI will handle the actual interpretation
    const strands: FlutterStrand[] = [];

    // Look for common patterns like "with X, Y, and Z fields"
    const match = prompt.match(/with\s+(.+?)(?:\.|$)/i);
    if (match) {
        const fieldsStr = match[1];
        const fields = fieldsStr.split(/,\s*|\s+and\s+/i).map(f => ({
            name: f.trim().replace(/\s+/g, "_"),
            type: "String"
        }));

        // Extract main entity name
        const entityMatch = prompt.match(/(?:a|an)\s+(\w+)/i);
        const entityName = entityMatch ? entityMatch[1] : "Item";

        strands.push({
            name: entityName.charAt(0).toUpperCase() + entityName.slice(1),
            fields
        });
    }

    return strands;
}
