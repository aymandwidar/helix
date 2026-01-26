/**
 * Helix Core Types v10.0
 * Type definitions for the Helix Development Platform
 */

// =============================================================================
// FILE SYSTEM MAP - Multi-File Output Structure
// =============================================================================

/**
 * Represents a single file to be generated
 */
export interface GeneratedFile {
    /** Relative path from project root (e.g., "lib/models/task.dart") */
    path: string;
    /** File content */
    content: string;
    /** Whether this file can be overwritten if it exists */
    overwrite?: boolean;
}

/**
 * A map of all files to be generated for a project
 */
export interface FileSystemMap {
    /** List of files to generate */
    files: GeneratedFile[];
    /** Project metadata */
    metadata: {
        projectName: string;
        generatedAt: string;
        helixVersion: string;
        target: "flutter" | "web";
        database?: "local" | "supabase";
        ai?: "none" | "openrouter";
    };
}

// =============================================================================
// GENERATION RESULT - Self-Healing Support
// =============================================================================

/**
 * Result of a code generation attempt
 */
export interface GenerationResult<T = string> {
    success: boolean;
    data?: T;
    error?: string;
    attempts: number;
    repairLog?: string[];
}

// =============================================================================
// PLUGIN SYSTEM - Dynamic Generator Loading
// =============================================================================

/**
 * Interface that all Helix generator plugins must implement
 */
export interface GeneratorPlugin {
    /** Unique plugin identifier (e.g., "helix-gen-expo") */
    name: string;
    /** Human-readable description */
    description: string;
    /** Target platform identifier (e.g., "expo", "tauri") */
    target: string;
    /** Plugin version */
    version: string;

    /**
     * Generate a complete project from a prompt
     * @param prompt - Natural language description
     * @param constitution - Optional context/guidelines
     * @param options - Additional generation options
     */
    generate(
        prompt: string,
        constitution?: string,
        options?: Record<string, string>
    ): Promise<FileSystemMap>;

    /**
     * Get the dependencies required for this target
     */
    getDependencies(): string[];

    /**
     * Get scaffold command (e.g., "flutter create", "npx create-expo-app")
     */
    getScaffoldCommand(projectName: string): { command: string; args: string[] };
}

/**
 * Registry entry for a discovered plugin
 */
export interface PluginRegistryEntry {
    name: string;
    target: string;
    version: string;
    modulePath: string;
    isBuiltIn: boolean;
}

// =============================================================================
// DEPLOYMENT - Platform Configuration
// =============================================================================

/**
 * Supported deployment platforms
 */
export type DeploymentPlatform = "vercel" | "firebase" | "netlify" | "codemagic";

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
    platform: DeploymentPlatform;
    projectType: "flutter" | "nextjs";
    buildCommand: string;
    outputDir: string;
    envVars?: Record<string, string>;
}

// =============================================================================
// PREVIEW - Hot Reload Configuration
// =============================================================================

/**
 * Preview server configuration
 */
export interface PreviewConfig {
    projectType: "flutter" | "nextjs";
    command: string;
    args: string[];
    watchPatterns: string[];
    port?: number;
}

// =============================================================================
// AI GENERATION - Structured Output
// =============================================================================

/**
 * Request for AI-powered code generation
 */
export interface AIGenerationRequest {
    systemPrompt: string;
    userPrompt: string;
    expectedFormat: "code" | "json" | "markdown";
    maxTokens?: number;
    temperature?: number;
}

/**
 * Parsed response from AI generation
 */
export interface AIGenerationResponse {
    raw: string;
    parsed?: FileSystemMap;
    isValid: boolean;
    validationErrors?: string[];
}
