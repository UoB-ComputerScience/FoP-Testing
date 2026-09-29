import {makeFinding} from './findings.js';
import { ZipReader, BlobReader, configure, ERR_AMBIGUOUS_ARCHIVE, WARNING_DUPLICATE_FILENAME, ERR_UNSAFE_FILENAME, ERR_UNSUPPORTED_COMPRESSION } from '../vendor/zip.js';
import { LIMITS } from './profiles.js';

// The application owns a cancellable worker; never start nested workers.
configure({ useWebWorkers:false });

export class ArchiveError extends Error {
  constructor(id, message, paths=[]) { super(message); this.id=id; this.paths=paths; }
}
const fail = (key,values,paths) => {
  const result=makeFinding(key,values,paths);
  const error=new ArchiveError(result.id,result.message,result.paths);
  error.finding=result;
  throw error;
};

export function inspectMetadata(entries, limits=LIMITS) {
  if (entries.length>limits.entries) fail('archive.limit.warning',{limit:limits.entries.toLocaleString()});
  let total=0;
  const seen=new Map(), files=new Map(), portability=[];
  for (const entry of entries) {
    const original=entry.filename;
    const name=original.replaceAll('\\','/');
    if (!name || /^[\/]/.test(name) || /^[a-z]:/i.test(name) || /[\x00-\x1f\x7f]/.test(name) || name.split('/').some(p=>p==='..'||p==='.') || name.includes('//')) {
      fail('archive.paths.error',{},[original]);
    }
    const path=name.replace(/\/$/,'');
    const key=path.normalize('NFC').toLowerCase();
    if (seen.has(key)) fail('archive.ambiguous.error',{},[seen.get(key),original]);
    seen.set(key,original);
    if (entry.symlink) fail('archive.links.error',{},[original]);
    if (entry.encrypted) fail('archive.encrypted.error',{},[original]);
    if (!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0 || entry.uncompressedSize>limits.entryBytes) fail('archive.limit.warning.2',{},[original]);
    total+=entry.uncompressedSize;
    if (total>limits.expandedBytes) fail('archive.limit.warning.3');
    if (path.split('/').some(p=>/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)||/[<>:"|?*]/.test(p))) portability.push(original);
    // Some exports identify empty directory entries only by their trailing slash.
    const directory=entry.directory || (name.endsWith('/') && entry.uncompressedSize===0);
    if (!directory) files.set(path,{path,size:entry.uncompressedSize,entry});
  }
  // A file cannot also be the parent directory of another entry.
  const fileKeys=new Set([...files.keys()].map(p=>p.normalize('NFC').toLowerCase()));
  for (const path of seen.keys()) {
    const parts=path.split('/');
    for(let i=1;i<parts.length;i++) if(fileKeys.has(parts.slice(0,i).join('/'))) fail('archive.ambiguous.error.2',{},[path]);
  }
  if(!files.size) fail('archive.empty.error');
  return {files,portability,expandedBytes:total};
}

export async function readArchive(blob, {limits=LIMITS,progress=()=>{},textPattern=/\.(java|properties|xml)$/i,decoderFactory=()=>new TextDecoder('utf-8',{fatal:true})}={}) {
  if(blob.size>limits.archiveBytes) fail('archive.limit.warning.4');
  const header=new Uint8Array(await blob.slice(0,8).arrayBuffer());
  const startsWith=signature=>signature.every((byte,index)=>header[index]===byte);
  const otherFormat=startsWith([0x52,0x61,0x72,0x21,0x1a,0x07])?'RAR':startsWith([0x37,0x7a,0xbc,0xaf,0x27,0x1c])?'7z':null;
  if(otherFormat) fail('archive.format.warning',{format:otherFormat});
  const reader=new ZipReader(new BlobReader(blob), {useWebWorkers:false,checkCrc32:true,checkOverlappingEntry:true,strictness:'strict'});
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),limits.milliseconds);
  let currentPath='';
  try {
    const entries=[];
    for await (const entry of reader.getEntriesGenerator()) {
      entries.push(entry);
      if(entries.length>limits.entries) fail('archive.limit.warning.5',{limit:limits.entries.toLocaleString()});
    }
    const archive=inspectMetadata(entries,limits);
    let total=0,completed=0;
    for(const file of archive.files.values()) {
      currentPath=file.path;
      const keepText=textPattern.test(file.path);
      let decoder=null;
      let text='',bytes=0,invalidEncoding=false;
      const sink=new WritableStream({
        write(chunk) {
          bytes+=chunk.byteLength; total+=chunk.byteLength;
          if(bytes>limits.entryBytes||total>limits.expandedBytes) fail('archive.limit.warning.6',{},[file.path]);
          if(keepText&&!invalidEncoding) {
            try {decoder??=decoderFactory(chunk);text+=decoder.decode(chunk,{stream:true});} catch {invalidEncoding=true;text='';}
          }
        }
      });
      await file.entry.getData(sink,{checkCrc32:true,signal:abort.signal,useWebWorkers:false});
      if(bytes!==file.size) fail('archive.corrupt.error',{},[file.path]);
      if(decoder&&!invalidEncoding) {
        try {text+=decoder.decode();} catch {invalidEncoding=true;text='';}
      }
      file.text=keepText&&!invalidEncoding?text:null;
      file.invalidEncoding=invalidEncoding;
      delete file.entry;
      progress({completed:++completed,total:archive.files.size});
    }
    return archive;
  } catch(error) {
    if(error instanceof ArchiveError) throw error;
    if(abort.signal.aborted) fail('archive.timeout.warning');
    if(error.message===ERR_AMBIGUOUS_ARCHIVE&&error.reason===WARNING_DUPLICATE_FILENAME) fail('archive.duplicate.error');
    if(error.message===ERR_UNSAFE_FILENAME) fail('archive.paths.error',{},error.filename?[error.filename]:[]);
    if(error.message===ERR_UNSUPPORTED_COMPRESSION) fail('archive.compression.warning',{},currentPath?[currentPath]:[]);
    // Let the ZIP reader try first: readable archives may have a leading prefix.
    // With no readable entry or ZIP header, give the direct submission instruction.
    if(!currentPath&&!startsWith([0x50,0x4b])) fail('archive.not-zip.error');
    fail('archive.unreadable.error',{},currentPath?[currentPath]:[]);
  } finally {
    clearTimeout(timer);
    await reader.close().catch(()=>{});
  }
}
