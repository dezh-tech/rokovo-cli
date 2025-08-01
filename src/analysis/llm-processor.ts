import { generateText, LanguageModelV1, ToolSet } from 'ai';
import { z } from 'zod';
import {
  llmObjectGeneratedSchema,
  BusinessRule,
  LLMAnalysisError,
  LLMConfig,
  LLMConfigSchema,
} from '../types';
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

  async analyze(toolSet: ToolSet): Promise<BusinessRule[]> {
    try {
      console.log('Starting LLM analysis with telemetry enabled...');

      const response = await generateText({
        model: this.model,
        system: this.getPrompt(),
        prompt: 'Extract business rules from the codebase',
        toolChoice: 'required',
        tools: toolSet,
        maxSteps: this.config.maxSteps,
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'khodkar-business-rules-analysis',
          metadata: {
            version: '1.0.4',
            analysisType: 'business-rules-extraction',
            maxSteps: this.config.maxSteps,
          },
        },
      });

      console.log('LLM analysis completed, flushing traces to Langfuse...');

      // Force flush the traces to Langfuse
      try {
        await this.exporter.forceFlush();
        console.log('Successfully flushed traces to Langfuse');
      } catch (flushError) {
        console.warn('Failed to flush traces to Langfuse:', flushError);
      }

      const text = response.text;
      console.log(`LLM Analysis completed with ${response.steps?.length || 0} steps`);
      console.log('Final response:', JSON.stringify(response.text));

      // Extract JSON from text using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new LLMAnalysisError('Failed to extract JSON from LLM response', {
          responseText: text,
          stepsUsed: response.steps?.length || 0,
        });
      }

      const extractedData = JSON.parse(jsonMatch[0]);
      const result = llmObjectGeneratedSchema.parse(extractedData);

      console.log(`Successfully extracted ${result.rules.length} business rules`);
      return result.rules;
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

  getPrompt() {
    return `
You are an expert analyst. Your task is to read a codebase and produce a Markdown support guide that explains its business rules in simple, user‑facing language.

Steps:

1. Use get_directory_tree to explore the repository.  
2. For each relevant source code file found:  
   a. Use read_file to examine its contents.  
   b. Identify validation logic, enum values, settings, API constraints, calculations, rate limits, authorization logic, etc.  
3. For each rule found, write a Markdown section containing:
   - A short heading (e.g. “User password requirements”, “Payment limits”).
   - A clear description: *what* the rule is and *why* it matters from the user or customer support perspective.
   - Example if relevant (e.g. "If payment > €10,000, system rejects it").
   - Do not describe code internals — focus on user‑facing consequences.

- Write in active voice and use simple sentences.
- Write for a support agent who has never seen the code.
- Never skip using the tools—they ensure accuracy.
- Do not expose internal package names or low-level implementation details.
- Do not inspect system or metadata files (e.g. node_modules/, package.json, Dockerfiles)—only source files.

Examples:

**Bad:** “The validateEmail() method checks regex '^[^@]+@…'”  
**Good:** “User emails must match proper format (like user@example.com) before account creation is allowed.”

**Bad:** “user.role==='admin' gives access”  
**Good:** “Only administrators can access advanced features.”

**Bad:** “Payment.amount > maxLimit throws ValidationError”  
**Good:** “Payments cannot exceed the maximum allowed for the user's account level.”
`;
  }
}
