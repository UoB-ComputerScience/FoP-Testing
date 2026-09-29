const list=document.getElementById('results');let passed=0,failed=0;
function assert(value,message='Unexpected result'){if(!value)throw new Error(message);}
function check(file) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker('/checker/js/worker.js',{type:'module'});
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timed out'));},35000);
    worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};
    worker.onmessage=e=>{
      if(e.data.type==='progress')return;
      clearTimeout(timer);worker.terminate();
      if(e.data.type==='report-package')resolve(e.data.prepared.report);
      else reject(new Error(JSON.stringify(e.data)));
    };
    worker.postMessage({kind:'report',file,profileId:'fop-2025-26'});
  });
}
for(const fixture of (await(await fetch('../fixtures.json')).json()).filter(c=>c.pdf)) {
  const c={file:fixture.file,...fixture.pdf};
  const li=document.createElement('li');
  try {
    const bytes=await(await fetch('/TestFiles/Generated/Reports/'+encodeURIComponent(c.file))).arrayBuffer();
    const report=await check(new File([bytes],c.file));
    const has=(id,status)=>report.findings.some(f=>f.id===id&&f.status===status);
    const detail=JSON.stringify(report.findings);
    if(c.expected==='readable'||c.expected==='no-text') {
      assert(report.complete,detail);assert(report.format==='PDF',detail);assert(report.pageCount===c.pages,detail);
      assert(has('report.word-format','warning'),detail);assert(!report.findings.some(f=>f.status==='error'),detail);
      if(c.words)assert(report.wordCount>0,detail);
      if(c.extension)assert(has('report.extension','warning'),detail);
      if(c.expected==='no-text')assert(report.wordCount===0&&has('report.pdf-text','warning'),detail);
    } else if(c.expected==='encrypted')assert(!report.complete&&has('report.encrypted','error'),detail);
    else if(c.expected==='limit')assert(!report.complete&&has('report.limit','warning'),detail);
    else assert(!report.complete&&has('report.pdf-unreadable','error'),detail);
    passed++;li.textContent='PASS '+c.file;
  } catch(error) {failed++;li.textContent='FAIL '+c.file+': '+error.message;}
  list.append(li);
}
document.getElementById('status').textContent=`${passed} passed; ${failed} failed`;
