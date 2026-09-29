"""Generator support. Use a new output directory to preserve original fixtures."""

import argparse
import io
import shutil
import subprocess
import tempfile
import warnings
import zipfile
from pathlib import Path

from guides import records, write_guides


def options(description, *, node=False, rar=False, starter=False, font=False):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="New directory; an existing path is refused.",
    )
    if node:
        parser.add_argument(
            "--node", default="node", help="Node.js executable for ZIP encryption."
        )
    if rar:
        parser.add_argument(
            "--rar",
            default="rar",
            help="RAR executable; used to create and test genuine RAR fixtures.",
        )
    if starter:
        parser.add_argument(
            "--starter",
            type=Path,
            required=True,
            help="Original FoPCW2025.zip, never student work.",
        )
    if font:
        parser.add_argument(
            "--font",
            type=Path,
            default=Path(__file__).resolve().parents[2]
            / "checker/vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf",
        )
    args = parser.parse_args()
    for name in ("node", "rar"):
        if hasattr(args, name):
            command = shutil.which(getattr(args, name))
            if not command:
                parser.error(f"Provide --{name} with an installed executable.")
            setattr(args, name, command)
    for name in ("starter", "font"):
        if hasattr(args, name) and not getattr(args, name).is_file():
            parser.error(f"--{name} must name an existing file.")
    args.output = args.output.resolve()
    if args.output.exists():
        parser.error(
            "--output must be a new directory; existing examples are never overwritten."
        )
    args.output.mkdir(parents=True)
    return args


def save(folder, name, data):
    with (folder / name).open("xb") as output:
        output.write(data)


def archive(entries, compression=zipfile.ZIP_STORED):
    output = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter(
            "ignore", UserWarning
        )  # Deliberate duplicate-entry fixture.
        with zipfile.ZipFile(output, "w", compression=compression) as stream:
            for name, data in entries:
                stream.writestr(name, data)
    return output.getvalue()


def encrypt(args, data, name):
    with tempfile.TemporaryDirectory(prefix="fop-fixture-") as temporary:
        source = Path(temporary) / "input.zip"
        source.write_bytes(data)
        subprocess.run(
            [
                args.node,
                str(Path(__file__).with_name("encrypt.mjs")),
                str(source),
                str(args.output / name),
            ],
            check=True,
        )


def rar_archive(args, entries, name):
    with tempfile.TemporaryDirectory(prefix="fop-rar-") as temporary:
        root = Path(temporary).resolve()
        for filename, data in entries:
            target = (root / filename).resolve()
            if not target.is_relative_to(root):
                raise ValueError("Unsafe starter path: " + filename)
            if filename.endswith("/"):
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        output = args.output / name
        subprocess.run(
            [args.rar, "a", "-cfg-", "-r", "-idq", str(output), "."],
            cwd=root,
            check=True,
        )
        subprocess.run([args.rar, "t", "-idq", str(output)], check=True)
        return output.read_bytes()


def finish(args, folder):
    present = {p.name for p in args.output.iterdir() if p.is_file()}
    rows = [row for row in records(folder) if row["file"] in present]
    if {row["file"] for row in rows} != present:
        raise ValueError("Generated files are missing from tests/fixtures.json")
    write_guides(args.output, rows)
    print(f"Created {len(rows)} examples and derived guides in {args.output}")
