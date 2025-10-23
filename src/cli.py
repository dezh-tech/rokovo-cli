import os
import sys
from pathlib import Path
from typing import Optional

import typer

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

import agent
import utils
from __init__ import __version__

app = typer.Typer(
    help="""
Rokovo CLI - A simple AI agent that help you to
 write and extract documentation for both users and devs.
    """,
    no_args_is_help=True,
)


def _version_callback(value: bool):
    if value:
        typer.echo(f"rokovo {__version__}")
        raise typer.Exit()


@app.callback(invoke_without_command=True)
def _root(
    version: Optional[bool] = typer.Option(
        None,
        "--version",
        "-V",
        help="Show Rokovo version and exit",
        callback=_version_callback,
        is_eager=True,
    ),
):
    # This function is intentionally empty: options are handled by callbacks
    pass


@app.command("version")
def version_command() -> None:
    """Show Rokovo version."""
    typer.echo(f"rokovo {__version__}")


@app.command("faq")
def faq(
    root_dir: str = typer.Option(
        ".", "--root-dir", "-r", help="Root directory of the codebase to scan"
    ),
    context_dir: str = typer.Option(
        None, "--context-dir", help="Directory of markdown context file"
    ),
    model: str = typer.Option("openai/gpt-4.1", "--model", help="LLM model identifier"),
    temperature: float = typer.Option(0.5, "--temperature", "-t", help="Sampling temperature"),
    base_url: str = typer.Option(
        "https://openrouter.ai/api/v1", "--base-url", help="Base URL for the LLM API"
    ),
    api_key: Optional[str] = typer.Option(
        None, "--api-key", help="API key for the LLM provider", envvar="ROKOVO_API_KEY"
    ),
    re_index: Optional[bool] = typer.Option(
        False,
        "--re-index",
        help="""
            Re-index the codebase even if a vector store already exists.
            Use when you changed your codebase since last index.
            """,
    ),
) -> None:
    """Extracts a list of end-user FAQs from your code base."""
    config_path = Path(root_dir) / "rokovo.toml"

    cfg = {}
    if config_path.exists():
        with open(config_path, "rb") as f:
            cfg = tomllib.load(f)

    # project_cfg = cfg.get("project", {}) if isinstance(cfg, dict) else {}
    llm_cfg = cfg.get("llm", {}) if isinstance(cfg, dict) else {}
    context_cfg = cfg.get("context", {}) if isinstance(cfg, dict) else {}

    model = model or llm_cfg.get("model", model)
    base_url = base_url or llm_cfg.get("base_url", base_url)
    temperature = (
        temperature if temperature is not None else llm_cfg.get("temperature", temperature)
    )

    api_key = api_key or os.environ["ROKOVO_API_KEY"]

    context_path_opt = context_dir or context_cfg.get("path")
    if not context_path_opt:
        raise Exception(
            "Please provide a context file via --context-dir or [context].path in rokovo.toml."
        )

    context_path = Path(context_path_opt)
    if not context_path.is_absolute():
        context_path = Path(root_dir) / context_path
    with open(context_path, encoding="utf-8") as file:
        context = file.read()

    agent.extract_faq(
        root_dir=root_dir,
        model=model,
        temperature=temperature,
        base_url=base_url,
        api_key=api_key,
        context=context,
        re_index=re_index,
    )


@app.command("interactive")
def interactive(
    root_dir: str = typer.Option(
        ".", "--root-dir", "-r", help="Root directory of the codebase to scan"
    ),
    context_dir: str = typer.Option(
        None, "--context-dir", help="Directory of markdown context file"
    ),
    model: str = typer.Option("openai/gpt-4.1", "--model", help="LLM model identifier"),
    temperature: float = typer.Option(0.5, "--temperature", "-t", help="Sampling temperature"),
    base_url: str = typer.Option(
        "https://openrouter.ai/api/v1", "--base-url", help="Base URL for the LLM API"
    ),
    api_key: Optional[str] = typer.Option(
        None, "--api-key", help="API key for the LLM provider", envvar="ROKOVO_API_KEY"
    ),
    re_index: Optional[bool] = typer.Option(
        False,
        "--re-index",
        help="""
            Re-index the codebase even if a vector store already exists.
            Use when you changed your codebase since last index.
            """,
    ),
) -> None:
    """Run a simple REPL that answers your questions about the codebase"""
    config_path = Path(root_dir) / "rokovo.toml"

    cfg = {}
    if config_path.exists():
        with open(config_path, "rb") as f:
            cfg = tomllib.load(f)

    llm_cfg = cfg.get("llm", {}) if isinstance(cfg, dict) else {}
    context_cfg = cfg.get("context", {}) if isinstance(cfg, dict) else {}

    model = model or llm_cfg.get("model", model)
    base_url = base_url or llm_cfg.get("base_url", base_url)
    temperature = (
        temperature if temperature is not None else llm_cfg.get("temperature", temperature)
    )

    api_key = api_key or os.environ["ROKOVO_API_KEY"]

    context_path_opt = context_dir or context_cfg.get("path")
    if not context_path_opt:
        raise Exception(
            "Please provide a context file via --context-dir or [context].path in rokovo.toml."
        )

    context_path = Path(context_path_opt)
    if not context_path.is_absolute():
        context_path = Path(root_dir) / context_path
    with open(context_path, encoding="utf-8") as file:
        context = file.read()

    print("Rokovo CLI interactive mode. Type 'exit' or 'quit' to leave.")
    while True:
        try:
            line = input(">>> ")
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break
        if line.strip().lower() in {"exit", "quit"}:
            print("Bye!")
            break
        print(
            agent.call_agent(
                root_dir, model, temperature, base_url, api_key, context, re_index, line
            )["output"]
        )


@app.command("init")
def init(
    root_dir: str = typer.Option(
        ".", "--root-dir", "-r", help="Root directory of the codebase to init the Rokovo"
    ),
) -> None:
    """Initialize Rokovo CLI files in your codebase."""
    project_name = utils.get_top_directory(root_dir)
    config_path = Path(__file__).parent / "config" / "rokovo.toml"
    ignore_path = Path(__file__).parent / "config" / ".rokovoignore"
    context_path = Path(__file__).parent / "config" / "rokovo_context.md"

    config_file = ""
    with open(config_path, encoding="utf-8") as file:
        config_file = file.read()

    config_file = config_file.replace("<your-project-name>", project_name)

    ignore_file = ""
    with open(ignore_path, encoding="utf-8") as file:
        ignore_file = file.read()

    context_file = ""
    with open(context_path, encoding="utf-8") as file:
        context_file = file.read()

    with open(Path(root_dir) / "rokovo.toml", "w", encoding="utf-8") as f:
        f.write(config_file)

    with open(Path(root_dir) / ".rokovoignore", "w", encoding="utf-8") as f:
        f.write(ignore_file)

    with open(Path(root_dir) / "rokovo_context.md", "w", encoding="utf-8") as f:
        f.write(context_file)


@app.command("improve-desc")
def improve_desc(
    root_dir: str = typer.Option(
        ".",
        "--root-dir",
        "-r",
        help="Root directory of the codebase (used to resolve relative paths)"
    ),
    desc_path: str = typer.Option(
        "desc.md",
        "--desc",
        help="Path to the description markdown file to improve"
    ),
    model: str = typer.Option(
        "openai/gpt-4.1",
        "--model",
        help="LLM model identifier"
    ),
    temperature: float = typer.Option(
        0.5,
        "--temperature",
        "-t",
        help="Sampling temperature"
    ),
    base_url: str = typer.Option(
        "https://openrouter.ai/api/v1",
        "--base-url",
        help="Base URL for the LLM API"
    ),
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key",
        help="API key for the LLM provider",
        envvar="ROKOVO_API_KEY"
    ),
    in_place: bool = typer.Option(
        False,
        "--in-place",
        help="Overwrite the original description file with the improved version"
    ),
    output: Optional[str] = typer.Option(
        None,
        "--output",
        "-o",
        help="Write improved content to this output file"
    ),
) -> None:
    """
    Read a project description markdown (desc.md),
    ask the agent to improve it as a structured context file,
    and print or save the improved markdown.

    The improved file will follow the context template used by Rokovo
    (project name, important files, keywords, example questions).
    """
    config_path = Path(root_dir) / "rokovo.toml"

    cfg = {}
    if config_path.exists():
        with open(config_path, "rb") as f:
            cfg = tomllib.load(f)

    llm_cfg = cfg.get("llm", {}) if isinstance(cfg, dict) else {}

    model = model or llm_cfg.get("model", model)
    base_url = base_url or llm_cfg.get("base_url", base_url)
    temperature = temperature if temperature is not None else llm_cfg.get(
        "temperature", temperature
    )

    api_key = api_key or os.environ.get("ROKOVO_API_KEY")

    # Resolve description file path
    desc_file = Path(desc_path)
    if not desc_file.is_absolute():
        desc_file = Path(root_dir) / desc_file

    if not desc_file.exists():
        raise Exception(f"Description file not found: {desc_file}")

    desc_content = desc_file.read_text(encoding="utf-8")

    # Construct a clear instruction for the agent to produce an improved context markdown
    user_query = (
        "You are a documentation and context generation assistant. "
        "You have access to tools that can search the indexed codebase and read files. "
        "Use these tools extensively to understand the project's purpose, structure, and functionality. "
        "From that understanding, produce a high-quality, comprehensive, and machine-usable context file.\n\n"
        "Your task is to rewrite and expand the provided project description into a complete and precise documentation summary.\n\n"
        "Follow these instructions carefully:\n\n"
        "1. Analyze the codebase using your available tools to identify what the project does, its purpose, and its overall flow.\n"
        "2. Write a clear and concise Markdown document that describes the project in a non-technical way, focusing on what it is and what it provides — not how it works internally.\n"
        "3. Include a section called **important files**, listing only the most relevant files or modules with a short, plain-language explanation of what each does.\n"
        "4. If the project is a client-side codebase, also include the important routes or paths that help end users understand where features or options can be found.\n"
        "5. Add a section called **Questions examples**, listing realistic and varied example questions that users might ask about the project.\n\n"
        "⚠️ Important:\n"
        "- Do NOT include deep technical implementation details, internal function names, or dependencies.\n"
        "- Keep it simple, descriptive, and user-oriented.\n"
        "- The output must be valid Markdown and follow this exact structure:\n\n"
        "# <Project name> project description\n\n"
        "A detailed, but concise description of the project, summarizing its purpose, architecture, and capabilities.\n\n"
        "## important files\n\n"
        "- file path: short explanation\n\n"
        "## Questions examples\n\n"
        "- Example question 1\n"
        "- Example question 2\n"
        "- Example question 3\n\n"
        "Do NOT include any commentary or notes outside the Markdown block.\n\n"
        "Original content:\n\n" + desc_content
    )

    # Call the agent to get an improved version
    try:
        result = agent.call_agent(
            root_dir=root_dir,
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
            context=desc_content,
            re_index=False,
            user_query=user_query,
        )
    except Exception:
        raise

    # Best-effort extraction of textual output
    improved = None
    try:
        # agent.call_agent often returns a mapping with an 'output' key
        improved = result["output"]
    except Exception:
        try:
            # fallback to attribute access
            improved = getattr(result, "output", None)
        except Exception:
            improved = None

    if improved is None:
        # Last resort: string representation
        improved = str(result)

    # Save or print
    if in_place:
        desc_file.write_text(improved, encoding="utf-8")
        typer.echo(f"Wrote improved description in place to {desc_file}")
    elif output:
        out_path = Path(output)
        if not out_path.is_absolute():
            out_path = Path(root_dir) / out_path
        out_path.write_text(improved, encoding="utf-8")
        typer.echo(f"Wrote improved description to {out_path}")
    else:
        typer.echo(improved)


@app.command("verify-context")
def verify_context(
    root_dir: str = typer.Option(
        ".",
        "--root-dir",
        "-r",
        help="Root directory of the codebase (used to resolve relative paths)"
    ),
    context_path: str = typer.Option(
        "desc.md",
        "--context",
        help="Path to the context markdown file to verify"
    ),
    model: str = typer.Option(
        "openai/gpt-4.1",
        "--model",
        help="LLM model identifier"
    ),
    temperature: float = typer.Option(
        0.5,
        "--temperature",
        "-t",
        help="Sampling temperature"
    ),
    base_url: str = typer.Option(
        "https://openrouter.ai/api/v1",
        "--base-url",
        help="Base URL for the LLM API"
    ),
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key",
        help="API key for the LLM provider",
        envvar="ROKOVO_API_KEY"
    ),
    output: Optional[str] = typer.Option(
        None,
        "--output",
        "-o",
        help="Write verified content to this output file"
    ),
) -> None:
    """
    Verify the content of a context markdown file (from improve-desc or faq) against the codebase.
    Fact-check all claims, fix any wrong info, and label unverifiable claims as suspicious.
    """
    config_path = Path(root_dir) / "rokovo.toml"
    cfg = {}
    if config_path.exists():
        with open(config_path, "rb") as f:
            cfg = tomllib.load(f)
    llm_cfg = cfg.get("llm", {}) if isinstance(cfg, dict) else {}
    model = model or llm_cfg.get("model", model)
    base_url = base_url or llm_cfg.get("base_url", base_url)
    temperature = temperature if temperature is not None else llm_cfg.get(
        "temperature", temperature
    )
    api_key = api_key or os.environ.get("ROKOVO_API_KEY")
    # Resolve context file path
    ctx_file = Path(context_path)
    if not ctx_file.is_absolute():
        ctx_file = Path(root_dir) / ctx_file
    if not ctx_file.exists():
        raise Exception(f"Context file not found: {ctx_file}")
    ctx_content = ctx_file.read_text(encoding="utf-8")
    # Prompt for verifier agent
    user_query = (
        "You are a verifier agent. "
        "Use code search and file reading tools to fact-check the provided Markdown context file "
        "against the actual codebase. "
        "Verify each description, claim, and example by finding supporting evidence in the code.\n\n"
        "If a statement is incorrect, fix it. and mark is as **[✅ Fix]** and keep the original text with the fixed version "
        "If no clear evidence is found, mark it as **[⚠️ Unverified]** and keep the original text. "
        "Ensure the final output remains a valid, readable Markdown document with clear annotations.\n\n"
        "Output: a corrected and annotated Markdown file that accurately reflects the project.\n\n"
        "Context to verify:\n\n" + ctx_content
    )
    # Call the agent to get a verified version
    try:
        result = agent.call_agent(
            root_dir=root_dir,
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
            context=ctx_content,
            re_index=False,
            user_query=user_query,
        )
    except Exception:
        raise
    verified = None
    try:
        verified = result["output"]
    except Exception:
        try:
            verified = getattr(result, "output", None)
        except Exception:
            verified = None
    if verified is None:
        verified = str(result)
    if output:
        out_path = Path(output)
        if not out_path.is_absolute():
            out_path = Path(root_dir) / out_path
        out_path.write_text(verified, encoding="utf-8")
        typer.echo(f"Wrote verified context to {out_path}")
    else:
        typer.echo(verified)


def main() -> None:
    """Entry point for console_scripts."""
    try:
        app()
    except Exception as e:
        typer.echo(f"Error: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
