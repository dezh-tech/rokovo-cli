import os


def get_top_directory(path: str) -> str:
    abs_path = os.path.abspath(path)
    cwd = os.getcwd()
    if os.path.samefile(abs_path, cwd):
        return os.path.basename(cwd)

    rel_path = os.path.relpath(abs_path, cwd)
    parts = rel_path.split(os.sep)
    return parts[0]
