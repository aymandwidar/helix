/**
 * Helix Compiler - The Builder
 * Transpiles .helix blueprints into React/Next.js + TypeScript + Tailwind code
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { createCompletion } from "./openrouter";
import { COMPILER_SYSTEM_PROMPT } from "./types";

/**
 * Compiles a .helix blueprint file into React/Next.js code
 * @param filePath - Path to the .helix file to compile
 * @param model - Optional model override
 * @returns The path to the generated .tsx file
 */
export async function compileToReact(
    filePath: string,
    model?: string
): Promise<string> {
    console.log(chalk.green("\n⚙️  Helix Compiler initializing..."));

    // Resolve file path
    const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
        console.error(chalk.red(`❌ File not found: ${fullPath}`));
        throw new Error(`File not found: ${fullPath}`);
    }

    // Read the .helix file
    const helixCode = fs.readFileSync(fullPath, "utf-8");
    console.log(chalk.gray(`📥 Reading: ${fullPath}`));
    console.log(chalk.gray("\n--- Helix Blueprint ---"));
    console.log(chalk.cyan(helixCode.substring(0, 300) + (helixCode.length > 300 ? "..." : "")));
    console.log(chalk.gray("--- End of Blueprint ---\n"));

    try {
        const reactCode = await createCompletion(
            COMPILER_SYSTEM_PROMPT,
            `Compile this Helix blueprint into a production-ready React/Next.js component:\n\n${helixCode}`,
            { model, maxTokens: 8192 }
        );

        // Generate output filename (same as input but with .tsx extension)
        const inputBasename = path.basename(fullPath, ".helix");
        const outputPath = path.join(path.dirname(fullPath), `${inputBasename}.tsx`);
        fs.writeFileSync(outputPath, reactCode, "utf-8");

        console.log(chalk.green("\n✅ Compilation complete!"));
        console.log(chalk.green(`📄 Output: ${outputPath}`));
        console.log(chalk.gray("\n--- Generated React Component ---"));
        console.log(chalk.white(reactCode.substring(0, 500) + (reactCode.length > 500 ? "..." : "")));
        console.log(chalk.gray("--- End of Component ---\n"));

        return outputPath;
    } catch (error) {
        if (error instanceof Error) {
            console.error(chalk.red(`❌ Compiler Error: ${error.message}`));
        }
        throw error;
    }
}
