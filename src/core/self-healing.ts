/**
 * Helix Self-Healing Cortex v10.0
 * Automatic error detection, retry, and repair for AI-generated code
 */

import chalk from "chalk";
import ora from "ora";
import { createCompletion, DEFAULT_MODEL } from "../openrouter";
import { GenerationResult, FileSystemMap } from "./types";

const MAX_REPAIR_ATTEMPTS = 2;

/**
 * Self-Healing wrapper for AI generation calls
 * Automatically retries and attempts to repair broken output
 */
export class SelfHealingCortex {
    private repairLog: string[] = [];

    /**
     * Execute an AI generation with self-healing
     * @param generator - The generation function to execute
     * @param validator - Validation function that throws on invalid output
     */
    async execute<T>(
        generator: () => Promise<T>,
        validator: (result: T) => void,
        repairContext?: string
    ): Promise<GenerationResult<T>> {
        this.repairLog = [];
        let attempts = 0;
        let lastError = "";

        while (attempts <= MAX_REPAIR_ATTEMPTS) {
            attempts++;

            try {
                const result = await generator();

                // Validate the result
                try {
                    validator(result);
                    return {
                        success: true,
                        data: result,
                        attempts,
                        repairLog: this.repairLog,
                    };
                } catch (validationError: any) {
                    lastError = validationError.message || String(validationError);
                    this.repairLog.push(`Attempt ${attempts}: Validation failed - ${lastError}`);

                    if (attempts <= MAX_REPAIR_ATTEMPTS) {
                        console.log(chalk.yellow(`⚠️  Validation failed, attempting repair (${attempts}/${MAX_REPAIR_ATTEMPTS})...`));
                    }
                }
            } catch (generationError: any) {
                lastError = generationError.message || String(generationError);
                this.repairLog.push(`Attempt ${attempts}: Generation failed - ${lastError}`);

                if (attempts <= MAX_REPAIR_ATTEMPTS) {
                    console.log(chalk.yellow(`⚠️  Generation failed, retrying (${attempts}/${MAX_REPAIR_ATTEMPTS})...`));
                }
            }
        }

        return {
            success: false,
            error: lastError,
            attempts,
            repairLog: this.repairLog,
        };
    }

    /**
     * Execute AI generation that returns JSON and self-heal invalid JSON
     */
    async executeJSON<T>(
        systemPrompt: string,
        userPrompt: string,
        parseAndValidate: (json: any) => T
    ): Promise<GenerationResult<T>> {
        this.repairLog = [];
        let attempts = 0;
        let currentPrompt = userPrompt;
        let lastError = "";

        while (attempts <= MAX_REPAIR_ATTEMPTS) {
            attempts++;

            try {
                const response = await createCompletion(systemPrompt, currentPrompt, {
                    model: DEFAULT_MODEL,
                    maxTokens: 8192,
                });

                // Try to extract JSON from response
                const jsonStr = this.extractJSON(response);
                const parsed = JSON.parse(jsonStr);
                const validated = parseAndValidate(parsed);

                return {
                    success: true,
                    data: validated,
                    attempts,
                    repairLog: this.repairLog,
                };

            } catch (error: any) {
                lastError = error.message || String(error);
                this.repairLog.push(`Attempt ${attempts}: ${lastError}`);

                if (attempts <= MAX_REPAIR_ATTEMPTS) {
                    // Create a repair request
                    currentPrompt = this.createRepairPrompt(userPrompt, lastError);
                    console.log(chalk.yellow(`⚠️  JSON parsing failed, requesting repair (${attempts}/${MAX_REPAIR_ATTEMPTS})...`));
                }
            }
        }

        return {
            success: false,
            error: `Failed after ${attempts} attempts: ${lastError}`,
            attempts,
            repairLog: this.repairLog,
        };
    }

    /**
     * Execute code generation with build validation
     */
    async executeWithBuildCheck(
        generator: () => Promise<string>,
        buildChecker: (code: string) => Promise<{ success: boolean; error?: string }>
    ): Promise<GenerationResult<string>> {
        this.repairLog = [];
        let attempts = 0;
        let currentCode = "";
        let lastError = "";

        while (attempts <= MAX_REPAIR_ATTEMPTS) {
            attempts++;

            try {
                currentCode = await generator();
                const buildResult = await buildChecker(currentCode);

                if (buildResult.success) {
                    return {
                        success: true,
                        data: currentCode,
                        attempts,
                        repairLog: this.repairLog,
                    };
                }

                lastError = buildResult.error || "Build failed";
                this.repairLog.push(`Attempt ${attempts}: Build failed - ${lastError}`);

                if (attempts <= MAX_REPAIR_ATTEMPTS) {
                    console.log(chalk.yellow(`⚠️  Build check failed, attempting repair (${attempts}/${MAX_REPAIR_ATTEMPTS})...`));
                    // Request AI to fix the code
                    currentCode = await this.repairCode(currentCode, lastError);
                }

            } catch (error: any) {
                lastError = error.message || String(error);
                this.repairLog.push(`Attempt ${attempts}: ${lastError}`);
            }
        }

        return {
            success: false,
            error: lastError,
            attempts,
            repairLog: this.repairLog,
        };
    }

    /**
     * Extract JSON from a potentially markdown-wrapped response
     */
    private extractJSON(response: string): string {
        let json = response.trim();

        // Remove markdown code fences
        if (json.startsWith("```json")) {
            json = json.slice(7);
        } else if (json.startsWith("```")) {
            json = json.slice(3);
        }
        if (json.endsWith("```")) {
            json = json.slice(0, -3);
        }

        // Try to find JSON object/array bounds
        const startBrace = json.indexOf("{");
        const startBracket = json.indexOf("[");
        const start = startBrace === -1 ? startBracket :
            startBracket === -1 ? startBrace :
                Math.min(startBrace, startBracket);

        if (start !== -1) {
            json = json.slice(start);
        }

        // Find matching end
        let depth = 0;
        let end = 0;
        const openChar = json[0];
        const closeChar = openChar === "{" ? "}" : "]";

        for (let i = 0; i < json.length; i++) {
            if (json[i] === openChar) depth++;
            if (json[i] === closeChar) depth--;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }

        if (end > 0) {
            json = json.slice(0, end);
        }

        return json.trim();
    }

    /**
     * Create a repair prompt based on the original prompt and error
     */
    private createRepairPrompt(originalPrompt: string, error: string): string {
        return `The previous generation had an error:
ERROR: ${error}

Please fix the issue and regenerate. Remember:
1. Output ONLY valid JSON, no markdown or explanations
2. Ensure all required fields are present
3. Ensure proper escaping of special characters

ORIGINAL REQUEST:
${originalPrompt}`;
    }

    /**
     * Ask AI to repair broken code
     */
    private async repairCode(brokenCode: string, error: string): Promise<string> {
        const systemPrompt = `You are a code repair specialist. 
Fix the error in the provided code and return ONLY the corrected code.
Do not include explanations or markdown fences.`;

        const userPrompt = `Fix this code that has an error:

ERROR:
${error}

CODE:
${brokenCode}

Return the fixed code only.`;

        const response = await createCompletion(systemPrompt, userPrompt, {
            model: DEFAULT_MODEL,
            maxTokens: 8192,
        });

        // Clean response
        let code = response.trim();
        if (code.startsWith("```")) {
            const endOfFirstLine = code.indexOf("\n");
            code = code.slice(endOfFirstLine + 1);
        }
        if (code.endsWith("```")) {
            code = code.slice(0, -3);
        }

        return code.trim();
    }

    /**
     * Get the repair log
     */
    getRepairLog(): string[] {
        return [...this.repairLog];
    }
}

// Export singleton
export const selfHeal = new SelfHealingCortex();
