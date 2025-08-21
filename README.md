# Rokovo CLI

<p align="center">
  <img src="assets/logo.png" alt="Rokovo CLI Logo" width="300">
</p>

The Rokovo CLI brings a simple AI agent on your command line to help you with documenting pure source codes for both developers and end users.

## Quick Start

You can install the CLI using PIP:

```sh
pip install rokovo
```

### Usage

#### Config files and initializing

Each time you call the Rokoco CLI, you need to provide some basic information context file path and model configs using proper flags defined in `rokovo --help`. Other way is to define a `rokovo.toml` for configs, `rokovo_context.md` for agent context and a `.rokovoignore` for ignored files (default fallback is `.gitignore`). You can use `init` command to get the basic template:

```sh
rokovo init --root-dir .
```

#### Context file

Context file is a markdown file that contains a high level description of your project. This will help the AI agent to understand the project better and generate more accurate documentation. A basic model of writing a context file is as follows:

1. Project name and a brief description.
2. Project structure and important files.
3. Important keywords and terminologies.
4. Usage specific context, for example if you want to to auto extract FAQs: set of questions as example to help agent with finding questions and answers.

An example context file can be found on [examples_context.md](./src/config/rokovo_context.md).

#### FAQ extraction

To extract FAQs from your codebase, run the following command:

```sh
rokovo --context-dir ./context.md --root-dir ./path/to/project --api-key <your-openrouter-api-key> --re-index true # if you have changed your code base use --re-index
```

>[!NOTE]
> If you already have a `rokovo.toml` in `--root-dir`, you don't need to provide those flags. For API key you can use `ROKOVO_API_KEY` environment variable. 


#### Interactive mode

You can use:

```sh
rokovo interactive <flags (if config file is not exist)>
```

To run a REPL that let you to chat with the agent and get answers over your codebase in simple user language.

## LLM

We use the OpenRouter API as default and you can use `--api-key` flag to pass your API key. If you are using another provider feel free to pass ``--base-url` and `--model` flags to configure your provider.

Any provider compatible with OpenAI API is accepted and you can use local models too.

## License

MIT License - see [LICENSE](./LICENSE).
