import {checkSubmission,reportText} from './checker.js';
self.onmessage=async event=>{
  try {
    const report=await checkSubmission(event.data.file,event.data.profileId,{progress:progress=>self.postMessage({type:'progress',...progress})});
    self.postMessage({type:'result',report,text:reportText(report)});
  } catch {self.postMessage({type:'error'});}
};
