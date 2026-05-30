/**
 * Shared types for git workflow commands.
 */

export interface GitRunner {
    (command: string, args: string[], opts?: { cwd?: string }): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}

export interface AiClient {
    (systemPrompt: string, userMessage: string, opts?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string>;
}
