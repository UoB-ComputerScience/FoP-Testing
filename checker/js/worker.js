import {checkSubmission} from './checker.js';
import {prepareReport} from './report.js';
self.onmessage=async event=>{
  try {
    if(event.data.kind==='report') {
      const prepared=await prepareReport(event.data.file,{progress:progress=>self.postMessage({type:'progress',...progress})});
      self.postMessage({type:'report-package',prepared});
      return;
    }
    const report=await checkSubmission(event.data.file,event.data.profileId,{progress:progress=>self.postMessage({type:'progress',...progress})});
    self.postMessage({type:'result',report});
  } catch {self.postMessage({type:'error'});}
};
