import {getProfile,LIMITS} from './profiles.js';
import {inspectReport} from './report.js';
import {reportText,STATUS_LABELS} from './checker.js';

const labels=STATUS_LABELS;
const symbols={error:'!',warning:'!',pass:'✓',info:'—'};
function node(tag,text,className) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function displaySize(bytes) {return bytes<1024?`${bytes} bytes`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KiB`:`${(bytes/1024/1024).toFixed(1)} MiB`;}

function createChecker(prefix,kind) {
const $=id=>document.getElementById(prefix+id);
const isReport=kind==='report';
const resultsPanel=$('results-title').closest('.results-panel');
let worker=null,report=null,deadline=null,profile=null;
function stop() {if(worker)worker.terminate();worker=null;clearTimeout(deadline);$('cancel').hidden=true;resultsPanel.setAttribute('aria-busy','false');}
function clearResults() {report=null;$('findings').replaceChildren();$('inventory').hidden=true;$('file-list').replaceChildren();$('download').hidden=true;}
function showProblem(title,message) {stop();clearResults();$('empty-state').hidden=true;$('results-title').textContent=title;$('status').textContent=message;}
function findingCard(f,grouped=false) {
  const card=node('article',undefined,`finding ${f.status}`);
  if(!grouped)card.append(node('div',`${symbols[f.status]} ${labels[f.status]}`,'finding-label'));
  card.append(node(grouped?'h4':'h3',f.title),node('p',f.message));
  if(f.paths.length) {
    const details=node('details',undefined,'finding-paths');details.append(node('summary',`Show ${f.paths.length} file path${f.paths.length===1?'':'s'}`));
    const list=node('ul');for(const path of f.paths.slice(0,15))list.append(node('li',path));details.append(list);
    if(f.paths.length>15)details.append(node('p',`${f.paths.length-15} more paths are listed in the downloaded results.`));
    card.append(details);
  }
  return card;
}
function showReport(value,text) {
  stop();report={value,text};$('empty-state').hidden=true;
  const issues=value.findings.filter(f=>f.status==='error'||f.status==='warning').sort((a,b)=>(a.status==='error'?0:1)-(b.status==='error'?0:1));
  const errors=issues.filter(f=>f.status==='error').length;
  const warnings=issues.length-errors;
  $('results-title').textContent=!value.complete?'Check incomplete':errors?'Files need attention':warnings?'Check these items':'No file issues found';
  const counts=[errors?`${errors} critical`:null,warnings?`${warnings} advisory`:null].filter(Boolean).join(' · ');
  $('status').textContent=!value.complete?`${counts}. Further checks were not run.`:issues.length?counts:isReport?'Report file checks complete.':'File checks complete. This does not confirm that your code works.';
  if(isReport && value.wordCount>0) $('status').textContent+=`${issues.length&&value.complete?' · ':' '}Approximately ${value.wordCount.toLocaleString()} words in the main document.`;
  $('findings').replaceChildren();
  for(const status of ['error','warning']) {
    const group=issues.filter(f=>f.status===status);
    if(!group.length)continue;
    const section=node('section',undefined,'issue-group');
    section.append(node('h3',status==='error'?'Critical — fix before submitting':'Advisory — please review'));
    for(const f of group)section.append(findingCard(f,true));
    $('findings').append(section);
  }
  const notes=value.findings.filter(f=>f.status==='info');
  if(notes.length){const details=node('details',undefined,'result-details');details.append(node('summary',`Notes (${notes.length})`));for(const f of notes)details.append(findingCard(f));$('findings').append(details);}
  const passes=value.findings.filter(f=>f.status==='pass');
  if(passes.length){const details=node('details',undefined,'result-details');details.append(node('summary',`Passed checks (${passes.length})`));for(const f of passes)details.append(findingCard(f));$('findings').append(details);}
  $('download').hidden=false;
  if(!isReport && value.files.length){$('inventory').hidden=false;$('inventory').open=false;$('file-count').textContent=`(${value.files.length})`;$('file-list').replaceChildren();for(const f of value.files)$('file-list').append(node('li',`${f.path} · ${displaySize(f.size)}`));}
}
function run(file) {
  if(!profile)return;
  stop();clearResults();
  $('selected-file').hidden=false;$('filename').textContent=file.name;$('file-details').textContent=displaySize(file.size);
  $('empty-state').hidden=true;
  if(file.size>LIMITS.archiveBytes){showProblem('File too large','Choose a file up to 25 MiB.');return;}
  if(!globalThis.Worker||!globalThis.crypto?.subtle){showProblem('This browser cannot run the checker','Open the checker in an up-to-date browser using the link provided by your module team.');return;}
  $('results-title').textContent='Checking…';$('status').textContent=isReport?'Reading your report.':'Reading your ZIP file.';$('cancel').hidden=false;resultsPanel.setAttribute('aria-busy','true');
  let current;
  try {current=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker=current;} catch {showProblem('The checker could not start','Reload the page or try another current browser. No file was uploaded.');return;}
  deadline=setTimeout(()=>{if(worker===current)showProblem('The check was stopped','Checking exceeded 30 seconds. Try a smaller export or ask your module team for help.');},LIMITS.milliseconds);
  current.onmessage=event=>{
    if(worker!==current)return;
    if(event.data.type==='progress'){$('status').textContent=`Reading file ${event.data.completed} of ${event.data.total}…`;return;}
    if(event.data.type==='report-package') {
      try {const value=inspectReport(event.data.prepared);showReport(value,reportText(value));}
      catch {showProblem('The report check did not finish','Open your report in its editor to check it, or try saving a fresh copy.');}
    }
    else if(event.data.type==='result')showReport(event.data.report,event.data.text);
    else showProblem('The checker encountered a problem','The check did not finish. Reload the page or ask your module team for help. No file was uploaded.');
  };
  current.onerror=()=>{if(worker===current)showProblem('The checker encountered a problem','The check did not finish. Reload the page or ask your module team for help. No file was uploaded.');};
  current.postMessage({file,profileId:profile.id,kind});
}
$('file').addEventListener('change',event=>{if(event.target.files.length)run(event.target.files[0]);event.target.value='';});
$('cancel').addEventListener('click',()=>{showProblem('Check cancelled','Choose another file, or select the same file to check it again.');});
const drop=$('drop-zone');
for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();if(profile)drop.classList.add('drag-over');});
for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('drag-over');});
drop.addEventListener('drop',event=>{if(!profile)return;const files=event.dataTransfer.files;if(files.length!==1){showProblem('Choose one file at a time',isReport?'Drop the report you want to check.':'Drop the coursework ZIP you want to check.');return;}run(files[0]);});
$('download').addEventListener('click',()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([report.text],{type:'text/plain;charset=utf-8'}));
  const link=node('a');link.href=url;link.download=`${report.value.file.name.replace(/\.zip$/i,'')}-file-check.txt`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
try {profile=getProfile(document.body.dataset.coursework);} catch {
  $('file').disabled=true;drop.setAttribute('aria-disabled','true');
  showProblem('Coursework checker unavailable','Ask your module team for the correct checker link.');
}
}
createChecker('','zip');
createChecker('report-','report');
