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

app = typer.Typer(help="Rokovo CLI - A modern Python CLI template.")


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
    """Extracts a list of FAQs from your code base."""
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
    """Run a simple REPL that echoes user input. Loads config the same way as 'faq'."""
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
    """Extracts a list of FAQs from your code base."""
    project_name = utils.get_top_directory(root_dir)
    config_path = Path(__file__).parent / ".." / "example" / "rokovo.toml"
    ignore_path = Path(__file__).parent / ".." / "example" / ".rokovoignore"
    context_path = Path(__file__).parent / ".." / "example" / "rokovo_context.md"

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


def main() -> None:
    """Entry point for console_scripts."""
    app()


if __name__ == "__main__":
    main()
