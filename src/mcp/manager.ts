import { experimental_createMCPClient, Tool, ToolSet } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class McpManager {
  private mcpClients: Map<string, any> = new Map(); // Store initialized clients for cleanup
  constructor() {}

  async initializeServers(): Promise<void> {
    const fsMcpServer = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    });
    const fsMcpClient = await experimental_createMCPClient({
      transport: fsMcpServer,
      onUncaughtError(error) {
        console.error('Uncaught error in filesystem MCP server:', error);
      },
    });
    this.mcpClients.set('filesystem', fsMcpClient);

    // const memoryMcpServer = new StdioClientTransport({
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-memory'],
    // });
    // const memoryMcpClient = await experimental_createMCPClient({
    //   transport: memoryMcpServer,
    //   onUncaughtError(error) {
    //     console.error('Uncaught error in memory MCP server:', error);
    //   },
    // });
    // this.mcpClients.set('memory', memoryMcpClient);

    // const thinkingMcpServer = new StdioClientTransport({
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    // });
    // const thinkingMcpClient = await experimental_createMCPClient({
    //   transport: thinkingMcpServer,
    //   onUncaughtError(error) {
    //     console.error('Uncaught error in thinking MCP server:', error);
    //   },
    // });

    // this.mcpClients.set('thinking', thinkingMcpClient);
  }

  async getTools() {
    const tools: ToolSet = {};

    for (const [, client] of this.mcpClients.entries()) {
      const clientTools = await client.tools();

      for (const [toolName, tool] of Object.entries(clientTools)) {
        tools[toolName] = tool as Tool;
      }
    }

    return tools;
  }

  async shutdownServers(): Promise<void> {
    // Close MCP clients first
    for (const client of this.mcpClients.values()) {
      try {
        await client.close();
      } catch (error) {
        console.warn('Error closing MCP client:', error);
      }
    }
    this.mcpClients.clear();

    // Then close transports
    for (const server of this.mcpClients.values()) {
      try {
        await server.close();
      } catch (error) {
        console.warn('Error closing MCP transport:', error);
      }
    }
    this.mcpClients.clear();
  }
}
