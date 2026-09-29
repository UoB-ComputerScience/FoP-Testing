// Edit result titles, messages and severity here. No build step is needed.
// status: error = critical, warning = advisory, pass = passed, info = note.
// Keep keys, ids and {placeholders} unchanged; use an empty message for title only.
// Entries are possible outcomes, not a fixed list shown for every file.
// purpose and method document the reasoning for maintainers; they are not shown to students.
// Archive = the container format (ZIP, RAR, 7z). These checks validate the container.
export default {
  "archive.limit.warning": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP has more than {limit} entries, which exceeds this checker’s limit. Remove unnecessary folders or ask your module team how to check a larger project.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.paths.error": {
    "id": "archive.paths",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains a path that cannot be interpreted safely. Export a fresh ZIP of the project.",
    "purpose": "Avoid archive paths that cannot be handled safely or consistently.",
    "method": "Reject absolute paths, drive prefixes, control characters and dot or parent-directory segments."
  },
  "archive.ambiguous.error": {
    "id": "archive.ambiguous",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains duplicate paths or filenames that differ only in case or slash style. Check the listed files and export one unambiguous project.",
    "purpose": "Avoid conflicting extraction destinations.",
    "method": "Normalise slash style, Unicode and case, then detect duplicate paths and file/folder collisions. This can be stricter than a desktop archive reader."
  },
  "archive.links.error": {
    "id": "archive.links",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This checker cannot follow symbolic links in a ZIP. Include the actual source files and resources in the export.",
    "purpose": "Ensure the archive contains the actual files to inspect.",
    "method": "Reject symbolic-link entries because this checker does not follow them."
  },
  "archive.encrypted.error": {
    "id": "archive.encrypted",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP is password-protected. Export a ZIP without a password so the project files can be checked.",
    "purpose": "Ensure the coursework can be opened without a password.",
    "method": "Reject ZIP entries marked encrypted."
  },
  "archive.limit.warning.2": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "An entry exceeds this checker’s 10 MiB expanded-file limit. This is a checking limit, not a coursework mark.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.limit.warning.3": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The expanded ZIP exceeds this checker’s 100 MiB limit. Remove unnecessary generated files, or ask your module team how to check this archive.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.ambiguous.error.2": {
    "id": "archive.ambiguous",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "A file and a directory share the same path. Export a fresh ZIP of the project.",
    "purpose": "Avoid conflicting extraction destinations.",
    "method": "Normalise slash style, Unicode and case, then detect duplicate paths and file/folder collisions. This can be stricter than a desktop archive reader."
  },
  "archive.empty.error": {
    "id": "archive.empty",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains no files. Export the complete project, then check the new ZIP.",
    "purpose": "Catch exports with no submitted files.",
    "method": "Require at least one non-directory entry."
  },
  "archive.limit.warning.4": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP exceeds the 25 MiB file limit. Remove unnecessary generated files, or ask your module team how to check a larger project.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.format.warning": {
    "id": "archive.format",
    "status": "warning",
    "title": "Archive format: {format}",
    "message": "Export a ZIP to check the project contents. Renaming the file will not convert it.",
    "purpose": "Identify a different archive format without claiming it is broken.",
    "method": "Recognise RAR and 7z header signatures, regardless of the filename. Report advisory and stop because their contents cannot be checked by the ZIP reader. Signature recognition alone does not verify archive integrity."
  },
  "archive.limit.warning.5": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP exceeds the checker’s {limit}-entry limit.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.limit.warning.6": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The actual expanded data exceeds this checker’s limits. Further checks were stopped.",
    "purpose": "Keep browser processing within bounded memory and work limits.",
    "method": "Apply the configured ZIP limits: 25 MiB input, 10 MiB per expanded file, 100 MiB total expansion and 4,000 entries. Check both declared and actual sizes; reaching a limit leaves the check incomplete."
  },
  "archive.corrupt.error": {
    "id": "archive.corrupt",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "An expanded file does not match its recorded size. Export a fresh ZIP.",
    "purpose": "Detect data that does not match archive metadata.",
    "method": "Compare actual decompressed byte count with the recorded entry size."
  },
  "archive.timeout.warning": {
    "id": "archive.timeout",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The check took too long and was stopped. Try a smaller export or ask your module team for help.",
    "purpose": "Stop archive processing that takes too long.",
    "method": "Abort ZIP decompression after the configured time limit; report incomplete checking, not confirmed corruption."
  },
  "archive.not-zip.error": {
    "id": "archive.not-zip",
    "status": "error",
    "title": "Project ZIP required",
    "message": "Submit a .zip file of your complete NetBeans project.",
    "purpose": "Give a direct instruction when a student selects an individual source file or another non-ZIP file.",
    "method": "After ZIP parsing fails, use this result when no file entry was read and the file lacks a leading ZIP signature. Valid ZIP contents are tried regardless of filename; recognised RAR/7z signatures remain advisory."
  },
  "archive.unreadable.error": {
    "id": "archive.unreadable",
    "status": "error",
    "title": "ZIP could not be verified",
    "message": "Export a fresh .zip file of your complete NetBeans project and try again.",
    "purpose": "Catch files that cannot be verified as supported ZIP archives.",
    "method": "Convert ZIP-parser, decompression and checksum failures into an unreadable result with the current file path when available."
  }
};
