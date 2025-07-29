import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { 
  CLIOptions, 
  CLIOptionsSchema, 
  AnalysisResult,
  LLMAnalysisRequest,
  FileSystemError,
  LLMAnalysisError,
  MCPServerError 
} from '@/types';
import { FileScanner } from '@/utils/file-scanner.js';
import { OutputFormatter } from '@/utils/output-formatter.js';
import { LLMProcessor } from '@/analysis/llm-processor.js';
import { MCPManager } from '@/mcp/manager.js';
import { ProgressTracker } from '@/utils/progress-tracker.js';

export class KhodkarCLI {
  private program: Command;
  private mcpManager: MCPManager;
  private llmProcessor: LLMProcessor;

  constructor() {
    this.program = new Command();
    this.mcpManager = new MCPManager();
    this.llmProcessor = new LLMProcessor();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('khodkar')
      .description('Extract business rules and logic from codebases for customer support knowledge bases')
      .version('1.0.0');

    this.program
      .command('analyze')
      .description('Analyze a codebase and extract business rules')
      .requiredOption('-d, --directory <path>', 'Target codebase directory to analyze')
      .requiredOption('-o, --output <path>', 'Output file path for extracted business rules')
      .option('-f, --format <format>', 'Output format (json|markdown)', 'markdown')
      .option('-v, --verbose', 'Enable detailed progress logging', false)
      .action(async (options) => {
        await this.handleAnalyzeCommand(options);
      });

    this.program
      .command('validate')
      .description('Validate environment and dependencies')
      .action(async () => {
        await this.handleValidateCommand();
      });
  }

  async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  }

  private async handleAnalyzeCommand(rawOptions: unknown): Promise<void> {
    // Validate and parse options
    const options = this.validateOptions(rawOptions);

    const progressTracker = new ProgressTracker({
      verbose: options.verbose,
      showETA: true
    });

    try {
      progressTracker.start('Initializing analysis...');

      if (options.verbose) {
        console.log(chalk.blue('🔍 Starting business rules analysis...'));
        console.log(chalk.gray(`Directory: ${options.directory}`));
        console.log(chalk.gray(`Output: ${options.output}`));
        console.log(chalk.gray(`Format: ${options.format}`));
      }

      // Initialize MCP servers
      progressTracker.updatePhase('scanning', 'Initializing MCP servers...');
      await this.mcpManager.initialize();

      // Validate directory
      progressTracker.updatePhase('scanning', 'Validating directory...');
      await FileScanner.validateDirectory(options.directory);

      // Scan files
      progressTracker.updatePhase('scanning', 'Scanning files...');
      const scanner = new FileScanner({
        directory: options.directory,
        maxFileSize: 1024 * 1024, // 1MB limit
      });

      const scanResult = await scanner.scan();

      if (options.verbose) {
        console.log(chalk.green(`✓ Found ${scanResult.totalFiles} files to analyze`));
        console.log(chalk.gray(`Total size: ${FileScanner.formatFileSize(scanResult.totalSize)}`));
        if (scanResult.skippedFiles.length > 0) {
          console.log(chalk.yellow(`⚠ Skipped ${scanResult.skippedFiles.length} files`));
        }
      }

      // Analyze files with LLM
      progressTracker.updatePhase('analyzing', 'Analyzing files with LLM...');
      const analysisRequests: LLMAnalysisRequest[] = [];

      for (const fileAnalysis of scanResult.files) {
        try {
          const content = await FileScanner.readFileContent(
            path.join(options.directory, fileAnalysis.filePath)
          );

          analysisRequests.push({
            filePath: fileAnalysis.filePath,
            fileContent: content,
            language: fileAnalysis.language,
            context: {
              projectName: FileScanner.getProjectName(options.directory),
              fileType: fileAnalysis.fileType,
              relatedFiles: []
            }
          });
        } catch (error) {
          if (options.verbose) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.warn(chalk.yellow(`⚠ Failed to read ${fileAnalysis.filePath}: ${message}`));
          }
        }
      }

      const businessRules = await this.llmProcessor.batchAnalyze(analysisRequests);

      if (options.verbose) {
        console.log(chalk.green(`✓ Extracted ${businessRules.length} business rules`));
      }

      // Create analysis result
      const analysisResult: AnalysisResult = {
        applicationName: FileScanner.getProjectName(options.directory),
        analysisDate: new Date().toISOString(),
        totalFilesAnalyzed: scanResult.totalFiles,
        businessRules,
        categories: [...new Set(businessRules.map(rule => rule.category))],
        summary: {
          totalRules: businessRules.length,
          highPriorityRules: businessRules.filter(rule => rule.priority === 'high').length,
          userFacingRules: businessRules.filter(rule => rule.userFacing).length,
        }
      };

      // Format and save output
      progressTracker.updatePhase('formatting', 'Formatting output...');
      const formatter = new OutputFormatter({
        includeMetadata: true,
        includeSourceReferences: true,
        groupByCategory: true,
        sortByPriority: true
      });

      await formatter.formatAndSave(analysisResult, options.output, options.format);

      progressTracker.succeed('Analysis complete!');
      console.log(chalk.green('✅ Analysis complete!'));
      console.log(chalk.blue(`📄 Output saved to: ${options.output}`));
      
      // Print summary
      console.log('\n' + chalk.bold('Summary:'));
      console.log(`  • Files analyzed: ${analysisResult.totalFilesAnalyzed}`);
      console.log(`  • Business rules extracted: ${analysisResult.summary.totalRules}`);
      console.log(`  • High priority rules: ${analysisResult.summary.highPriorityRules}`);
      console.log(`  • User-facing rules: ${analysisResult.summary.userFacingRules}`);
      console.log(`  • Categories: ${analysisResult.categories.join(', ')}`);

    } catch (error) {
      progressTracker.fail('Analysis failed');
      await this.handleError(error);
    } finally {
      await this.mcpManager.shutdown();
    }
  }

  private async handleValidateCommand(): Promise<void> {
    console.log(chalk.blue('🔍 Validating environment and dependencies...\n'));

    // Check API keys
    const hasApiKey = LLMProcessor.validateApiKey();
    console.log(`${hasApiKey ? '✅' : '❌'} LLM API Key: ${hasApiKey ? 'Found' : 'Missing'}`);
    
    if (!hasApiKey) {
      console.log(chalk.yellow('  Required: OPENAI_API_KEY or ANTHROPIC_API_KEY'));
    }

    // Test MCP servers
    console.log('\n' + chalk.bold('MCP Servers:'));
    try {
      await this.mcpManager.initialize();
      const status = this.mcpManager.getServerStatus();
      
      for (const [name, info] of Object.entries(status)) {
        console.log(`${info.connected ? '✅' : '❌'} ${name}: ${info.connected ? 'Connected' : 'Failed'}`);
      }
    } catch (error) {
      console.log(chalk.red('❌ Failed to initialize MCP servers'));
    } finally {
      await this.mcpManager.shutdown();
    }

    console.log('\n' + chalk.blue('Validation complete.'));
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
    if (error instanceof FileSystemError) {
      console.error(chalk.red(`File system error: ${error.message}`));
      if (error.details?.path) {
        console.error(chalk.gray(`Path: ${error.details.path}`));
      }
    } else if (error instanceof LLMAnalysisError) {
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
