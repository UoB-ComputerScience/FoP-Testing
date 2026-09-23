import {readArchive,ArchiveError} from './archive.js';
import {getProfile,CHECKER_VERSION} from './profiles.js';

export const STATUS_LABELS={error:'Needs fixing',warning:'Please check',pass:'Checked',info:'Not checked'};
export const normaliseText=text=>text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
export async function sha256(data) {
  const bytes=typeof data==='string'?new TextEncoder().encode(data):data;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
const ignored=path=>path.split('/').some(p=>p==='__MACOSX'||p==='.DS_Store'||p==='Thumbs.db'||p.startsWith('._'));
const finding=(id,status,title,message,paths=[])=>({id,status,title,message,paths});

export function detectRoots(paths) {
  const roots=new Set();
  const endsWithPath=(path,marker)=>path===marker||path.endsWith('/'+marker);
  for(const path of paths) {
    for(const marker of ['nbproject/project.xml','nbproject/project.properties']) if(endsWithPath(path,marker)) roots.add(path.slice(0,-marker.length));
  }
  if(!roots.size) for(const path of paths) if(endsWithPath(path,'build.xml') && !endsWithPath(path,'nbproject/build.xml')) roots.add(path.slice(0,-'build.xml'.length));
  if(!roots.size) for(const path of paths) if(endsWithPath(path,'src/uk/ac/bradford/farmgame/GameEngine.java')) roots.add(path.slice(0,-'src/uk/ac/bradford/farmgame/GameEngine.java'.length));
  return [...roots].sort();
}

// This deliberately recognises simple Java properties only. Unknown expressions
// remain advisory instead of guessing what the student's build would do.
function property(text,key) {
  if(!text) return undefined;
  const line=text.split(/\r?\n/).filter(l=>l.trim().startsWith(`${key}=`)||l.trim().startsWith(`${key} =`)).at(-1);
  return line?.slice(line.indexOf('=')+1).trim();
}

const checks={
  'java.sources': ({files,add})=>{
    const java=[...files.values()].filter(f=>f.path.endsWith('.java'));
    if(!java.length) {add('java.sources','error','No Java source files found','Include your .java source files. Compiled .class files and JARs do not replace source code. Export the complete project.');return;}
    add('java.sources','pass',`${java.length} Java source file${java.length===1?'':'s'} found`,'The ZIP includes source files. Their syntax and functionality have not been tested.');
    const empty=java.filter(f=>f.size===0||(f.text!==null&&!f.text.trim())).map(f=>f.path);
    if(empty.length) add('java.empty','warning','Some Java files are empty','Check whether these files should contain source code before exporting again.',empty);
    const encoding=java.filter(f=>f.invalidEncoding).map(f=>f.path);
    if(encoding.length) add('java.encoding','warning','Some source text is not UTF-8','These files were checked for archive integrity, but their text could not be inspected as UTF-8. Confirm the source encoding in your project.',encoding);
  },
  'archive.extras': ({files,archive,add})=>{
    const paths=[...files.keys()];
    const zips=paths.filter(p=>/\.(zip|7z|rar|tar|gz)$/i.test(p));
    if(zips.length) add('archive.nested','warning','Other archives are included','Check that these are needed resources, rather than older exports or a project that is still zipped. Archives inside this ZIP are not opened.',zips);
    const generated=paths.filter(p=>/(^|\/)(\.git|node_modules|build|dist|target)(\/|$)/.test(p)||/\.(class|log)$/i.test(p));
    if(generated.length) add('archive.generated','warning','Generated or development files are included','These files may be unnecessary for submission. Check your export instructions before removing anything; required libraries may need to stay.',generated);
    const backups=paths.filter(p=>/\.(bak|old|tmp)$|~$/i.test(p));
    if(backups.length) add('archive.backups','warning','Backup or temporary files found','Check that your final version is clear and that older copies are not included accidentally.',backups);
    if(archive.portability.length) add('archive.portability','warning','Some filenames may not work on other computers','These paths use characters or names that Windows may not handle. Check the names before exporting.',archive.portability);
  },
  'netbeans.project': ctx=>{
    const {files,profile,add}=ctx;
    const roots=detectRoots([...files.keys()]);
    if(!roots.length) {add('netbeans.project','warning','NetBeans project folder not recognised','Expected project markers were not found. Check that you exported the complete NetBeans project, rather than only its source folder.');return;}
    if(roots.length>1) {add('netbeans.project','warning','More than one project found','Check which folder contains your final work, then export that project. Project-specific checks were not run because choosing a project would be ambiguous.',roots.map(r=>r||'(ZIP root)'));return;}
    ctx.root=roots[0];
    add('netbeans.project','pass','One project folder recognised',`Project folder: ${ctx.root||'(ZIP root)'}. Renamed folders and outer wrapper folders are accepted.`);
    const missing=profile.expectedProjectFiles.filter(p=>!files.has(ctx.root+p));
    if(missing.length) add('netbeans.files','warning','Some expected NetBeans files are missing','This may be an incomplete export. If you intentionally changed the build setup, confirm that the project opens in the required NetBeans environment.',missing);
    else add('netbeans.files','pass','Expected NetBeans files found','The build file and project metadata are present. The build has not been executed.');
    const config=files.get(ctx.root+'nbproject/project.properties')?.text;
    const src=property(config,'src.dir');
    if(src&&/^[\w./ -]+$/.test(src)&&!src.startsWith('/')&&!src.split('/').includes('..')) {
      const segments=src.split('/').filter(s=>s&&s!=='.');
      const prefix=ctx.root+(segments.length?segments.join('/')+'/':'');
      if(![...files.keys()].some(p=>p.startsWith(prefix))) add('netbeans.source-path','error','Configured source folder is missing',`The project points to “${src}”, but no files were found there. Include the source folder or correct the project configuration.`);
      else add('netbeans.source-path','pass','Configured source folder found',`Source folder: ${src}.`);
    } else add('netbeans.source-path','info','Source-folder setting needs a build check','A simple relative src.dir setting was not found. This checker cannot resolve custom build expressions.');
    const source=property(config,'javac.source'), target=property(config,'javac.target'), release=property(config,'javac.release');
    if(source===profile.javaVersion&&target===profile.javaVersion&&(!release||release===profile.javaVersion)) add('netbeans.java-version','pass',`Project settings specify Java ${profile.javaVersion}`,'This confirms the saved settings only. Compilation has not been checked.');
    else add('netbeans.java-version','warning',`Check the Java ${profile.javaVersion} project settings`,`The coursework specifies JDK ${profile.javaVersion}. Found source=${source||'not set'}, target=${target||'not set'}${release?`, release=${release}`:''}. Check the project in that environment.`);
  },
  'fop.files': ({files,profile,root,add})=>{
    if(root===undefined) {add('fop.files','info','Coursework file checks were not run','A single project folder is needed to check the expected FoP files.');return;}
    const sourceMissing=profile.expectedSourceFiles.filter(p=>!files.has(root+p));
    if(sourceMissing.length) add('fop.source-files','warning','Some starter source paths are missing','Check that these files were exported. New classes and intentional restructuring are allowed; this finding does not determine whether your solution is correct.',sourceMissing);
    else add('fop.source-files','pass','Starter source paths found','All ten original source paths are present. Additional classes are allowed.');
    const assetsMissing=profile.assets.filter(p=>!files.has(root+p));
    if(assetsMissing.length) add('fop.assets','warning','Some original image files are missing','The supplied game uses these images. If you changed the graphics, confirm that your replacement files are included and the game opens correctly.',assetsMissing);
    else add('fop.assets','pass','Original game images found','All twenty original image paths are present. Image contents and custom resource references have not been validated.');
  },
  'fop.starter': async ({files,profile,root,add})=>{
    if(root===undefined) return;
    const originals=profile.expectedSourceFiles;
    const java=[...files.values()].filter(f=>f.path.startsWith(root)&&f.path.endsWith('.java'));
    if(java.length!==originals.length) return;
    for(const path of originals) {
      const text=files.get(root+path)?.text;
      if(text==null||await sha256(normaliseText(text))!==profile.starter[path]) return;
    }
    add('fop.starter','warning','Java files match the starter project','These Java files are unchanged from the supplied starter. Export the project containing your latest work.');
  },
  'submission.report': ({files,add})=>{
    const reports=[...files.keys()].filter(p=>/\.(docx?|pdf)$/i.test(p));
    if(reports.length) add('submission.report','warning','A document is included inside the ZIP','If this is your report, upload it separately as a Word document alongside your software ZIP in Canvas. This checker cannot see your Canvas submission.',reports);
    else add('submission.report','info','Remember your separate Word report','For this coursework, submit the Word report alongside the software ZIP in Canvas. The report is not required inside this archive.');
  },
};

export async function inspectProject(archive,profile) {
  const findings=[];
  const context={archive,profile,files:new Map([...archive.files].filter(([p])=>!ignored(p))),add:(...args)=>findings.push(finding(...args))};
  for(const id of profile.checks) {
    if(!checks[id]) throw new Error(`Unknown check: ${id}`);
    await checks[id](context);
  }
  return findings;
}

export async function checkSubmission(blob,profileId,options={}) {
  const profile=getProfile(profileId);
  const report={checkerVersion:CHECKER_VERSION,profile:{id:profile.id,name:profile.name,version:profile.version},checkedAt:new Date().toISOString(),file:{name:blob.name||'coursework.zip',bytes:blob.size},findings:[],files:[],notChecked:['Compilation','Coursework task correctness','Report quality','Marks','Canvas submission status'],complete:false};
  try {
    const archive=await readArchive(blob,options);
    report.file.sha256=await sha256(await blob.arrayBuffer());
    report.files=[...archive.files.values()].map(({path,size})=>({path,size}));
    report.findings.push(finding('archive.integrity','pass','ZIP contents read and verified',`${archive.files.size} files were decompressed and their checksums checked. Nothing was executed.`));
    report.findings.push(...await inspectProject(archive,profile));
    report.complete=true;
  } catch(error) {
    if(!(error instanceof ArchiveError)) throw error;
    report.findings.push(finding(error.id,'error','Archive check could not be completed',error.message,error.paths));
  }
  return report;
}

export function reportText(report) {
  return ['COURSEWORK SUBMISSION FILE CHECK',`${report.profile.name} (profile ${report.profile.version})`,`Checker ${report.checkerVersion}`,`Date: ${report.checkedAt}`,`File: ${report.file.name}`,`Bytes: ${report.file.bytes}`,`SHA-256: ${report.file.sha256||'Not calculated because archive checks stopped'}`,'',...report.findings.flatMap(f=>[`${STATUS_LABELS[f.status]}: ${f.title}`,f.message,...f.paths.map(p=>`  ${p}`),'']),'Not checked: '+report.notChecked.join(', '),'This is not a mark or a submission receipt. Submit the same checked ZIP through Canvas.',''].join('\n');
}
