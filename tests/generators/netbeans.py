"""Generate project packaging cases from the supplied starter, never student work."""

import io
import zipfile

from common import archive, encrypt, finish, options, rar_archive, save

args = options(__doc__, node=True, rar=True, starter=True)
project = "FoPCW2025-Synthetic"
with zipfile.ZipFile(args.starter) as source:
    entries = [
        (project + "/" + info.filename.split("/", 1)[1], source.read(info))
        for info in source.infolist()
        if "/" in info.filename
    ]
if not any(name.endswith("/GameEngine.java") for name, _ in entries):
    raise ValueError("Expected the original FoPCW2025 starter with a project wrapper.")
entries = [
    (
        name,
        (
            data + b"\n// Synthetic packaging test only.\n"
            if name.endswith("/GameEngine.java")
            else data
        ),
    )
    for name, data in entries
]
base = archive(entries)
for name in (
    "01-complete-project.zip",
    "02-export-without-extension",
    "03-export-named-zip-without-dot zip",
):
    save(args.output, name, base)
save(
    args.output,
    "04-project-name-with-spaces.ZIP",
    archive(
        [
            (name.replace(project, "My coursework project", 1), data)
            for name, data in entries
        ]
    ),
)
no_flags = bytearray(base)
with zipfile.ZipFile(io.BytesIO(base)) as source:
    position = source.start_dir
    for info in source.infolist():
        assert no_flags[position : position + 4] == b"PK\x01\x02"
        if info.is_dir():
            no_flags[position + 5] = 0
            no_flags[position + 38 : position + 42] = b"\0" * 4
        position += 46 + sum(
            int.from_bytes(
                no_flags[position + offset : position + offset + 2], "little"
            )
            for offset in (28, 30, 32)
        )
save(args.output, "05-folders-without-directory-flags.zip", no_flags)
save(args.output, "06-interrupted-export.zip", base[:-12])
damaged = bytearray(base)
damaged[damaged.index(b"Synthetic packaging test only")] ^= 1
save(args.output, "07-damaged-source-data.zip", damaged)
damaged = bytearray(base)
position = damaged.index(b"PK\x01\x02")
damaged[position : position + 4] = b"BAD!"
save(args.output, "08-damaged-file-index.zip", damaged)
rar = rar_archive(args, entries, "09-project-export.rar")
save(args.output, "10-rar-renamed-to-zip.zip", rar)
save(args.output, "11-java-file-renamed-to-zip.zip", b"class SyntheticExample {}\n")
save(
    args.output,
    "12-build-file-renamed-to-zip.zip",
    b'<?xml version="1.0"?><project name="Synthetic"/>',
)
encrypt(args, base, "13-password-protected-project.zip")
save(args.output, "14-unchanged-starter.zip", args.starter.read_bytes())
backups = [(f"backups/example-{i:02}.bak", b"Synthetic backup") for i in range(1, 21)]
save(args.output, "15-many-backup-paths.zip", archive(entries + backups))
finish(args, "NetBeans-exports")
