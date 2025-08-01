import { generateText, LanguageModelV1, ToolSet } from 'ai';
import { BusinessRule, LLMAnalysisError, LLMConfig, LLMConfigSchema } from '../types';
import { createOpenAICompatible, OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { LangfuseExporter } from 'langfuse-vercel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export class LLMProcessor {
  private provider: OpenAICompatibleProvider;
  private model: LanguageModelV1;
  private config: LLMConfig;
  private exporter: LangfuseExporter;
  private sdk: NodeSDK;

  constructor(llmConfig: LLMConfig) {
    // Initialize Langfuse exporter with debug enabled for troubleshooting
    // Use environment variables if available, otherwise fall back to hardcoded values
    this.exporter = new LangfuseExporter({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASEURL,
      flushAt: 1,
      flushInterval: 1000,
      // debug: true // Enable debug logging to troubleshoot issues
    });

    // Initialize OpenTelemetry SDK
    this.sdk = new NodeSDK({
      traceExporter: this.exporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    // Start the SDK
    this.sdk.start();
    console.log('OpenTelemetry SDK started with Langfuse exporter');
    // Validate configuration
    try {
      this.config = LLMConfigSchema.parse(llmConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid LLM configuration';
      throw new LLMAnalysisError(`LLM Configuration Error: ${message}`, { config: llmConfig });
    }

    // Validate base URL format
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new LLMAnalysisError(
        'Invalid base URL format. Please provide a valid URL (e.g., https://api.openai.com/v1)',
        {
          baseUrl: this.config.baseUrl,
        }
      );
    }

    this.provider = createOpenAICompatible({
      name: 'Khodkar-cli',
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
    this.model = this.provider(this.config.model);
  }

  async analyze(toolSet: ToolSet): Promise<void> {
    try {
      // Phase 1: Repository Discovery - Identify files containing business logic
      const repositoryDiscoveryResult = await generateText({
        model: this.model,
        system: this.getRepositoryDiscoveryPrompt(),
        prompt: 'start',
        toolChoice: 'auto',
        tools: toolSet,
        maxSteps: this.config.maxSteps,
        stopSequences: ['[REPOSITORY_DISCOVERY_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-repository-discovery',
        },
      });

      console.log('Phase 1 (Repository Discovery) completed');
      console.log(repositoryDiscoveryResult.text);

      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      // Phase 2: Rule Extraction - Extract business rules from identified files
      const ruleExtractionResult = await generateText({
        model: this.model,
        system: this.getRuleExtractionPrompt(),
        prompt: `Based on the repository discovery results:
${repositoryDiscoveryResult.text}

Now proceed to extract business rules from the identified files.`,
        toolChoice: 'auto',
        tools: toolSet,
        maxSteps: this.config.maxSteps,
        stopSequences: ['[RULE_EXTRACTION_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-rule-extraction',
        },
      });

      console.log('Phase 2 (Rule Extraction) completed');
      console.log(ruleExtractionResult.text);

      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      // Phase 3: Documentation Synthesis - Combine extracted rules into coherent documentation
      const documentationSynthesisResult = await generateText({
        model: this.model,
        system: this.getDocumentationSynthesisPrompt(),
        prompt: `Based on the rule extraction results:
${ruleExtractionResult.text}

Now synthesize all extracted rules into a coherent customer support guide.`,
        maxSteps: this.config.maxSteps,
        stopSequences: ['[DOCUMENTATION_SYNTHESIS_COMPLETE]'],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-documentation-synthesis',
        },
      });

      console.log('Phase 3 (Documentation Synthesis) completed');

      console.log(documentationSynthesisResult.text);

      // Force flush the traces to Langfuse
      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }
    } catch (error) {
      if (error instanceof LLMAnalysisError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error during LLM analysis';
      throw new LLMAnalysisError(`LLM analysis failed: ${message}`, {
        originalError: error,
        config: this.config,
      });
    }
  }

  /**
   * Cleanup method to properly shutdown the OpenTelemetry SDK and flush remaining traces
   */
  async cleanup(): Promise<void> {
    try {
      console.log('Shutting down OpenTelemetry SDK...');

      // Force flush any remaining traces
      await this.exporter.forceFlush();

      // Shutdown the SDK
      await this.sdk.shutdown();

      console.log('OpenTelemetry SDK shutdown complete');
    } catch (error) {
      console.warn('Error during OpenTelemetry SDK shutdown:', error);
    }
  }

  /**
   * Phase 1: Repository Discovery
   * Identifies files in the repository that likely contain business logic rules
   */
  getRepositoryDiscoveryPrompt() {
    return `
You are an expert code analyst specializing in business rule discovery.

Your task is to identify all source code files in the repository that likely contain business logic rules such as:
- Validation rules and constraints
- Enum definitions and constants
- API rate limits and quotas
- Authorization and permission rules
- Business workflow constraints
- Data validation schemas
- Configuration limits

Use the get_directory_tree tool to explore the repository structure, then use minimal read_file calls only to confirm file relevance.
Do NOT analyze the actual code content yet - that will happen in the next phase.

When complete, output a numbered list of file paths that contain business logic rules and end with "[REPOSITORY_DISCOVERY_COMPLETE]"`;
  }

  /**
   * Phase 2: Rule Extraction
   * Extracts business rules from the files identified in Phase 1
   */
  getRuleExtractionPrompt() {
    return `
You are an expert business rule analyst.

Based on the files identified in the repository discovery phase, your task is to:

1. Read the full contents of each identified file using read_file
2. Extract all business rule statements from the code
3. Format each rule in Markdown with:
   - A clear heading (e.g., "Payment Processing Limits", "User Account Validation")
   - A brief description explaining what the rule does and why it matters for customer support
   - A practical example when relevant (e.g., "If payment exceeds €10,000, the system requires additional verification")

Guidelines:
- Write in active voice using simple, non-technical language
- Focus on user-facing behavior and customer impact
- Avoid implementation details, code snippets, or internal technical jargon
- Organize rules by functional area when possible

Process each file systematically and conclude with "[RULE_EXTRACTION_COMPLETE]"`;
  }

  /**
   * Phase 3: Documentation Synthesis
   * Combines all extracted rules into a coherent customer support guide
   */
  getDocumentationSynthesisPrompt() {
    return `
You are a technical documentation specialist creating customer support materials.

Your task is to synthesize all the business rules extracted from the previous phase into one comprehensive, well-organized customer support guide.

Requirements:
- Organize rules into logical categories (User Management, Authentication, Business Logic, Security Rules, Workflow Rules)
- Ensure each rule has a clear heading, description, and example where applicable
- Write for customer support agents who need to quickly understand system behavior
- Use active voice and simple language throughout
- Remove any duplicate or overlapping rules
- Create a logical flow that makes sense for support scenarios

The final output should be a complete Markdown document that serves as a practical reference guide for customer support teams.

Conclude with "[DOCUMENTATION_SYNTHESIS_COMPLETE]"`;
  }
}
