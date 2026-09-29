// Edit result titles, messages and severity here. No build step is needed.
// status: error = critical, warning = advisory, pass = passed, info = note.
// Keep keys, ids and {placeholders} unchanged; use an empty message for title only.
// Entries are possible outcomes, not a fixed list shown for every file.
export default {
  "report.unsupported.warning": {
    "id": "report.unsupported",
    "status": "warning",
    "title": "Report format: not supported",
    "message": "This may be an older or protected Word file. Save an unprotected DOCX copy."
  },
  "report.limit.warning": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This document contains more text or formatting data than this checker can inspect. Open it in your document editor to check it."
  },
  "report.encrypted.error": {
    "id": "report.encrypted",
    "status": "error",
    "title": "Report: password-protected",
    "message": "Save a copy without a password."
  },
  "report.limit.warning.2": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This report exceeds the checker’s size or processing limits. Open it in your document editor to check it."
  },
  "report.unreadable.error": {
    "id": "report.unreadable",
    "status": "error",
    "title": "Report file: unreadable",
    "message": "Open it in your editor and save a fresh DOCX copy."
  },
  "report.format.warning": {
    "id": "report.format",
    "status": "warning",
    "title": "Report format: not a standard DOCX",
    "message": "Save a DOCX copy from your document editor."
  },
  "report.format.error": {
    "id": "report.format",
    "status": "error",
    "title": "Report format: not recognised",
    "message": "Choose the report saved from your document editor."
  },
  "report.structure.error": {
    "id": "report.structure",
    "status": "error",
    "title": "Report structure: missing or unreadable data",
    "message": "Check the document in your editor and save a fresh DOCX copy."
  },
  "report.readable.pass": {
    "id": "report.readable",
    "status": "pass",
    "title": "{format} structure: readable",
    "message": ""
  },
  "report.word-format.warning": {
    "id": "report.word-format",
    "status": "warning",
    "title": "Report format: ODT",
    "message": "Save a DOCX copy for submission."
  },
  "report.extension.warning": {
    "id": "report.extension",
    "status": "warning",
    "title": "Report filename: expected .{extension}",
    "message": "The contents are {format}; save with the correct extension."
  },
  "report.empty.warning": {
    "id": "report.empty",
    "status": "warning",
    "title": "Report text: none found",
    "message": "Check that your written report is present; it may contain scanned pages."
  },
  "report.empty.error": {
    "id": "report.empty",
    "status": "error",
    "title": "Report content: empty",
    "message": "Select your completed report."
  },
  "report.words.pass": {
    "id": "report.words",
    "status": "pass",
    "title": "Word count: approximately {count}",
    "message": ""
  },
  "report.limit.warning.3": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This report exceeds the checker’s 25 MiB file limit."
  },
  "report.limit.warning.4": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This PDF has more than 200 pages, which exceeds this checker’s limit. Open it in a PDF reader to check it."
  },
  "report.limit.warning.5": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This PDF contains more text than this checker can inspect. Open it in a PDF reader to check it."
  },
  "report.readable.pass.2": {
    "id": "report.readable",
    "status": "pass",
    "title": "PDF readability: {pages} pages checked",
    "message": ""
  },
  "report.word-format.warning.2": {
    "id": "report.word-format",
    "status": "warning",
    "title": "Report format: PDF",
    "message": "Save a DOCX copy from your original document for submission."
  },
  "report.extension.warning.2": {
    "id": "report.extension",
    "status": "warning",
    "title": "Report filename: contains a PDF",
    "message": "Save a DOCX copy from your original document."
  },
  "report.pdf-text.warning": {
    "id": "report.pdf-text",
    "status": "warning",
    "title": "PDF text: none found",
    "message": "Check for blank or scanned pages. Text in images is not counted."
  },
  "report.words.pass.2": {
    "id": "report.words",
    "status": "pass",
    "title": "Word count: approximately {count}",
    "message": ""
  },
  "report.limit.warning.6": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "PDF checking took too long and was stopped. Open the document in a PDF reader to check it."
  },
  "report.pdf-unreadable.error": {
    "id": "report.pdf-unreadable",
    "status": "error",
    "title": "PDF file: unreadable",
    "message": "Check it in a PDF reader, then save a fresh copy from the original document."
  }
};
