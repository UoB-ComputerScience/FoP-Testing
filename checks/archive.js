// Edit result titles, messages and severity here. No build step is needed.
// status: error = critical, warning = advisory, pass = passed, info = note.
// Keep keys, ids and {placeholders} unchanged; use an empty message for title only.
// Entries are possible outcomes, not a fixed list shown for every file.
export default {
  "archive.limit.warning": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP has more than {limit} entries, which exceeds this checker’s limit. Remove unnecessary folders or ask your module team how to check a larger project."
  },
  "archive.paths.error": {
    "id": "archive.paths",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains a path that cannot be interpreted safely. Export a fresh ZIP of the project."
  },
  "archive.ambiguous.error": {
    "id": "archive.ambiguous",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains duplicate paths or filenames that differ only in case or slash style. Check the listed files and export one unambiguous project."
  },
  "archive.links.error": {
    "id": "archive.links",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This checker cannot follow symbolic links in a ZIP. Include the actual source files and resources in the export."
  },
  "archive.encrypted.error": {
    "id": "archive.encrypted",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP is password-protected. Export a ZIP without a password so the project files can be checked."
  },
  "archive.limit.warning.2": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "An entry exceeds this checker’s 10 MiB expanded-file limit. This is a checking limit, not a coursework mark."
  },
  "archive.limit.warning.3": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The expanded ZIP exceeds this checker’s 100 MiB limit. Remove unnecessary generated files, or ask your module team how to check this archive."
  },
  "archive.ambiguous.error.2": {
    "id": "archive.ambiguous",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "A file and a directory share the same path. Export a fresh ZIP of the project."
  },
  "archive.empty.error": {
    "id": "archive.empty",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This ZIP contains no files. Export the complete project, then check the new ZIP."
  },
  "archive.limit.warning.4": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP exceeds the 25 MiB file limit. Remove unnecessary generated files, or ask your module team how to check a larger project."
  },
  "archive.format.error": {
    "id": "archive.format",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This is a {format} archive, not a ZIP. Export your project in ZIP format. Changing the filename to .zip will not convert it."
  },
  "archive.limit.warning.5": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "This ZIP exceeds the checker’s {limit}-entry limit."
  },
  "archive.limit.warning.6": {
    "id": "archive.limit",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The actual expanded data exceeds this checker’s limits. Further checks were stopped."
  },
  "archive.corrupt.error": {
    "id": "archive.corrupt",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "An expanded file does not match its recorded size. Export a fresh ZIP."
  },
  "archive.timeout.warning": {
    "id": "archive.timeout",
    "status": "warning",
    "title": "Archive check could not be completed",
    "message": "The check took too long and was stopped. Try a smaller export or ask your module team for help."
  },
  "archive.unreadable.error": {
    "id": "archive.unreadable",
    "status": "error",
    "title": "Archive check could not be completed",
    "message": "This file could not be fully read or verified as a ZIP. It may be damaged or use a different or unsupported archive format. Export a fresh ZIP from your project and try again."
  }
};
