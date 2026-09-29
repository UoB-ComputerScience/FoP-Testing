// Edit result titles, messages and severity here. No build step is needed.
// status: error = critical, warning = advisory, pass = passed, info = note.
// Keep keys, ids and {placeholders} unchanged; use an empty message for title only.
// Entries are possible outcomes, not a fixed list shown for every file.
export default {
  "java.sources.error": {
    "id": "java.sources",
    "status": "error",
    "title": "Java source files: missing",
    "message": "Export the complete project, including .java files."
  },
  "java.sources.pass": {
    "id": "java.sources",
    "status": "pass",
    "title": "Java source files: {count} found",
    "message": ""
  },
  "java.empty.warning": {
    "id": "java.empty",
    "status": "warning",
    "title": "Java source files: empty files found",
    "message": "Check the listed files."
  },
  "java.encoding.warning": {
    "id": "java.encoding",
    "status": "warning",
    "title": "Source encoding: not UTF-8",
    "message": "Confirm the encoding in your project."
  },
  "archive.nested.warning": {
    "id": "archive.nested",
    "status": "warning",
    "title": "Nested archives: found",
    "message": "Check that these are needed, rather than older or unopened exports."
  },
  "archive.build-output.info": {
    "id": "archive.build-output",
    "status": "info",
    "title": "Compiled files: included",
    "message": "These are allowed alongside your source files."
  },
  "archive.generated.warning": {
    "id": "archive.generated",
    "status": "warning",
    "title": "Development files: included",
    "message": "Remove unnecessary files; keep required libraries."
  },
  "archive.backups.warning": {
    "id": "archive.backups",
    "status": "warning",
    "title": "Backup files: found",
    "message": "Remove older copies if they are not needed."
  },
  "archive.portability.warning": {
    "id": "archive.portability",
    "status": "warning",
    "title": "Filenames: possible Windows incompatibility",
    "message": "Check the listed names before exporting."
  },
  "netbeans.project.warning": {
    "id": "netbeans.project",
    "status": "warning",
    "title": "NetBeans project: not recognised",
    "message": "Export the complete project."
  },
  "netbeans.project.warning.2": {
    "id": "netbeans.project",
    "status": "warning",
    "title": "NetBeans project: multiple projects found",
    "message": "Export your final project. Further project checks were skipped."
  },
  "netbeans.project.pass": {
    "id": "netbeans.project",
    "status": "pass",
    "title": "NetBeans project: one project found",
    "message": ""
  },
  "netbeans.files.warning": {
    "id": "netbeans.files",
    "status": "warning",
    "title": "NetBeans build files: missing files",
    "message": "Check the listed files, or confirm your custom build setup."
  },
  "netbeans.files.pass": {
    "id": "netbeans.files",
    "status": "pass",
    "title": "NetBeans build files: all present",
    "message": ""
  },
  "netbeans.source-path.error": {
    "id": "netbeans.source-path",
    "status": "error",
    "title": "Source folder: {folder} missing",
    "message": "Include this folder or correct the project settings."
  },
  "netbeans.source-path.pass": {
    "id": "netbeans.source-path",
    "status": "pass",
    "title": "Source folder: {folder} found",
    "message": ""
  },
  "netbeans.source-path.info": {
    "id": "netbeans.source-path",
    "status": "info",
    "title": "Source folder: custom setting",
    "message": "Open the project in NetBeans to check it."
  },
  "netbeans.java-version.pass": {
    "id": "netbeans.java-version",
    "status": "pass",
    "title": "Java version: {version} configured",
    "message": ""
  },
  "netbeans.java-version.warning": {
    "id": "netbeans.java-version",
    "status": "warning",
    "title": "Java version: expected {version}",
    "message": "Found source={source}, target={target}{releaseSetting}."
  },
  "fop.files.info": {
    "id": "fop.files",
    "status": "info",
    "title": "Coursework files: not checked",
    "message": "A single project folder is needed."
  },
  "fop.source-files.warning": {
    "id": "fop.source-files",
    "status": "warning",
    "title": "Starter source files: missing paths",
    "message": "Check the listed files. Intentional restructuring is allowed."
  },
  "fop.source-files.pass": {
    "id": "fop.source-files",
    "status": "pass",
    "title": "Starter source files: all 10 present",
    "message": ""
  },
  "fop.assets.warning": {
    "id": "fop.assets",
    "status": "warning",
    "title": "Game images: missing files",
    "message": "Include the listed images or your replacements."
  },
  "fop.assets.pass": {
    "id": "fop.assets",
    "status": "pass",
    "title": "Game images: all 20 present",
    "message": ""
  },
  "fop.starter.error": {
    "id": "fop.starter",
    "status": "error",
    "title": "Starter code: unchanged",
    "message": "Export the project containing your own work."
  },
  "submission.report.warning": {
    "id": "submission.report",
    "status": "warning",
    "title": "Report: included inside ZIP",
    "message": "Submit the report separately on Canvas as well."
  },
  "archive.integrity.pass": {
    "id": "archive.integrity",
    "status": "pass",
    "title": "ZIP integrity: {count} files verified",
    "message": ""
  },
  "submission.extension.warning": {
    "id": "submission.extension",
    "status": "warning",
    "title": "ZIP filename: missing .zip extension",
    "message": "Add .zip to the filename."
  }
};
