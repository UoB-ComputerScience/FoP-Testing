// Edit result titles, messages and severity here. No build step is needed.
// status: error = critical, warning = advisory, pass = passed, info = note.
// Keep keys, ids and {placeholders} unchanged; use an empty message for title only.
// Entries are possible outcomes, not a fixed list shown for every file.
// purpose and method document the reasoning for maintainers; they are not shown to students.
export default {
  "report.unsupported.warning": {
    "id": "report.unsupported",
    "status": "warning",
    "title": "Report format: not supported",
    "message": "This may be an older or protected Word file. Save an unprotected DOCX copy.",
    "purpose": "Avoid declaring an uninspected legacy or protected Word file broken.",
    "method": "Recognise the compound Office file signature and advise saving an unprotected DOCX copy."
  },
  "report.limit.warning": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This document contains more text or formatting data than this checker can inspect. Open it in your document editor to check it.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.encrypted.error": {
    "id": "report.encrypted",
    "status": "error",
    "title": "Report: password-protected",
    "message": "Save a copy without a password.",
    "purpose": "Ensure a report can be opened without a password.",
    "method": "Detect ZIP encryption, encrypted ODT manifest entries or a PDF opening-password request."
  },
  "report.limit.warning.2": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This report exceeds the checker’s size or processing limits. Open it in your document editor to check it.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.unreadable.error": {
    "id": "report.unreadable",
    "status": "error",
    "title": "Report file: unreadable",
    "message": "Open it in your editor and save a fresh DOCX copy.",
    "purpose": "Detect a document package that cannot be read.",
    "method": "Verify the DOCX/ODT ZIP container and checksums before passing bounded document parts to the XML inspector."
  },
  "report.format.warning": {
    "id": "report.format",
    "status": "warning",
    "title": "Report format: not a standard DOCX",
    "message": "Save a DOCX copy from your document editor.",
    "purpose": "Ensure the file contains a recognised report document.",
    "method": "Inspect DOCX content types and main-document relationships, or the ODT mimetype and manifest. Do not rely only on the filename."
  },
  "report.format.error": {
    "id": "report.format",
    "status": "error",
    "title": "Report format: not recognised",
    "message": "Choose the report saved from your document editor.",
    "purpose": "Ensure the file contains a recognised report document.",
    "method": "Inspect DOCX content types and main-document relationships, or the ODT mimetype and manifest. Do not rely only on the filename."
  },
  "report.structure.error": {
    "id": "report.structure",
    "status": "error",
    "title": "Report structure: missing or unreadable data",
    "message": "Check the document in your editor and save a fresh DOCX copy.",
    "purpose": "Identify missing or unreadable document parts.",
    "method": "Parse XML, locate the main body and verify internal relationship targets or manifest entries exist. External hyperlinks are not fetched."
  },
  "report.readable.pass": {
    "id": "report.readable",
    "status": "pass",
    "title": "{format} structure: readable",
    "message": "",
    "purpose": "Confirm document structure or PDF page data can be read.",
    "method": "DOCX/ODT: verify the package, main body and referenced parts. PDF: load every page and extract text while checking parser failures. Page appearance is not assessed."
  },
  "report.word-format.warning": {
    "id": "report.word-format",
    "status": "warning",
    "title": "Report format: ODT",
    "message": "Save a DOCX copy for submission.",
    "purpose": "Guide readable alternative formats towards the expected DOCX submission.",
    "method": "After reading ODT or PDF, advise saving DOCX from the original document; renaming an extension does not convert it."
  },
  "report.extension.warning": {
    "id": "report.extension",
    "status": "warning",
    "title": "Report filename: expected .{extension}",
    "message": "The contents are {format}; save with the correct extension.",
    "purpose": "Identify filenames that do not match the actual document format.",
    "method": "Compare the detected format with the filename extension after inspecting the contents."
  },
  "report.empty.warning": {
    "id": "report.empty",
    "status": "warning",
    "title": "Report text: none found",
    "message": "Check that your written report is present; it may contain scanned pages.",
    "purpose": "Catch an empty report or selection of the wrong file.",
    "method": "Count main-body words. If none exist, check for embedded visual content: images produce advisory; no text or images produces critical."
  },
  "report.empty.error": {
    "id": "report.empty",
    "status": "error",
    "title": "Report content: empty",
    "message": "Select your completed report.",
    "purpose": "Catch an empty report or selection of the wrong file.",
    "method": "Count main-body words. If none exist, check for embedded visual content: images produce advisory; no text or images produces critical."
  },
  "report.words.pass": {
    "id": "report.words",
    "status": "pass",
    "title": "Word count: approximately {count}",
    "message": "",
    "purpose": "Provide a descriptive word count without judging report quality.",
    "method": "Count word-like segments from main DOCX/ODT body text or extracted PDF text, with a whitespace fallback. Text inside images is not counted."
  },
  "report.limit.warning.3": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This report exceeds the checker’s 25 MiB file limit.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.limit.warning.4": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This PDF has more than 200 pages, which exceeds this checker’s limit. Open it in a PDF reader to check it.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.limit.warning.5": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "This PDF contains more text than this checker can inspect. Open it in a PDF reader to check it.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.readable.pass.2": {
    "id": "report.readable",
    "status": "pass",
    "title": "PDF readability: {pages} pages checked",
    "message": "",
    "purpose": "Confirm document structure or PDF page data can be read.",
    "method": "DOCX/ODT: verify the package, main body and referenced parts. PDF: load every page and extract text while checking parser failures. Page appearance is not assessed."
  },
  "report.word-format.warning.2": {
    "id": "report.word-format",
    "status": "warning",
    "title": "Report format: PDF",
    "message": "Save a DOCX copy from your original document for submission.",
    "purpose": "Guide readable alternative formats towards the expected DOCX submission.",
    "method": "After reading ODT or PDF, advise saving DOCX from the original document; renaming an extension does not convert it."
  },
  "report.extension.warning.2": {
    "id": "report.extension",
    "status": "warning",
    "title": "Report filename: contains a PDF",
    "message": "Save a DOCX copy from your original document.",
    "purpose": "Identify filenames that do not match the actual document format.",
    "method": "Compare the detected format with the filename extension after inspecting the contents."
  },
  "report.pdf-text.warning": {
    "id": "report.pdf-text",
    "status": "warning",
    "title": "PDF text: none found",
    "message": "Check for blank or scanned pages. Text in images is not counted.",
    "purpose": "Flag blank or scanned PDFs requiring a visual check.",
    "method": "If page text extraction returns no words, advise checking the document; do not assume image-only pages are empty."
  },
  "report.words.pass.2": {
    "id": "report.words",
    "status": "pass",
    "title": "Word count: approximately {count}",
    "message": "",
    "purpose": "Provide a descriptive word count without judging report quality.",
    "method": "Count word-like segments from main DOCX/ODT body text or extracted PDF text, with a whitespace fallback. Text inside images is not counted."
  },
  "report.limit.warning.6": {
    "id": "report.limit",
    "status": "warning",
    "title": "Report check incomplete",
    "message": "PDF checking took too long and was stopped. Open the document in a PDF reader to check it.",
    "purpose": "Keep document parsing within browser limits.",
    "method": "Bound file size, text and formatting data, processing time and PDF page count. A limit produces incomplete checking rather than a claim that the report is broken."
  },
  "report.pdf-unreadable.error": {
    "id": "report.pdf-unreadable",
    "status": "error",
    "title": "PDF file: unreadable",
    "message": "Check it in a PDF reader, then save a fresh copy from the original document.",
    "purpose": "Identify PDFs whose pages or text cannot be read.",
    "method": "Catch PDF parsing and page extraction failures, including damaged stream diagnostics. Unsupported features may also cause this outcome."
  }
};
