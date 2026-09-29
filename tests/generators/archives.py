"""Generate archive-container cases; requires Node.js and a RAR executable."""

import zipfile

from common import archive, encrypt, finish, options, rar_archive, save

args = options(__doc__, node=True, rar=True)
payload = b"// Synthetic archive test; not a coursework submission.\nclass Main {}\n"
entries = [("src/Main.java", payload)]
base = archive(entries)
save(args.output, "01-valid-stored.zip", base)
save(args.output, "02-valid-deflated.zip", archive(entries, zipfile.ZIP_DEFLATED))
save(args.output, "03-truncated-download.zip", base[:-12])
damaged = bytearray(base)
damaged[damaged.index(payload) + 5] ^= 1
save(args.output, "04-corrupted-file-data.zip", damaged)
damaged = bytearray(base)
position = damaged.index(b"PK\x01\x02")
damaged[position : position + 4] = b"BAD!"
save(args.output, "05-broken-central-directory.zip", damaged)
save(args.output, "06-broken-file-header.zip", b"BAD!" + base[4:])
save(args.output, "07-empty.zip", archive([]))
save(
    args.output,
    "08-folders-only.zip",
    archive([("project/", b""), ("project/src/", b"")]),
)
encrypt(args, base, "09-password-protected.zip")
save(args.output, "10-bzip2-compression.zip", archive(entries, zipfile.ZIP_BZIP2))
save(args.output, "11-lzma-compression.zip", archive(entries, zipfile.ZIP_LZMA))
save(
    args.output,
    "12-duplicate-filename.zip",
    archive(entries + [("src/Main.java", b"class Other {}")]),
)
save(
    args.output,
    "13-filename-case-collision.zip",
    archive(entries + [("src/main.java", b"class Other {}")]),
)
save(
    args.output,
    "14-file-folder-collision.zip",
    archive([("src", b"ordinary file")] + entries),
)
save(args.output, "15-parent-directory-path.zip", archive([("../Main.java", payload)]))
rar = rar_archive(args, [("Main.java", payload)], "16-genuine-rar.rar")
save(args.output, "17-rar-renamed-as-zip.zip", rar)
finish(args, "Archive-errors")
