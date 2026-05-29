/**
 * MCP module entry point — re-exports the public surface.
 */

export { McpRegistry, type McpClientFactory, type ServerStatus } from "./registry";
export { StdioMcpClient, type McpClientLike, type McpToolDescriptor, type CallToolResult } from "./client";
export {
    type McpServerConfig,
    type HelixSettings,
    loadSettings,
    saveSettings,
    addMcpServer,
    removeMcpServer,
    listMcpServers,
    getSettingsPath,
    getSettingsDir,
} from "./config";
export { bridgeMcpTool, bridgeAllAutoServers } from "./tool_bridge";
