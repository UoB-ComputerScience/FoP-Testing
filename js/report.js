import {makeFinding} from './findings.js';
import {readArchive,ArchiveError} from './archive.js';

const WORD_NS=['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'];
const REL_NS='http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_NS='http://schemas.openxmlformats.org/package/2006/content-types';
const ODF_NS='urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const ODF_TEXT='urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const DOCX_TYPE='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const ODT_TYPE='application/vnd.oasis.opendocument.text';
const stop=(report,key,values)=>({...report,complete:false,findings:[makeFinding(key,values)]});

function xmlDecoder(chunk) {
  const little=chunk[0]===0xff&&chunk[1]===0xfe || chunk[0]===0x3c&&chunk[1]===0;
  const big=chunk[0]===0xfe&&chunk[1]===0xff || chunk[0]===0&&chunk[1]===0x3c;
  return new TextDecoder(little?'utf-16le':big?'utf-16be':'utf-8',{fatal:true});
}

// Decompression and CRC verification run in the worker. Only bounded XML text
// and filenames reach the main thread, where the browser's XML parser is available.
export async function prepareReport(file,options={}) {
  let report={findings:[],complete:false};
  const header=new Uint8Array(await file.slice(0,1024).arrayBuffer());
  const starts=bytes=>bytes.every((b,i)=>header[i]===b);
  const isZip=starts([0x50,0x4b]);
  if(!isZip && (/%PDF-\d\.\d/.test(new TextDecoder().decode(header)) || /\.pdf$/i.test(file.name))) {
    const {checkPdfReport}=await import('./report-pdf.js');
    return {report:await checkPdfReport(file,report,options)};
  }
  if(starts([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])) {
    report=stop(report,'report.unsupported.warning');
    return {report};
  }
  try {
    const archive=await readArchive(file,{...options,textPattern:/\.(xml|rels)$|(^|\/)mimetype$/i,decoderFactory:xmlDecoder});
    const files=[...archive.files.values()];
    // DOM parsing is synchronous: keep the total text passed to it small.
    if(files.reduce((n,f)=>n+(f.text?.length||0),0)>2*1024*1024) return {report:stop(report,'report.limit.warning')};
    return {report,name:file.name,parts:files.map(({path,text})=>({path,text}))};
  } catch(error) {
    if(!(error instanceof ArchiveError)) throw error;
    if(error.id==='archive.encrypted') return {report:stop(report,'report.encrypted.error')};
    if(error.id==='archive.compression') return {report:stop(report,'report.compression.warning')};
    if(error.id==='archive.limit'||error.id==='archive.timeout') return {report:stop(report,'report.limit.warning.2')};
    return {report:stop(report,'report.unreadable.error')};
  }
}

function parseXml(text) {
  if(text==null || /<!DOCTYPE/i.test(text)) throw new Error('xml');
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length || !doc.documentElement) throw new Error('xml');
  return doc;
}
function resolvePart(source,target) {
  if(!target || /^[a-z][a-z\d+.-]*:/i.test(target) || target.includes('\\')) throw new Error('path');
  const decoded=decodeURIComponent(target.split('#')[0]);
  const segments=decoded.startsWith('/')?[]:source.split('/').slice(0,-1);
  for(const p of decoded.split('/')) {
    if(!p||p==='.') continue;
    if(p==='..') {if(!segments.length) throw new Error('path');segments.pop();}
    else segments.push(p);
  }
  return segments.join('/');
}
function bodyText(element,format) {
  let text='';
  function walk(n) {
    if(n.nodeType===3) {if(format==='ODT') text+=n.nodeValue;return;}
    if(n.nodeType!==1) return;
    if(format==='DOCX' && WORD_NS.includes(n.namespaceURI)) {
      if(n.localName==='t') {text+=n.textContent;return;}
      if(['tab','br','cr'].includes(n.localName)) text+=' ';
    }
    if(format==='ODT' && n.namespaceURI===ODF_TEXT && ['s','tab','line-break'].includes(n.localName)) text+=' ';
    for(const child of n.childNodes) walk(child);
    if((format==='DOCX' && WORD_NS.includes(n.namespaceURI) && n.localName==='p') || (format==='ODT' && n.namespaceURI===ODF_TEXT && ['p','h'].includes(n.localName))) text+='\n';
  }
  walk(element);
  return text.replace(/[\u200b\ufeff]/g,'').trim();
}

export function inspectReport(prepared) {
  const {report,name,parts}=prepared;
  if(!parts) return report;
  const files=new Map(parts.map(p=>[p.path,p]));
  const xmls=new Map();
  let format,body;
  try {
    // ODT encrypts individual parts rather than the ZIP itself. Read its clear
    // manifest before trying to decode the encrypted main document as XML.
    if(files.get('mimetype')?.text?.trim()===ODT_TYPE && files.has('META-INF/manifest.xml')) {
      const manifest=parseXml(files.get('META-INF/manifest.xml').text);
      if(manifest.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:manifest:1.0','encryption-data').length) return stop(report,'report.encrypted.error');
    }
    for(const p of parts) if(/\.(xml|rels)$/i.test(p.path)) xmls.set(p.path,parseXml(p.text));
    if(files.get('mimetype')?.text?.trim()===ODT_TYPE) {
      format='ODT';
      const main=xmls.get('content.xml');
      if(main?.documentElement.namespaceURI!==ODF_NS || main.documentElement.localName!=='document-content') throw new Error('main');
      body=main.getElementsByTagNameNS(ODF_NS,'text')[0];
      const manifest=xmls.get('META-INF/manifest.xml');
      const manifestNS='urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
      if(!manifest || !body) throw new Error('main');
      for(const entry of manifest.getElementsByTagNameNS(manifestNS,'file-entry')) {
        const target=entry.getAttributeNS(manifestNS,'full-path');
        if(target && !target.endsWith('/') && !files.has(resolvePart('',target))) throw new Error('missing');
      }
    } else if(xmls.has('[Content_Types].xml') && xmls.has('_rels/.rels')) {
      format='DOCX';
      const rels=xmls.get('_rels/.rels');
      const office=[...rels.getElementsByTagNameNS(REL_NS,'Relationship')].find(r=>/^(http:\/\/schemas.openxmlformats.org\/officeDocument\/2006|http:\/\/purl.oclc.org\/ooxml\/officeDocument)\/relationships\/officeDocument$/.test(r.getAttribute('Type')));
      if(!office || office.getAttribute('TargetMode')==='External') throw new Error('main');
      const mainPath=resolvePart('',office.getAttribute('Target'));
      const types=xmls.get('[Content_Types].xml');
      const mainType=[...types.getElementsByTagNameNS(TYPE_NS,'Override')].find(t=>resolvePart('',t.getAttribute('PartName'))===mainPath)?.getAttribute('ContentType');
      if(mainType!==DOCX_TYPE) return stop(report,'report.format.warning');
      const main=xmls.get(mainPath);
      if(!main || !WORD_NS.includes(main.documentElement.namespaceURI) || main.documentElement.localName!=='document') throw new Error('main');
      body=main.getElementsByTagNameNS(main.documentElement.namespaceURI,'body')[0];
      if(!body) throw new Error('main');
      for(const [name,doc] of xmls) if(name.endsWith('.rels')) {
        const source=name==='_rels/.rels'?'':name.replace(/(^|\/)\_rels\//,'$1').replace(/\.rels$/,'');
        for(const rel of doc.getElementsByTagNameNS(REL_NS,'Relationship')) {
          if(rel.getAttribute('TargetMode')==='External') continue;
          if(!files.has(resolvePart(source,rel.getAttribute('Target')))) throw new Error('missing');
        }
      }
    } else return stop(report,'report.format.error');
  } catch {
    return stop(report,'report.structure.error');
  }
  report.findings.push(makeFinding('report.readable.pass',{format:format}));
  if(format==='ODT') report.findings.push(makeFinding('report.word-format.warning'));
  if(!name.toLowerCase().endsWith('.'+format.toLowerCase())) report.findings.push(makeFinding('report.extension.warning',{format:format,extension:format.toLowerCase()}));
  const text=bodyText(body,format);
  const count=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('en',{granularity:'word'}).segment(text)].filter(w=>w.isWordLike).length:(text.match(/\S+/g)||[]).length;
  if(!count) {
    const visual=[...body.getElementsByTagName('*')].some(n=>['drawing','pict','object','frame','image','math','oMath'].includes(n.localName)) || parts.some(p=>/^(word\/media|Pictures)\//.test(p.path));
    report.findings.push(visual?makeFinding('report.empty.warning'):makeFinding('report.empty.error'));
  } else report.findings.push(makeFinding('report.words.pass',{count:count.toLocaleString()}));
  report.complete=true;
  report.wordCount=count;
  report.format=format;
  return report;
}
