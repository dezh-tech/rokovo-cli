# Khodkar CLI

Khodkar CLI is a powerful tool developed by [khodkar.dezh.tech](https://khodkar.dezh.tech) that helps teams extract business flow and logic documentation from their codebase. It's specifically designed to create comprehensive knowledge base documentation that helps support teams understand the business rules embedded in the code.

## Quick Start

```bash
npm install -g khodkar-cli
khodkar analyze --directory ./my-project --output ./docs.md
```

## Key Features

- Extracts business rules from code
- Supports multiple programming languages
- Generates documentation in Markdown or JSON
- Uses advanced LLM technology for analysis
- Real-time progress tracking

## Basic Usage

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./business-rules.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-api-key-here \
  --llm-model gpt-4
```

For detailed documentation including advanced usage, configuration options, and troubleshooting, please refer to our [detailed documentation](./DOCUMENTATION.md).

## License

MIT License - see LICENSE file for details.

## Support

Visit [khodkar.dezh.tech](https://khodkar.dezh.tech) for support or create an issue on GitHub.
