/**
 * Helix Researcher - The Lead Researcher
 * Conducts deep domain analysis and generates context files
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { createCompletion } from "./openrouter";
import { RESEARCHER_SYSTEM_PROMPT } from "./types";

/**
 * Conducts deep research on a topic and generates a context file
 * @param topic - The domain/topic to research
 * @param model - Optional model override
 * @returns The path to the generated research.md file
 */
export async function conductResearch(
    topic: string,
    model?: string
): Promise<string> {
    console.log(chalk.magenta(`\n🔍 Conducting deep research on: "${topic}"...\n`));

    try {
        const researchContent = await createCompletion(
            RESEARCHER_SYSTEM_PROMPT,
            `Please conduct a comprehensive domain analysis on: ${topic}`,
            { model, maxTokens: 8192 }
        );

        // Write to research.md in current directory
        const outputPath = path.join(process.cwd(), "research.md");

        // Add header with metadata
        const fullContent = `# Helix Research Report
## Topic: ${topic}
## Generated: ${new Date().toISOString()}

---

${researchContent}
`;

        fs.writeFileSync(outputPath, fullContent, "utf-8");

        console.log(chalk.green("\n✅ Research complete!"));
        console.log(chalk.green(`📄 Context saved to: ${outputPath}`));
        console.log(chalk.gray("\n--- Research Summary ---"));
        console.log(chalk.white(researchContent.substring(0, 500) + "..."));
        console.log(chalk.gray("--- End of Summary ---\n"));

        return outputPath;
    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red(`❌ Research Error: ${error.message}`));
        }
        throw error;
    }
}
