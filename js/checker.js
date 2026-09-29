import {makeFinding} from './findings.js';
import {readArchive,ArchiveError} from './archive.js';
import {getProfile} from './profiles.js';

export const normaliseText=text=>text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
export async function sha256(data) {
  const bytes=typeof data==='string'?new TextEncoder().encode(data):data;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
const ignored=path=>path.split('/').some(p=>p==='__MACOSX'||p==='.DS_Store'||p==='Thumbs.db'||p.startsWith('._'));

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
    if(!java.length) {add('java.sources.error');return;}
    add('java.sources.pass',{count:java.length,plural:java.length===1?'':'s'});
    const empty=java.filter(f=>f.size===0||(f.text!==null&&!f.text.trim())).map(f=>f.path);
    if(empty.length) add('java.empty.warning',{},empty);
    const encoding=java.filter(f=>f.invalidEncoding).map(f=>f.path);
    if(encoding.length) add('java.encoding.warning',{},encoding);
  },
  'archive.extras': ({files,archive,add})=>{
    const paths=[...files.keys()];
    const zips=paths.filter(p=>/\.(zip|7z|rar|tar|gz)$/i.test(p));
    if(zips.length) add('archive.nested.warning',{},zips);
    const generated=paths.filter(p=>/(^|\/)(\.git|node_modules|target)(\/|$)/.test(p)||/\.log$/i.test(p));
    if(generated.length) add('archive.generated.warning',{},generated);
    const backups=paths.filter(p=>/\.(bak|old|tmp)$|~$/i.test(p));
    if(backups.length) add('archive.backups.warning',{},backups);
    if(archive.portability.length) add('archive.portability.warning',{},archive.portability);
  },
  'netbeans.project': ctx=>{
    const {files,profile,add}=ctx;
    const roots=detectRoots([...files.keys()]);
    if(!roots.length) {add('netbeans.project.warning');return;}
    if(roots.length>1) {add('netbeans.project.warning.2',{},roots.map(r=>r||'(ZIP root)'));return;}
    ctx.root=roots[0];
    const missing=profile.expectedProjectFiles.filter(p=>!files.has(ctx.root+p));
    if(missing.length) add('netbeans.files.warning',{},missing);
    const config=files.get(ctx.root+'nbproject/project.properties')?.text;
    const src=property(config,'src.dir');
    if(src&&/^[\w./ -]+$/.test(src)&&!src.startsWith('/')&&!src.split('/').includes('..')) {
      const segments=src.split('/').filter(s=>s&&s!=='.');
      const prefix=ctx.root+(segments.length?segments.join('/')+'/':'');
      if(![...files.keys()].some(p=>p.startsWith(prefix)&&p.endsWith('.java'))) add('netbeans.source-path.error',{folder:src});
      else if(!missing.length) add('netbeans.project.pass');
    } else add('netbeans.source-path.info');
    const source=property(config,'javac.source'), target=property(config,'javac.target'), release=property(config,'javac.release');
    if(source===profile.javaVersion&&target===profile.javaVersion&&(!release||release===profile.javaVersion)) add('netbeans.java-version.pass',{version:profile.javaVersion});
    else add('netbeans.java-version.warning',{version:profile.javaVersion,source:source||'not set',target:target||'not set',releaseSetting:release?`, release=${release}`:''});
  },
  'fop.files': ({files,profile,root,add})=>{
    if(root===undefined) {add('fop.files.info');return;}
    const sourceMissing=profile.expectedSourceFiles.filter(p=>!files.has(root+p));
    if(sourceMissing.length) add('fop.source-files.warning',{},sourceMissing);
    else add('fop.source-files.pass');
    const assetsMissing=profile.assets.filter(p=>!files.has(root+p));
    if(assetsMissing.length) add('fop.assets.warning',{},assetsMissing);
    else add('fop.assets.pass');
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
    add('fop.starter.error');
  },
  'submission.report': ({files,add})=>{
    const reports=[...files.keys()].filter(p=>/\.(docx?|odt|pdf)$/i.test(p));
    if(reports.length) add('submission.report.warning',{},reports);
  },
};

export async function inspectProject(archive,profile) {
  const findings=[];
  const context={archive,profile,files:new Map([...archive.files].filter(([p])=>!ignored(p))),add:(...args)=>findings.push(makeFinding(...args))};
  for(const id of profile.checks) {
    if(!checks[id]) throw new Error(`Unknown check: ${id}`);
    await checks[id](context);
  }
  return findings;
}

export async function checkSubmission(blob,profileId,options={}) {
  const profile=getProfile(profileId);
  const report={findings:[],files:[],complete:false};
  try {
    const archive=await readArchive(blob,options);
    report.files=[...archive.files.values()].map(({path,size})=>({path,size}));
    report.findings.push(makeFinding('archive.integrity.pass',{count:archive.files.size}));
    if(blob.name && !/\.zip$/i.test(blob.name)) report.findings.push(makeFinding('submission.extension.warning'));
    report.findings.push(...await inspectProject(archive,profile));
    report.complete=true;
  } catch(error) {
    if(!(error instanceof ArchiveError)) throw error;
    const status=['archive.limit','archive.timeout','archive.format'].includes(error.id)?'warning':'error';
    report.findings.push(error.finding||{id:error.id,status,title:makeFinding('archive.unreadable.error').title,message:error.message,paths:error.paths});
  }
  return report;
}
