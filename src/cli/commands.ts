import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  CLIOptions,
  CLIOptionsSchema,
  LLMAnalysisError,
  MCPServerError,
  LLMConfig,
  LLMConfigSchema,
  AnalysisResult,
} from '../types';
import { OutputFormatter } from '../utils/output-formatter';
import { LLMProcessor } from '../analysis/llm-processor';
import { ProgressTracker } from '../utils/progress-tracker';
import { version } from '../../package.json';
import { McpManager } from '../mcp/manager';

export class KhodkarCLI {
  private program: Command;
  private mcpManager: McpManager;

  constructor() {
    this.program = new Command();
    this.mcpManager = new McpManager();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('khodkar')
      .description(
        'Extract business rules and logic from codebases for customer support knowledge bases'
      )
      .version(version);

    this.program
      .command('analyze')
      .description('Analyze a codebase and extract business rules')
      .requiredOption('-d, --directory <path>', 'Target codebase directory to analyze')
      .requiredOption('-o, --output <path>', 'Output file path for extracted business rules')
      .requiredOption(
        '--llm-base-url <url>',
        'LLM API base URL (e.g., https://api.openai.com/v1, https://api.anthropic.com)'
      )
      .requiredOption('--llm-api-key <key>', 'LLM API key for authentication')
      .requiredOption(
        '--llm-model <model>',
        'LLM model name (e.g., gpt-4, claude-3-sonnet-20240229)'
      )
      .option('-f, --format <format>', 'Output format (json|markdown)', 'markdown')
      .option('-v, --verbose', 'Enable detailed progress logging', false)
      .option('--llm-max-tokens <number>', 'Maximum tokens for LLM response (1000-32000)', parseInt)
      .option('--llm-max-steps <number>', 'Maximum analysis steps for LLM (10-500)', parseInt)
      .action(async options => {
        await this.handleAnalyzeCommand(options);
      });
  }

  async run(argv: string[]): Promise<void> {
    // try {
      await this.program.parseAsync(argv);
    // } catch (error) {
    //   const message = error instanceof Error ? error.message : 'Unknown error';
    //   console.error(chalk.red(`Error: ${message}`));
    //   process.exit(1);
    // }
  }

  private async handleAnalyzeCommand(rawOptions: unknown): Promise<void> {
    // Validate and parse options
    const options = this.validateOptions(rawOptions);

    // // Create and validate LLM configuration from CLI options
    const llmConfig: LLMConfig = {
      baseUrl: options.llmBaseUrl,
      apiKey: options.llmApiKey,
      model: options.llmModel,
      maxSteps: options.llmMaxSteps || 50,
    };

    // Validate LLM configuration
    try {
      LLMConfigSchema.parse(llmConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid LLM configuration';
      throw new Error(`LLM Configuration Error: ${message}`);
    }

    // Initialize LLM processor with user configuration
    const llmProcessor = new LLMProcessor(llmConfig);

    const progressTracker = new ProgressTracker({
      verbose: options.verbose,
      showETA: true,
    });

    // try {
      progressTracker.start('Initializing analysis...');

      if (options.verbose) {
        console.log(chalk.blue('🔍 Starting business rules analysis...'));
        console.log(chalk.gray(`Directory: ${options.directory}`));
        console.log(chalk.gray(`Output: ${options.output}`));
        console.log(chalk.gray(`Format: ${options.format}`));
      }

      // Initialize MCP servers
      progressTracker.updatePhase('scanning', 'Initializing MCP servers...');
      await this.mcpManager.initializeServers();

      // Analyze files with LLM
      progressTracker.updatePhase('analyzing', 'Analyzing codebase with LLM...');

      const tools = await this.mcpManager.getTools();
      const businessRules = await llmProcessor.analyze(tools);


      progressTracker.succeed('Analysis complete!');
      console.log(chalk.green('✅ Analysis complete!'));
      console.log(chalk.blue(`📄 Output saved to: ${options.output}`));

      // Cleanup resources
      await llmProcessor.cleanup();
      await this.mcpManager.shutdownServers();
    // } catch (error) {
    //   progressTracker.fail('Analysis failed');
    //   await this.handleError(error);
    //   // Cleanup resources even on error
    //   await llmProcessor.cleanup();
    //   await this.mcpManager.shutdownServers();
    // }
  }

  private validateOptions(rawOptions: unknown): CLIOptions {
    try {
      return CLIOptionsSchema.parse(rawOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Invalid options: ${message}`);
    }
  }

  private async handleError(error: unknown): Promise<void> {
    if (error instanceof LLMAnalysisError) {
      console.error(chalk.red(`LLM analysis error: ${error.message}`));
      if (error.details?.filePath) {
        console.error(chalk.gray(`File: ${error.details.filePath}`));
      }
    } else if (error instanceof MCPServerError) {
      console.error(chalk.red(`MCP server error: ${error.message}`));
      if (error.details?.serverName) {
        console.error(chalk.gray(`Server: ${error.details.serverName}`));
      }
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Unexpected error: ${message}`));
    }

    process.exit(1);
  }
}
