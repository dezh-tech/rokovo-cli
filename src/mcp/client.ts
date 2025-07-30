import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig, MCPServerError } from '../types';

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
      timeout: 10000, // Reduced timeout to 10 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    let lastError: Error | null = null;

    // Retry connection with exponential backoff
    for (let attempt = 1; attempt <= this.options.retryAttempts!; attempt++) {
      try {
        await this.attemptConnection();
        this.isConnected = true;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.options.retryAttempts!) {
          const delay = this.options.retryDelay! * Math.pow(2, attempt - 1);
          console.warn(`⚠ MCP connection attempt ${attempt} failed for ${this.config.name}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await this.cleanup();
      }
    }

    const message = lastError?.message || 'Unknown error';
    throw new MCPServerError(`Failed to connect to MCP server after ${this.options.retryAttempts} attempts: ${message}`, {
      serverName: this.config.name,
      error: message
    });
  }

  private async attemptConnection(): Promise<void> {
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

    // Connect with timeout and better error handling
    await Promise.race([
      this.connectWithValidation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.options.timeout)
      )
    ]);
  }

  private async connectWithValidation(): Promise<void> {
    if (!this.client || !this.transport) {
      throw new Error('Client or transport not initialized');
    }

    // Connect to the server
    await this.client.connect(this.transport);

    // Validate connection by attempting to list tools
    // This helps catch the StdioTransport tool handler issue
    try {
      await this.client.listTools();
    } catch (error) {
      // If listTools fails, the connection might be problematic
      // but we'll still mark it as connected and let individual operations handle errors
      console.warn(`⚠ Warning: MCP server ${this.config.name} connected but listTools failed:`, error instanceof Error ? error.message : 'Unknown error');
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
      // Add timeout to tool calls to handle the StdioTransport issue
      const result = await Promise.race([
        this.client.callTool({
          name,
          arguments: arguments_
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tool call timeout')), 5000)
        )
      ]);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // If it's a timeout or connection issue, mark as disconnected
      if (message.includes('timeout') || message.includes('Connection') || message.includes('ECONNRESET')) {
        this.isConnected = false;
      }

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
      const result = await Promise.race([
        this.client.listTools(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('List tools timeout')), 5000)
        )
      ]);

      return result.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // If it's a timeout or connection issue, mark as disconnected
      if (message.includes('timeout') || message.includes('Connection') || message.includes('ECONNRESET')) {
        this.isConnected = false;
      }

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
