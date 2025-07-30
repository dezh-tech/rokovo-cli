import { MCPClient } from './client';
import { MCPServerConfig, MCPServerError } from '../types';
import fetch from 'node-fetch';

export interface MCPManagerOptions {
  enabledServers?: string[];
  serverTimeout?: number;
  maxRetries?: number;
}

export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();

  constructor(private options: MCPManagerOptions = {}) {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    // File System MCP Server
    this.configs.set('filesystem', {
      name: 'filesystem',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
      enabled: true
    });

    // Memory MCP Server
    this.configs.set('memory', {
      name: 'memory',
      command: 'npx',
      args: ['@modelcontextprotocol/server-memory'],
      enabled: true
    });

    // Note: Fetch functionality will be implemented directly using node-fetch
    // since the official @modelcontextprotocol/server-fetch is not published as a separate package
    // Git functionality will use isomorphic-git directly for better reliability
  }

  async initialize(): Promise<void> {
    const enabledServers = this.options.enabledServers || ['filesystem', 'memory'];
    
    for (const serverName of enabledServers) {
      const config = this.configs.get(serverName);
      if (!config || !config.enabled) {
        continue;
      }

      try {
        const client = new MCPClient(config, {
          timeout: this.options.serverTimeout,
          retryAttempts: this.options.maxRetries
        });

        await client.connect();
        this.clients.set(serverName, client);
        
        console.log(`✓ Connected to ${serverName} MCP server`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠ Failed to connect to ${serverName} MCP server: ${message}`);
        // Continue with other servers even if one fails
      }
    }
  }

  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(error => {
        console.warn(`Warning: Error disconnecting MCP client: ${error.message}`);
      })
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  getClient(serverName: string): MCPClient | null {
    return this.clients.get(serverName) || null;
  }

  isServerAvailable(serverName: string): boolean {
    const client = this.clients.get(serverName);
    return client ? client.isClientConnected() : false;
  }

  getAvailableServers(): string[] {
    return Array.from(this.clients.keys()).filter(name => 
      this.isServerAvailable(name)
    );
  }

  // File System Operations
  async readFile(filePath: string): Promise<string> {
    const client = this.getClient('filesystem');
    if (!client) {
      throw new MCPServerError('Filesystem MCP server not available');
    }

    try {
      const result = await client.callTool('read_file', { path: filePath });
      return result as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to read file: ${message}`, {
        filePath,
        error: message
      });
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const client = this.getClient('filesystem');
    if (!client) {
      throw new MCPServerError('Filesystem MCP server not available');
    }

    try {
      await client.callTool('write_file', { path: filePath, content });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to write file: ${message}`, {
        filePath,
        error: message
      });
    }
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    const client = this.getClient('filesystem');
    if (!client) {
      throw new MCPServerError('Filesystem MCP server not available');
    }

    try {
      const result = await client.callTool('list_directory', { path: dirPath });
      return result as string[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to list directory: ${message}`, {
        dirPath,
        error: message
      });
    }
  }

  // Memory Operations
  async storeMemory(key: string, value: unknown): Promise<void> {
    const client = this.getClient('memory');
    if (!client) {
      throw new MCPServerError('Memory MCP server not available');
    }

    try {
      await client.callTool('store', { key, value });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to store memory: ${message}`, {
        key,
        error: message
      });
    }
  }

  async retrieveMemory(key: string): Promise<unknown> {
    const client = this.getClient('memory');
    if (!client) {
      throw new MCPServerError('Memory MCP server not available');
    }

    try {
      const result = await client.callTool('retrieve', { key });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to retrieve memory: ${message}`, {
        key,
        error: message
      });
    }
  }

  async searchMemory(query: string): Promise<unknown[]> {
    const client = this.getClient('memory');
    if (!client) {
      throw new MCPServerError('Memory MCP server not available');
    }

    try {
      const result = await client.callTool('search', { query });
      return result as unknown[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to search memory: ${message}`, {
        query,
        error: message
      });
    }
  }

  // Fetch functionality (direct implementation since MCP fetch server isn't published)
  async fetchUrl(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ content: string; contentType?: string; status: number }> {
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body
      });

      const content = await response.text();
      const contentType = response.headers.get('content-type') || undefined;

      return {
        content,
        contentType,
        status: response.status
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to fetch URL: ${message}`, {
        url,
        error: message
      });
    }
  }

  // Utility methods
  async testConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, client] of this.clients) {
      try {
        await client.listTools();
        results[name] = true;
      } catch {
        results[name] = false;
      }
    }

    return results;
  }

  getServerStatus(): Record<string, { connected: boolean; tools: number }> {
    const status: Record<string, { connected: boolean; tools: number }> = {};
    
    for (const [name, client] of this.clients) {
      status[name] = {
        connected: client.isClientConnected(),
        tools: 0 // Will be populated by listTools if needed
      };
    }

    return status;
  }
}
