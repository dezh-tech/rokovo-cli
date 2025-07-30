# Khodkar CLI - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Configuration](#configuration)
6. [Supported Languages](#supported-languages)
7. [Output Formats](#output-formats)
8. [Advanced Usage](#advanced-usage)
11. [Examples](#examples)

## Overview

Khodkar CLI is a powerful TypeScript-based command-line tool designed to extract business rules and logic from codebases. It uses advanced Large Language Model (LLM) technology to analyze source code and generate comprehensive documentation that helps customer support teams understand the business rules embedded in applications.

### Key Features

- **Multi-language Support**: Analyzes code in TypeScript, JavaScript, Python, Java, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, and Clojure
- **LLM-Powered Analysis**: Uses configurable LLM providers (OpenAI, Anthropic, etc.) for intelligent code analysis
- **Flexible Output**: Generates documentation in Markdown or JSON formats
- **Business Rule Categorization**: Automatically categorizes rules into 5 main categories
- **Progress Tracking**: Real-time progress updates with ETA estimation
- **MCP Integration**: Uses Model Context Protocol for enhanced analysis capabilities
- **Batch Processing**: Efficiently processes multiple files in parallel

### Business Rule Categories

The tool categorizes extracted business rules into five main categories:

1. **User Management** - Rules related to user accounts, profiles, and permissions
2. **Authentication** - Login, logout, password policies, and access control
3. **Business Logic** - Core application workflows and decision-making processes
4. **Security Rules** - Data protection, validation, and security measures
5. **Workflow Rules** - Process flows, state transitions, and automation rules

## Installation

### Global Installation (Recommended)

```bash
npm install -g khodkar-cli
```

### Local Installation

```bash
npm install khodkar-cli
npx khodkar --help
```

### From Source

```bash
git clone https://github.com/dezh-tech/khodkar-cli.git
cd khodkar-cli
npm install
npm run build
npm link
```

### System Requirements

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Internet connection for LLM API access

## Quick Start

### Basic Analysis

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./business-rules.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-openai-api-key \
  --llm-model gpt-4
```

### With Anthropic Claude

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./business-rules.md \
  --llm-base-url https://api.anthropic.com \
  --llm-api-key your-anthropic-api-key \
  --llm-model claude-3-sonnet-20240229
```

### JSON Output

```bash
khodkar analyze \
  --directory ./my-project \
  --output ./business-rules.json \
  --format json \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key your-api-key \
  --llm-model gpt-4
```

## Commands Reference

### `analyze`

Analyzes a codebase and extracts business rules.

#### Required Options

- `-d, --directory <path>` - Target codebase directory to analyze
- `-o, --output <path>` - Output file path for extracted business rules
- `--llm-base-url <url>` - LLM API base URL
- `--llm-api-key <key>` - LLM API key for authentication
- `--llm-model <model>` - LLM model name

#### Optional Options

- `-f, --format <format>` - Output format: `json` or `markdown` (default: `markdown`)
- `-v, --verbose` - Enable detailed progress logging (default: `false`)

#### Examples

```bash
# Basic analysis with verbose output
khodkar analyze -d ./src -o ./docs/rules.md --verbose \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key sk-... \
  --llm-model gpt-4

# JSON output for API integration
khodkar analyze -d ./backend -o ./api/rules.json -f json \
  --llm-base-url https://api.anthropic.com \
  --llm-api-key sk-ant-... \
  --llm-model claude-3-sonnet-20240229
```

### `validate`

Validates the environment and dependencies.

```bash
khodkar validate
```

This command checks:
- MCP server connectivity
- Environment configuration
- System dependencies

## Configuration

### LLM Providers

#### OpenAI

```bash
--llm-base-url https://api.openai.com/v1
--llm-model gpt-4  # or gpt-3.5-turbo, gpt-4-turbo
```

#### Anthropic Claude

```bash
--llm-base-url https://api.anthropic.com
--llm-model claude-3-sonnet-20240229  # or claude-3-opus-20240229, claude-3-haiku-20240307
```

#### Azure OpenAI

```bash
--llm-base-url https://your-resource.openai.azure.com/openai/deployments/your-deployment
--llm-model gpt-4
```

#### Custom/Local LLM

```bash
--llm-base-url http://localhost:8080/v1
--llm-model your-local-model
```

### Environment Variables

You can set default values using environment variables:

```bash
export KHODKAR_LLM_BASE_URL="https://api.openai.com/v1"
export KHODKAR_LLM_API_KEY="your-api-key"
export KHODKAR_LLM_MODEL="gpt-4"
```

### File Size Limits

- Maximum file size: 1MB per file
- Files larger than 1MB are automatically skipped
- Binary files are ignored

### Ignored Patterns

The following patterns are automatically ignored:

- `node_modules/**`
- `.git/**`
- `dist/**`
- `build/**`
- `coverage/**`
- `*.min.js`
- `*.map`
- `.env*`
- `*.log`

## Supported Languages

| Language   | Extensions        | Analysis Quality |
|------------|-------------------|------------------|
| TypeScript | `.ts`, `.tsx`     | Excellent        |
| JavaScript | `.js`, `.jsx`     | Excellent        |
| Python     | `.py`             | Excellent        |
| Java       | `.java`           | Very Good        |
| C#         | `.cs`             | Very Good        |
| Go         | `.go`             | Very Good        |
| Rust       | `.rs`             | Good             |
| Ruby       | `.rb`             | Good             |
| PHP        | `.php`            | Good             |
| Swift      | `.swift`          | Good             |
| Kotlin     | `.kt`             | Good             |
| Scala      | `.scala`          | Good             |
| Clojure    | `.clj`            | Good             |
| C++        | `.cpp`, `.c`      | Fair             |

## Output Formats

### Markdown Format

The default Markdown format provides a human-readable document with:

- Executive summary
- Business rules organized by category
- Source code references
- Priority indicators
- User-facing rule highlights

#### Sample Markdown Output

```markdown
# Business Rules Analysis

**Application:** MyApp
**Analysis Date:** 2024-01-15T10:30:00Z
**Files Analyzed:** 45

## Summary

- **Total Rules:** 23
- **High Priority:** 8
- **User-Facing:** 15
- **Categories:** User Management, Authentication, Business Logic

## User Management

### User Registration Validation
**Priority:** High | **User-Facing:** Yes

Users must provide a valid email address and password with at least 8 characters...

*Source: `src/auth/registration.ts:15-25`*

---
```

### JSON Format

The JSON format provides structured data for programmatic access:

```json
{
  "applicationName": "MyApp",
  "analysisDate": "2024-01-15T10:30:00Z",
  "totalFilesAnalyzed": 45,
  "businessRules": [
    {
      "id": "rule-001",
      "title": "User Registration Validation",
      "description": "Users must provide a valid email address...",
      "category": "User Management",
      "priority": "high",
      "source": {
        "file": "src/auth/registration.ts",
        "startLine": 15,
        "endLine": 25
      },
      "tags": ["validation", "email", "password"],
      "userFacing": true
    }
  ],
  "categories": ["User Management", "Authentication"],
  "summary": {
    "totalRules": 23,
    "highPriorityRules": 8,
    "userFacingRules": 15
  }
}
```

## Advanced Usage

### Batch Processing Multiple Projects

```bash
#!/bin/bash
# analyze-projects.sh

projects=("./frontend" "./backend" "./mobile-app")
for project in "${projects[@]}"; do
  echo "Analyzing $project..."
  khodkar analyze \
    -d "$project" \
    -o "./docs/$(basename $project)-rules.md" \
    --llm-base-url https://api.openai.com/v1 \
    --llm-api-key $OPENAI_API_KEY \
    --llm-model gpt-4 \
    --verbose
done
```

### Log Analysis

Check the console output for:
- File scanning progress
- LLM API request/response details
- MCP server status
- Error stack traces

### Performance Optimization

#### 1. Model Selection

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| gpt-3.5-turbo | Fast | Good | Low |
| gpt-4 | Slow | Excellent | High |
| claude-3-haiku | Fast | Good | Low |
| claude-3-sonnet | Medium | Very Good | Medium |

#### 2. File Filtering

Exclude unnecessary files to improve performance:

```bash
# Create .khodkarignore file
echo "*.test.ts" >> .khodkarignore
echo "*.spec.js" >> .khodkarignore
echo "migrations/" >> .khodkarignore
```

#### 3. Parallel Processing

The tool automatically processes files in parallel, but you can optimize by:
- Using SSD storage for faster file I/O
- Ensuring stable internet connection
- Running on systems with adequate RAM

## Examples

### Example 1: E-commerce Application

**Input Structure:**
```
ecommerce-app/
├── src/
│   ├── auth/
│   │   ├── login.ts
│   │   └── registration.ts
│   ├── cart/
│   │   ├── cart-service.ts
│   │   └── checkout.ts
│   ├── products/
│   │   ├── product-catalog.ts
│   │   └── inventory.ts
│   └── payments/
│       ├── payment-processor.ts
│       └── refunds.ts
```

**Command:**
```bash
khodkar analyze \
  --directory ./ecommerce-app/src \
  --output ./docs/ecommerce-business-rules.md \
  --llm-base-url https://api.openai.com/v1 \
  --llm-api-key $OPENAI_API_KEY \
  --llm-model gpt-4 \
  --verbose
```

**Sample Output (Markdown):**
```markdown
# Business Rules Analysis - E-commerce App

## Summary
- **Total Rules:** 34
- **High Priority:** 12
- **User-Facing:** 28

## Authentication

### Password Requirements
**Priority:** High | **User-Facing:** Yes

Passwords must contain at least 8 characters, including one uppercase letter, one lowercase letter, one number, and one special character.

*Source: `auth/registration.ts:45-52`*

### Account Lockout Policy
**Priority:** High | **User-Facing:** Yes

User accounts are locked after 5 consecutive failed login attempts for 30 minutes.

*Source: `auth/login.ts:78-85`*

## Business Logic

### Cart Expiration
**Priority:** Medium | **User-Facing:** Yes

Shopping cart items expire after 24 hours of inactivity and are automatically removed.

*Source: `cart/cart-service.ts:156-163`*

### Inventory Validation
**Priority:** High | **User-Facing:** Yes

Orders cannot be placed if requested quantity exceeds available inventory.

*Source: `products/inventory.ts:89-96`*
```

### Example 2: Banking Application

**Command:**
```bash
khodkar analyze \
  --directory ./banking-app \
  --output ./compliance/banking-rules.json \
  --format json \
  --llm-base-url https://api.anthropic.com \
  --llm-api-key $ANTHROPIC_API_KEY \
  --llm-model claude-3-sonnet-20240229
```

**Sample JSON Output:**
```json
{
  "applicationName": "Banking App",
  "analysisDate": "2024-01-15T14:30:00Z",
  "totalFilesAnalyzed": 67,
  "businessRules": [
    {
      "id": "rule-001",
      "title": "Daily Transfer Limit",
      "description": "Individual users cannot transfer more than $10,000 per day without additional verification",
      "category": "Security Rules",
      "priority": "high",
      "source": {
        "file": "transfers/transfer-service.ts",
        "startLine": 123,
        "endLine": 135
      },
      "tags": ["transfer", "limit", "security", "verification"],
      "userFacing": true
    },
    {
      "id": "rule-002",
      "title": "Account Freeze Conditions",
      "description": "Accounts are automatically frozen when suspicious activity is detected",
      "category": "Security Rules",
      "priority": "high",
      "source": {
        "file": "security/fraud-detection.ts",
        "startLine": 67,
        "endLine": 78
      },
      "tags": ["security", "fraud", "account-freeze"],
      "userFacing": true
    }
  ],
  "categories": ["Security Rules", "User Management", "Business Logic"],
  "summary": {
    "totalRules": 45,
    "highPriorityRules": 23,
    "userFacingRules": 38
  }
}
```

## Support

- **Documentation**: [GitHub Repository](https://github.com/dezh-tech/khodkar-cli)
- **Issues**: [GitHub Issues](https://github.com/dezh-tech/khodkar-cli/issues)
- **Website**: [khodkar.dezh.tech](https://khodkar.dezh.tech)
- **Email**: support@dezh.tech

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

*Last updated: January 2024*
```