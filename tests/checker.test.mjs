import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertExpected} from './expectations.js';
import {ZipWriter,Uint8ArrayWriter,Uint8ArrayReader,TextReader} from '../checker/vendor/zip.js';
import {checkSubmission,detectRoots,inspectProject,normaliseText,sha256} from '../checker/js/checker.js';
import {inspectMetadata,ArchiveError} from '../checker/js/archive.js';
import {getProfile,LIMITS} from '../checker/js/profiles.js';

async function zip(entries,options={}) {
  const writer=new Uint8ArrayWriter();
  const zip=new ZipWriter(writer,{useWebWorkers:false,level:0,...options});
  for(const [name,content] of entries)await zip.add(name,content instanceof Uint8Array?new Uint8ArrayReader(content):new TextReader(content));
  return new File([await zip.close()],'coursework.zip',{type:'application/zip'});
}
const has=(report,id,status)=>report.findings.some(f=>f.id===id&&(!status||f.status===status));
const entriesFor=root=>[
  [root+'nbproject/project.xml','<project/>'],
  [root+'nbproject/project.properties','src.dir=src\njavac.source=24\njavac.target=24\n'],
  [root+'nbproject/build-impl.xml','<project/>'],
  [root+'build.xml','<project/>'],
  [root+'src/Main.java','class Main {}'],
];
const meta=(filename,extra={})=>({filename,uncompressedSize:1,directory:false,encrypted:false,symlink:false,...extra});

test('generic Java ZIP checks file packaging without grading',async()=>{
  const result=await checkSubmission(await zip([['project/src/Main.java','class Main {}']]),'java-general');
  assert.equal(result.complete,true);assert.ok(has(result,'java.sources','pass'));assert.equal(result.findings.some(f=>f.status==='error'),false);
  assert.deepEqual(Object.keys(result).sort(),['complete','files','findings']);
});
test('compiled files alone do not count as source',async()=>{
  const result=await checkSubmission(await zip([['dist/Main.class','binary']]),'java-general');
  assert.ok(has(result,'java.sources','error'));
});
test('invalid and truncated ZIPs stop further checks',async()=>{
  const good=await zip([['Main.java','class Main {}']]);
  for(const file of [new File(['not a zip'],'bad.zip'),new File([(await good.arrayBuffer()).slice(0,30)],'truncated.zip')]){
    const result=await checkSubmission(file,'java-general');assert.equal(result.complete,false);assert.equal(result.files.length,0);assert.equal(has(result,'java.sources'),false);
  }
});
test('CRC corruption is detected, not presented as a completed scan',async()=>{
  const original=await zip([['Main.java','unique plain source']]);
  const bytes=new Uint8Array(await original.arrayBuffer());
  const marker=Buffer.from(bytes).indexOf('unique plain source');assert.ok(marker>=0);bytes[marker]^=1;
  const result=await checkSubmission(new File([bytes],'corrupt.zip'),'java-general');assert.equal(result.complete,false);assert.equal(has(result,'archive.integrity','pass'),false);
});
test('empty and encrypted ZIPs explain why checking stopped',async()=>{
  const empty=await checkSubmission(await zip([]),'java-general');assert.ok(has(empty,'archive.empty','error'));
  const encrypted=await checkSubmission(await zip([['Main.java','class Main {}']],{password:'test-password'}),'java-general');assert.ok(has(encrypted,'archive.encrypted','error'));
});
test('wrappers and rootless exports resolve to the correct project',async()=>{
  for(const root of ['', 'Renamed-Project/', 'wrapper/another/FoPCW2025student/']){
    const result=await checkSubmission(await zip(entriesFor(root)),'fop-2025-26');assert.ok(has(result,'netbeans.project','pass'));assert.equal(has(result,'netbeans.source-path','pass'),false);assert.ok(has(result,'netbeans.java-version','pass'));
  }
});
test('two projects are ambiguous and coursework path checks are not guessed',async()=>{
  const result=await checkSubmission(await zip([...entriesFor('one/'),...entriesFor('one/backup/')]),'fop-2025-26');
  assert.ok(has(result,'netbeans.project','warning'));assert.ok(has(result,'fop.files','info'));assert.equal(has(result,'fop.assets'),false);
});
test('missing src directory is identified from the configuration',async()=>{
  const entries=entriesFor('').filter(([p])=>!p.startsWith('src/'));entries.push(['wrong/Main.java','class Main {}']);
  const result=await checkSubmission(await zip(entries),'fop-2025-26');assert.ok(has(result,'netbeans.source-path','error'));
});
test('custom source expressions are not guessed',async()=>{
  const entries=entriesFor('');entries[1][1]='src.dir=${project.source}\njavac.source=24\njavac.target=24';
  const result=await checkSubmission(await zip(entries),'fop-2025-26');assert.ok(has(result,'netbeans.source-path','info'));assert.equal(has(result,'netbeans.source-path','error'),false);
});
test('valid dot and repeated-slash source settings do not create false errors',async()=>{
  for(const source of ['./src','.','src//','./src/']) {
    const entries=entriesFor('project/');entries[1][1]=`src.dir=${source}\njavac.source=24\njavac.target=24`;
    const result=await checkSubmission(await zip(entries),'fop-2025-26');assert.ok(has(result,'netbeans.project','pass'),source);assert.equal(has(result,'netbeans.source-path','error'),false);
  }
});
test('extra classes are allowed without the obsolete report reminder',async()=>{
  const result=await checkSubmission(await zip([...entriesFor(''),['src/NPC.java','class NPC {}'],['assets/custom.png','custom']]),'fop-2025-26');
  assert.equal(has(result,'submission.report'),false);assert.equal(result.findings.some(f=>f.status==='error'),false);
});
test('a report inside the ZIP is advisory, not an automatic rejection',async()=>{
  const result=await checkSubmission(await zip([...entriesFor(''),['report.docx','document']]),'fop-2025-26');assert.ok(has(result,'submission.report','warning'));assert.equal(result.findings.some(f=>f.status==='error'),false);
});
test('an incomplete export still receives specific expected-file feedback',async()=>{
  const result=await checkSubmission(await zip(entriesFor('').filter(([p])=>p!=='build.xml')),'fop-2025-26');
  assert.equal(has(result,'netbeans.project','pass'),false);assert.ok(has(result,'netbeans.files','warning'));assert.ok(has(result,'fop.assets','warning'));
});
test('non-UTF-8 source is flagged without claiming the ZIP is broken',async()=>{
  const result=await checkSubmission(await zip([['Main.java',new Uint8Array([0xff,0xfe,0x80])]]),'java-general');assert.equal(result.complete,true);assert.ok(has(result,'java.encoding','warning'));
});
test('metadata safety rejects traversal, duplicate paths, links and file-folder clashes',()=>{
  for(const path of ['../Main.java','a/../Main.java','/Main.java','C:\\Main.java','\\\\host\\Main.java','./Main.java','a//b','a\u0000b'])assert.throws(()=>inspectMetadata([meta(path)]),ArchiveError);
  for(const pair of [['a.java','a.java'],['A.java','a.java'],['a/b.java','a\\b.java'],['a','a/b.java']])assert.throws(()=>inspectMetadata(pair.map(p=>meta(p))),ArchiveError);
  assert.throws(()=>inspectMetadata([meta('link',{symlink:true})]),/symbolic links/);
});
test('checker limits apply before decompression and explain incomplete checking',async()=>{
  assert.throws(()=>inspectMetadata([meta('big',{uncompressedSize:LIMITS.entryBytes+1})]),ArchiveError);
  const file=await zip([['Main.java','class Main {}']]);
  const result=await checkSubmission(file,'java-general',{limits:{...LIMITS,archiveBytes:1}});assert.ok(has(result,'archive.limit','warning'));assert.equal(result.complete,false);
});
test('portability warnings preserve filenames as text',()=>{
  const result=inspectMetadata([meta('CON.txt'),meta('a/trailing. '),meta('<b>.java')]);assert.equal(result.portability.length,3);
});
test('metadata and backups do not become the detected project',async()=>{
  const result=await checkSubmission(await zip([...entriesFor('project/'),['__MACOSX/._build.xml','metadata'],['.DS_Store','metadata']]),'fop-2025-26');assert.ok(has(result,'netbeans.project','pass'));
});
test('project marker matching requires a complete path component',()=>{
  assert.deepEqual(detectRoots(['notbuild.xml','x/notnbproject/project.xml']),[]);
});
test('starter comparison tolerates BOM and line endings but notices code edits',async()=>{
  const path='src/Main.java';const starter='class Main {\n}\n';
  const profile={...getProfile('fop-2025-26'),expectedSourceFiles:[path],starter:{[path]:await sha256(starter)},checks:['netbeans.project','fop.starter']};
  const records=new Map(entriesFor('').map(([path,text])=>[path,{path,text,size:text.length}]));records.get(path).text='\uFEFFclass Main {\r\n}\r\n';
  let result=await inspectProject({files:records,portability:[]},profile);assert.ok(result.some(f=>f.id==='fop.starter'&&f.status==='error'));
  records.get(path).text='class Main { int changed; }';result=await inspectProject({files:records,portability:[]},profile);assert.equal(result.some(f=>f.id==='fop.starter'),false);
  assert.equal(normaliseText('\uFEFFx\r\ny\rz'),'x\ny\nz');
});

test('readable ZIP filename is advisory, broken ZIP is critical',async()=>{
  const good=await zip([['Main.java','class Main {}']]);
  const renamed=await checkSubmission(new File([good],'project'),'java-general');
  assert.equal(renamed.complete,true);assert.ok(has(renamed,'submission.extension','warning'));
  const broken=await checkSubmission(new File(['broken archive'],'project.zip'),'java-general');
  assert.ok(has(broken,'archive.not-zip','error'));
});


test('combined NetBeans pass requires build files and Java in the configured folder',async()=>{
  const result=await checkSubmission(await zip(entriesFor('project/')),'fop-2025-26');
  assert.equal(result.findings.filter(f=>f.status==='pass'&&['netbeans.project','netbeans.files','netbeans.source-path'].includes(f.id)).length,1);
  const entries=entriesFor('project/').filter(([p])=>!p.endsWith('Main.java'));
  entries.push(['project/src/notes.txt','Notes'],['project/other/Main.java','class Main {}']);
  const misplaced=await checkSubmission(await zip(entries),'fop-2025-26');
  assert.ok(has(misplaced,'java.sources','pass'));
  assert.ok(has(misplaced,'netbeans.source-path','error'));
  assert.equal(has(misplaced,'netbeans.project','pass'),false);
});
test('compiled output alongside source creates no extra finding',async()=>{
  const baseline=await checkSubmission(await zip(entriesFor('')),'fop-2025-26');
  const result=await checkSubmission(await zip([...entriesFor(''),['build/Main.class','compiled'],['dist/game.jar','jar']]),'fop-2025-26');
  // Archive integrity text reports the file count; compare check identities/statuses.
  const findings=r=>r.findings.map(f=>({id:f.id,status:f.status,paths:f.paths}));
  assert.equal(result.complete,baseline.complete);
  assert.deepEqual(findings(result),findings(baseline));
  assert.equal(result.findings.some(f=>f.status==='error'),false);
});
test('RAR and 7z signatures are advisory regardless of filename',async()=>{
  const {readFile}=await import('node:fs/promises');
  const rar=await readFile(new URL('../TestFiles/Generated/NetBeans-exports/09-project-export.rar',import.meta.url));
  // This synthetic 7z header tests format recognition only, not archive validity.
  const sevenZip=new Uint8Array([0x37,0x7a,0xbc,0xaf,0x27,0x1c,0,4]);
  for(const [bytes,name] of [[rar,'project.rar'],[rar,'project.zip'],[sevenZip,'project.7z'],[sevenZip,'project.zip']]){
    const result=await checkSubmission(new File([bytes],name),'fop-2025-26');
    assert.ok(has(result,'archive.format','warning'));
    assert.equal(result.complete,false);
    assert.equal(result.findings.length,1);
    assert.equal(has(result,'archive.integrity'),false);
  }
});
test('every check has maintainer reasoning without exposing it in student results',async()=>{
  const base=new URL('../checker/',import.meta.url).href;
  const {makeFinding}=await import(base+'js/findings.js');
  const seen=new Set();
  for(const file of ['project','archive','report']){
    const {default:definitions}=await import(base+'checks/'+file+'.js');
    for(const [key,definition] of Object.entries(definitions)){
      assert(!seen.has(key));seen.add(key);
      assert(definition.purpose.length>10&&definition.method.length>10,key);
      const values=Object.fromEntries([...(`${definition.title} ${definition.message}`).matchAll(/\{(\w+)\}/g)].map(m=>[m[1],'example']));
      const finding=makeFinding(key,values);
      assert.equal('purpose' in finding,false);assert.equal('method' in finding,false);
    }
  }
});


test('individual Java and other non-ZIP files receive a direct ZIP instruction',async()=>{
  for(const name of ['GameEngine.java','notes.txt','build.xml','misnamed.zip']){
    const result=await checkSubmission(new File(['public class GameEngine {}'],name),'fop-2025-26');
    assert.ok(has(result,'archive.not-zip','error'));
    assert.equal(result.findings[0].message,'Submit a .zip file of your complete NetBeans project.');
    assert.equal(result.complete,false);
  }
});
test('truncated ZIP retains the damaged-archive result',async()=>{
  const original=await zip([['Main.java','class Main {}']]);
  const result=await checkSubmission(new File([(await original.arrayBuffer()).slice(0,-12)],'project.zip'),'fop-2025-26');
  assert.ok(has(result,'archive.unreadable','error'));
  assert.equal(has(result,'archive.not-zip'),false);
});
test('ZIP contents are checked despite a misleading Java filename',async()=>{
  const original=await zip([['Main.java','class Main {}']]);
  const result=await checkSubmission(new File([original],'Main.java'),'java-general');
  assert.equal(result.complete,true);
  assert.ok(has(result,'archive.integrity','pass'));
  assert.ok(has(result,'submission.extension','warning'));
});

test('duplicate filenames and unsupported compression have specific results',async()=>{
  const {readFile}=await import('node:fs/promises');
  const cases=[['12-duplicate-filename.zip','archive.duplicate','error'],['10-bzip2-compression.zip','archive.compression','warning'],['11-lzma-compression.zip','archive.compression','warning'],['15-parent-directory-path.zip','archive.paths','error']];
  for(const [name,id,status] of cases){
    const bytes=await readFile(new URL('../TestFiles/Generated/Archive-errors/'+name,import.meta.url));
    const result=await checkSubmission(new File([bytes],name),'fop-2025-26');
    assert.ok(has(result,id,status),name);
    assert.equal(result.complete,false);
    assert.equal(has(result,'archive.unreadable'),false);
  }
});

const fixtures=JSON.parse(await readFile(new URL('./fixtures.json',import.meta.url),'utf8'));
for(const fixture of fixtures.filter(c=>c.folder!=='Reports')) {
  test('generated '+fixture.folder+'/'+fixture.file,async()=>{
    const url=new URL('../TestFiles/Generated/'+encodeURIComponent(fixture.folder)+'/'+encodeURIComponent(fixture.file),import.meta.url);
    const report=await checkSubmission(new File([await readFile(url)],fixture.file),'fop-2025-26');
    assertExpected(report,fixture);
  });
}

test('full expectations reject missing, extra, duplicate and reclassified findings',()=>{
  const fixture=fixtures.find(c=>c.folder==='NetBeans-exports'&&c.file==='01-complete-project.zip');
  const findings=fixture.expected_checks.split(';').map(s=>{const [id,status]=s.trim().split(':');return {id,status};});
  assert.equal(findings.length,6);
  const check=values=>assertExpected({complete:true,findings:values},fixture);
  check([...findings].reverse());
  for(const changed of [findings.slice(1),[...findings,{id:'unexpected',status:'pass'}],
    [...findings,findings[0]],[{...findings[0],status:'info'},...findings.slice(1)]]) {
    assert.throws(()=>check(changed),/Findings differ/);
  }
});
