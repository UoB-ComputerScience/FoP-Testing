import {prepareReport,inspectReport} from '/checker/js/report.js';
import {checkSubmission} from '/checker/js/checker.js';
import {ZipWriter,Uint8ArrayWriter,TextReader,Uint8ArrayReader} from '/checker/vendor/zip.js';
const list=document.getElementById('results');let passed=0,failed=0;
function assert(value,message='Unexpected result'){if(!value)throw new Error(message);}
async function test(name,fn){const li=document.createElement('li');try{await fn();passed++;li.textContent='PASS '+name;}catch(e){failed++;li.textContent='FAIL '+name+': '+e.message;}list.append(li);}
const has=(r,id,status)=>r.findings.some(f=>f.id===id&&(!status||f.status===status));
const check=async f=>inspectReport(await prepareReport(f));
async function zip(parts,name='report.docx',options={}){const w=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false,level:0,...options});for(const [n,v] of Object.entries(parts))await w.add(n,v instanceof Uint8Array?new Uint8ArrayReader(v):new TextReader(v));return new File([await w.close()],name);}
const relNS='http://schemas.openxmlformats.org/package/2006/relationships';
const wordNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function docx(body='<w:p><w:r><w:t>Hello world report</w:t></w:r></w:p>',main='word/document.xml'){
  return {'[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${main}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels':`<Relationships xmlns="${relNS}"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${main}"/></Relationships>`,
    [main]:`<w:document xmlns:w="${wordNS}"><w:body>${body}</w:body></w:document>`};
}
function odt(body='<text:p>Hello<text:s/>world report</text:p>') {return {
  mimetype:'application/vnd.oasis.opendocument.text',
  'content.xml':`<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  'META-INF/manifest.xml':'<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>'};}
// The local server discovers private reports without keeping student paths in Git.
try {
  const response=await fetch('/tests/real-reports.json');
  assert(response.ok,'Run python TestFiles/Tools/serve.py to load private reports.');
  const cases=await response.json();
  assert(cases.length>0,'No DOCX/ODT reports found in TestFiles/Real/.');
  for(const c of cases)await test(c.file,async()=>{const response=await fetch(c.url);assert(response.ok,'Private report not found');const r=await check(new File([await response.arrayBuffer()],c.file));assert(r.complete,JSON.stringify(r.findings));assert(!r.findings.some(f=>f.status==='error'),JSON.stringify(r.findings));assert(r.wordCount>0);});
} catch(error) {
  await test('Private report fixtures available',()=>{throw error;});
}
await test('DOCX alternate main part and arbitrary filename',async()=>{const r=await check(await zip(docx(undefined,'word/document2.xml'),'my notes.docx'));assert(r.complete&&r.wordCount===3);});
await test('DOCX split formatting does not split words',async()=>{const r=await check(await zip(docx('<w:p><w:r><w:t>Hel</w:t></w:r><w:r><w:t>lo world</w:t></w:r></w:p>')));assert(r.wordCount===2);});
await test('ODT is readable with advisory to save as Word',async()=>{const r=await check(await zip(odt(),'report.odt'));assert(r.complete&&r.wordCount===3&&has(r,'report.word-format','warning'));});
await test('Missing filename extension does not hide readable document',async()=>{const r=await check(await zip(docx(),'report'));assert(r.complete&&has(r,'report.extension','warning'));});
await test('Misnamed ODT detected from contents',async()=>{const r=await check(await zip(odt(),'report.docx'));assert(r.complete&&r.format==='ODT'&&has(r,'report.extension'));});
await test('Empty report',async()=>{const r=await check(await zip(docx('<w:p/>')));assert(r.complete&&has(r,'report.empty','error'));});
await test('Image-only report is advisory',async()=>{const r=await check(await zip({...docx('<w:p><w:r><w:drawing/></w:r></w:p>'),'word/media/image.png':new Uint8Array([1,2,3])}));assert(r.complete&&has(r,'report.empty','warning'));});
await test('Truncated report',async()=>{const f=await zip(docx());const r=await check(new File([(await f.arrayBuffer()).slice(0,-12)],'report.docx'));assert(!r.complete&&has(r,'report.unreadable'));});
await test('Bad CRC stops document inspection',async()=>{const f=await zip(docx());const b=new Uint8Array(await f.arrayBuffer());const marker=new TextEncoder().encode('Hello world report');let i=b.findIndex((_,i)=>marker.every((x,j)=>b[i+j]===x));assert(i>=0);b[i]^=1;const r=await check(new File([b],'report.docx'));assert(!r.complete);});
await test('Malformed XML',async()=>{const r=await check(await zip({...docx(),'word/document.xml':'<w:document>'}));assert(!r.complete&&has(r,'report.structure'));});
await test('Missing main part',async()=>{const p=docx();delete p['word/document.xml'];const r=await check(await zip(p));assert(!r.complete);});
await test('Missing embedded part',async()=>{const p=docx();p['word/_rels/document.xml.rels']=`<Relationships xmlns="${relNS}"><Relationship Id="r2" Type="image" Target="media/missing.png"/></Relationships>`;assert(!(await check(await zip(p))).complete);});
await test('External hyperlink is allowed without fetching it',async()=>{const p=docx();p['word/_rels/document.xml.rels']=`<Relationships xmlns="${relNS}"><Relationship Id="r2" Type="hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>`;assert((await check(await zip(p))).complete);});
await test('UTF-16 XML is readable',async()=>{const p=docx();const s=p['word/document.xml'];const b=new Uint8Array(2+s.length*2);b[0]=255;b[1]=254;for(let i=0;i<s.length;i++){b[2+i*2]=s.charCodeAt(i)&255;b[3+i*2]=s.charCodeAt(i)>>8;}p['word/document.xml']=b;const r=await check(await zip(p));assert(r.complete&&r.wordCount===3);});
await test('Encrypted ZIP report',async()=>{const r=await check(await zip(docx(),'report.docx',{password:'test-password'}));assert(!r.complete&&has(r,'report.encrypted'));});
await test('Password-protected ODT',async()=>{const p=odt();p['content.xml']=new Uint8Array([0xff,0xff]);p['META-INF/manifest.xml']=p['META-INF/manifest.xml'].replace('manifest:media-type="text/xml"/>','manifest:media-type="text/xml"><manifest:encryption-data/></manifest:file-entry>');const r=await check(await zip(p,'report.odt'));assert(!r.complete&&has(r,'report.encrypted'),JSON.stringify(r.findings));});
await test('Header-only PDF is broken; older Word remains unsupported',async()=>{const pdf=await check(new File(['%PDF-1.7\n'],'report.pdf'));assert(!pdf.complete&&has(pdf,'report.pdf-unreadable','error'));const doc=await check(new File([new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])],'report.doc'));assert(!doc.complete&&has(doc,'report.unsupported','warning'));});
await test('Plain text renamed DOCX is rejected',async()=>assert(!(await check(new File(['not a document'],'report.docx'))).complete));
await test('Ordinary software ZIP is not a report',async()=>assert(!(await check(await zip({'Main.java':'class Main {}'}))).complete));
await test('XML entity declarations are rejected without expansion',async()=>{const p=docx();p['word/document.xml']='<!DOCTYPE a [<!ENTITY x "expanded">]>'+p['word/document.xml'];assert(!(await check(await zip(p))).complete);});
await test('Old separate-report reminder removed',async()=>{const r=await checkSubmission(await zip({'Main.java':'class Main {}'},'project.zip'),'fop-2025-26');assert(!has(r,'submission.report'));});
document.getElementById('status').textContent=`${passed} passed; ${failed} failed`;
