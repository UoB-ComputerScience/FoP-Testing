import { ZipReader, BlobReader, configure } from '../vendor/zip.js';
import { LIMITS } from './profiles.js';

// The application owns a cancellable worker; never start nested workers.
configure({ useWebWorkers:false });

export class ArchiveError extends Error {
  constructor(id, message, paths=[]) { super(message); this.id=id; this.paths=paths; }
}
const fail = (id,message,paths) => { throw new ArchiveError(id,message,paths); };

export function inspectMetadata(entries, limits=LIMITS) {
  if (entries.length>limits.entries) fail('archive.limit',`This ZIP has more than ${limits.entries.toLocaleString()} entries, which exceeds this checker’s limit. Remove unnecessary folders or ask your module team how to check a larger project.`);
  let total=0;
  const seen=new Map(), files=new Map(), portability=[];
  for (const entry of entries) {
    const original=entry.filename;
    const name=original.replaceAll('\\','/');
    if (!name || /^[\/]/.test(name) || /^[a-z]:/i.test(name) || /[\x00-\x1f\x7f]/.test(name) || name.split('/').some(p=>p==='..'||p==='.') || name.includes('//')) {
      fail('archive.paths','This ZIP contains a path that cannot be interpreted safely. Export a fresh ZIP of the project.',[original]);
    }
    const path=name.replace(/\/$/,'');
    const key=path.normalize('NFC').toLowerCase();
    if (seen.has(key)) fail('archive.ambiguous','This ZIP contains duplicate paths or filenames that differ only in case or slash style. Check the listed files and export one unambiguous project.',[seen.get(key),original]);
    seen.set(key,original);
    if (entry.symlink) fail('archive.links','This checker cannot follow symbolic links in a ZIP. Include the actual source files and resources in the export.',[original]);
    if (entry.encrypted) fail('archive.encrypted','This ZIP is password-protected. Export a ZIP without a password so the project files can be checked.',[original]);
    if (!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0 || entry.uncompressedSize>limits.entryBytes) fail('archive.limit','An entry exceeds this checker’s 10 MiB expanded-file limit. This is a checking limit, not a coursework mark.',[original]);
    total+=entry.uncompressedSize;
    if (total>limits.expandedBytes) fail('archive.limit','The expanded ZIP exceeds this checker’s 100 MiB limit. Remove unnecessary generated files, or ask your module team how to check this archive.');
    if (path.split('/').some(p=>/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)||/[<>:"|?*]/.test(p))) portability.push(original);
    if (!entry.directory) files.set(path,{path,size:entry.uncompressedSize,entry});
  }
  // A file cannot also be the parent directory of another entry.
  const fileKeys=new Set([...files.keys()].map(p=>p.normalize('NFC').toLowerCase()));
  for (const path of seen.keys()) {
    const parts=path.split('/');
    for(let i=1;i<parts.length;i++) if(fileKeys.has(parts.slice(0,i).join('/'))) fail('archive.ambiguous','A file and a directory share the same path. Export a fresh ZIP of the project.',[path]);
  }
  if(!files.size) fail('archive.empty','This ZIP contains no files. Export the complete project, then check the new ZIP.');
  return {files,portability,expandedBytes:total};
}

export async function readArchive(blob, {limits=LIMITS,progress=()=>{}}={}) {
  if(blob.size>limits.archiveBytes) fail('archive.limit','This ZIP exceeds the 25 MiB file limit. Remove unnecessary generated files, or ask your module team how to check a larger project.');
  const reader=new ZipReader(new BlobReader(blob), {useWebWorkers:false,checkCrc32:true,checkOverlappingEntry:true,strictness:'strict'});
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),limits.milliseconds);
  let currentPath='';
  try {
    const entries=[];
    for await (const entry of reader.getEntriesGenerator()) {
      entries.push(entry);
      if(entries.length>limits.entries) fail('archive.limit',`This ZIP exceeds the checker’s ${limits.entries.toLocaleString()}-entry limit.`);
    }
    const archive=inspectMetadata(entries,limits);
    let total=0,completed=0;
    for(const file of archive.files.values()) {
      currentPath=file.path;
      const keepText=/\.(java|properties|xml)$/i.test(file.path);
      const decoder=keepText ? new TextDecoder('utf-8',{fatal:true}) : null;
      let text='',bytes=0,invalidEncoding=false;
      const sink=new WritableStream({
        write(chunk) {
          bytes+=chunk.byteLength; total+=chunk.byteLength;
          if(bytes>limits.entryBytes||total>limits.expandedBytes) fail('archive.limit','The actual expanded data exceeds this checker’s limits. Further checks were stopped.',[file.path]);
          if(decoder&&!invalidEncoding) {
            try {text+=decoder.decode(chunk,{stream:true});} catch {invalidEncoding=true;text='';}
          }
        }
      });
      await file.entry.getData(sink,{checkCrc32:true,signal:abort.signal,useWebWorkers:false});
      if(bytes!==file.size) fail('archive.corrupt','An expanded file does not match its recorded size. Export a fresh ZIP.',[file.path]);
      if(decoder&&!invalidEncoding) {
        try {text+=decoder.decode();} catch {invalidEncoding=true;text='';}
      }
      file.text=decoder&&!invalidEncoding?text:null;
      file.invalidEncoding=invalidEncoding;
      delete file.entry;
      progress({completed:++completed,total:archive.files.size});
    }
    return archive;
  } catch(error) {
    if(error instanceof ArchiveError) throw error;
    if(abort.signal.aborted) fail('archive.timeout','The check took too long and was stopped. Try a smaller export or ask your module team for help.');
    fail('archive.unreadable','This ZIP could not be fully read or verified. It may be damaged or use an unsupported ZIP format. Export a fresh ZIP from your project and try again.',currentPath?[currentPath]:[]);
  } finally {
    clearTimeout(timer);
    await reader.close().catch(()=>{});
  }
}
