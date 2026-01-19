/**
 * Helix Architect - The Interviewer
 * Converts vague user prompts into rigorous .helix specification files
 * v2.0 - Now with context-aware drafting via OpenRouter
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { createCompletion } from "./openrouter";
import { ARCHITECT_SYSTEM_PROMPT } from "./types";

/**
 * Drafts a Helix blueprint from a user idea, optionally using research context
 * @param userIdea - The user's idea/request to convert into Helix syntax
 * @param contextFilePath - Optional path to a research context file
 * @param model - Optional model override
 * @returns The path to the generated .helix file
 */
export async function draftBlueprint(
    userIdea: string,
    contextFilePath?: string,
    model?: string
): Promise<string> {
    console.log(chalk.blue("\n🧬 Helix Architect initializing..."));
    console.log(chalk.gray(`Processing idea: "${userIdea}"`));

    let contextContent = "";

    // Check if context file exists and read it
    if (contextFilePath) {
        const fullPath = path.isAbsolute(contextFilePath)
            ? contextFilePath
            : path.join(process.cwd(), contextFilePath);

        if (fs.existsSync(fullPath)) {
            contextContent = fs.readFileSync(fullPath, "utf-8");
            console.log(chalk.yellow(`📚 Using context from: ${fullPath}`));
        } else {
            console.log(chalk.yellow(`⚠️  Context file not found: ${fullPath}`));
        }
    } else {
        // Default: check for research.md in current directory
        const defaultContext = path.join(process.cwd(), "research.md");
        if (fs.existsSync(defaultContext)) {
            contextContent = fs.readFileSync(defaultContext, "utf-8");
            console.log(chalk.yellow(`📚 Auto-detected context: ${defaultContext}`));
        }
    }

    try {
        // Construct the prompt with or without context
        let userMessage = "";

        if (contextContent) {
            userMessage = `**RESEARCH CONTEXT:**
${contextContent}

---

**USER IDEA:**
${userIdea}

---

**INSTRUCTIONS:**
Use the Research Context above to inform the fields, data types, and logic of the Helix Blueprint.
If the research mentions specific constraints (e.g., service intervals, regulatory limits, data schemas), incorporate them into the 'strand' definitions.
Generate a comprehensive Helix blueprint that addresses the user's idea while respecting domain-specific requirements.`;
        } else {
            userMessage = userIdea;
        }

        const helixCode = await createCompletion(
            ARCHITECT_SYSTEM_PROMPT,
            userMessage,
            { model, maxTokens: 4096 }
        );

        // Generate output filename from the idea (sanitized)
        const sanitizedName = userIdea
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .substring(0, 30)
            .replace(/-+$/, "");

        const outputPath = path.join(process.cwd(), `${sanitizedName}.helix`);
        fs.writeFileSync(outputPath, helixCode, "utf-8");

        console.log(chalk.blue("\n✨ Blueprint drafted successfully!"));
        console.log(chalk.blue(`📄 Output: ${outputPath}`));
        console.log(chalk.gray("\n--- Generated Helix Blueprint ---"));
        console.log(chalk.cyan(helixCode));
        console.log(chalk.gray("--- End of Blueprint ---\n"));

        return outputPath;
    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red(`❌ Architect Error: ${error.message}`));
        }
        throw error;
    }
}
