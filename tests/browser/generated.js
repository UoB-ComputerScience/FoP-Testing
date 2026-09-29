import {inspectReport} from '/checker/js/report.js';
import {assertExpected} from '../expectations.js';
const status=document.getElementById('status'),list=document.getElementById('results');
function check(file,kind) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker('/checker/js/worker.js',{type:'module'});
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Timed out'));},35000);
    const finish=()=>{clearTimeout(timer);worker.terminate();};
    worker.onerror=e=>{finish();reject(new Error(e.message));};
    worker.onmessage=e=>{
      if(e.data.type==='progress')return;
      finish();
      try {
        if(e.data.type==='report-package')resolve(inspectReport(e.data.prepared));
        else if(e.data.type==='result')resolve(e.data.report);
        else reject(new Error(JSON.stringify(e.data)));
      } catch(error){reject(error);}
    };
    worker.postMessage({file,kind,profileId:'fop-2025-26'});
  });
}
let passed=0,failed=0;const output=[];
for(const c of await(await fetch('../fixtures.json')).json()) {
  const li=document.createElement('li');
  try {
    const response=await fetch('/TestFiles/Generated/'+encodeURIComponent(c.folder)+'/'+encodeURIComponent(c.file));
    if(!response.ok)throw new Error('Fixture not found');
    const report=await check(new File([await response.arrayBuffer()],c.file),c.folder==='Reports'?'report':'zip');
    assertExpected(report,c);
    output.push({...c,report});passed++;li.textContent='PASS '+c.folder+'/'+c.file;
  }catch(e){failed++;li.textContent='FAIL '+c.folder+'/'+c.file+': '+e.message;}
  list.append(li);status.textContent=passed+' passed; '+failed+' failed';
}
document.getElementById('data').textContent=JSON.stringify(output,null,2);
