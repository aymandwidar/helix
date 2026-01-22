/**
 * Helix Flutter Generator v4.2
 * Generates Flutter mobile apps from natural language prompts
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
 * Generate a Flutter mobile app from a prompt
 */
export async function generateFlutterApp(
    prompt: string,
    constitution?: string
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
        await execa("flutter", ["pub", "add", "provider"], {
            cwd: projectPath,
            stdio: "pipe",
        });
        depSpinner.succeed("Dependencies installed");
    } catch (error) {
        depSpinner.fail("Failed to install dependencies");
    }

    // Phase 3: Generate main.dart with AI
    const codeSpinner = ora("Generating Flutter code...").start();
    try {
        const mainDart = await generateMainDart(prompt, constitution);
        await fs.writeFile(path.join(projectPath, "lib", "main.dart"), mainDart);
        codeSpinner.succeed("Flutter code generated");
    } catch (error) {
        codeSpinner.fail("Failed to generate code");
        console.error(error);
    }

    // Phase 4: Success message
    console.log(chalk.green("\n✅ Flutter app created successfully!\n"));
    console.log(chalk.cyan("Next steps:"));
    console.log(chalk.white(`  cd ${projectName}`));
    console.log(chalk.white("  flutter run"));
    console.log("");
}

/**
 * Generate main.dart content using AI
 */
async function generateMainDart(
    prompt: string,
    constitution?: string
): Promise<string> {
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
   - Create a Data Model class for the main entity
   - Create a ChangeNotifier class for state management
   - Wrap app in ChangeNotifierProvider
   - Create a Scaffold with AppBar
   - Add a FloatingActionButton that opens showModalBottomSheet for adding items
   - Use ListView.builder with Card widgets for the list
   - Each Card should have an onLongPress to delete
5. IMPORTS: Include all necessary imports at the top:
   import 'package:flutter/material.dart';
   import 'package:provider/provider.dart';

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

    const userPrompt = `Create a Flutter mobile app for: "${prompt}"

Generate the complete main.dart file with:
- A data model class
- A ChangeNotifier state class with add/remove methods
- A main widget with the Deep Void dark theme
- ListView with Cards showing the data
- FloatingActionButton to add new items via bottom sheet
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
