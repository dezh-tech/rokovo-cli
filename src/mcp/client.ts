import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig, MCPServerError } from '@/types';

export interface MCPClientOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  constructor(
    private config: MCPServerConfig,
    private options: MCPClientOptions = {}
  ) {
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create environment with proper typing
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
      if (this.config.env) {
        Object.assign(env, this.config.env);
      }

      // Create transport and client
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env
      });

      this.client = new Client({
        name: `khodkar-cli-${this.config.name}`,
        version: '1.0.0'
      }, {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}
        }
      });

      // Connect with timeout
      await Promise.race([
        this.client.connect(this.transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), this.options.timeout)
        )
      ]);

      this.isConnected = true;

    } catch (error) {
      await this.cleanup();
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to connect to MCP server: ${message}`, {
        serverName: this.config.name,
        error: message
      });
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.isConnected = false;

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.transport = null;
    }

    // Transport handles process cleanup
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.isConnected) {
      throw new MCPServerError('MCP client not connected', {
        serverName: this.config.name
      });
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: arguments_
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Tool call failed: ${message}`, {
        serverName: this.config.name,
        toolName: name,
        arguments: arguments_,
        error: message
      });
    }
  }

  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    if (!this.client || !this.isConnected) {
      throw new MCPServerError('MCP client not connected', {
        serverName: this.config.name
      });
    }

    try {
      const result = await this.client.listTools();
      return result.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to list tools: ${message}`, {
        serverName: this.config.name,
        error: message
      });
    }
  }

  async getResource(uri: string): Promise<unknown> {
    if (!this.client || !this.isConnected) {
      throw new MCPServerError('MCP client not connected', {
        serverName: this.config.name
      });
    }

    try {
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to get resource: ${message}`, {
        serverName: this.config.name,
        uri,
        error: message
      });
    }
  }

  async listResources(): Promise<Array<{ uri: string; name?: string; description?: string }>> {
    if (!this.client || !this.isConnected) {
      throw new MCPServerError('MCP client not connected', {
        serverName: this.config.name
      });
    }

    try {
      const result = await this.client.listResources();
      return result.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPServerError(`Failed to list resources: ${message}`, {
        serverName: this.config.name,
        error: message
      });
    }
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  getServerName(): string {
    return this.config.name;
  }
}
