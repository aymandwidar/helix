/**
 * Plugin v2 — chat tool plugins.
 *
 * A chat plugin extends the chat agent's tool registry. It is an npm package
 * named `helix-tool-*` (or registered via `~/.helix/settings.json` →
 * `chatPlugins`) whose default export conforms to `ChatPlugin`.
 *
 * Example plugin module:
 *   import type { ChatPlugin } from "helix-lang/plugins";
 *   const plugin: ChatPlugin = {
 *     name: "helix-tool-jira",
 *     version: "1.0.0",
 *     tools: [{ name: "jira_search", description: "...", parameters: {...}, execute: async (args, ctx) => {...} }],
 *   };
 *   export default plugin;
 */

import { ToolDefinition } from "../chat/tools";

export interface ChatPlugin {
    name: string;
    version: string;
    description?: string;
    /** Tools to register into the chat tool registry. */
    tools: ToolDefinition[];
    /** Optional setup hook called once at load time (no return value). */
    setup?(): Promise<void> | void;
}

export interface LoadedChatPlugin {
    plugin: ChatPlugin;
    /** Module path that was loaded. */
    modulePath: string;
    /** Names of tools actually registered (may be fewer than plugin.tools if duplicates skipped). */
    registered: string[];
}
