import {LIMITS} from './profiles.js';
import {sha256} from './checker.js';

const finding=(id,status,title,message)=>({id,status,title,message,paths:[]});
const stop=(report,id,title,message,status='error')=>({...report,complete:false,findings:[finding(id,status,title,message)]});
const MAX_PAGES=200;
const MAX_TEXT=2*1024*1024;

export async function checkPdfReport(file,report,{progress=()=>{},limits=LIMITS}={}) {
  if(file.size>limits.archiveBytes) return stop(report,'report.limit','Report check incomplete','This report exceeds the checker’s 25 MiB file limit.','warning');
  // PDF.js 5.6.205, distributed under Apache-2.0; see vendor/pdfjs/LICENSE.
  // Register its parser in the existing report worker. This avoids a nested
  // worker that could outlive cancellation of the report check.
  await import('../vendor/pdfjs/pdf.worker.js');
  const {getDocument}=await import('../vendor/pdfjs/pdf.js');
  let task,timer;
  let invalidStream=false;
  const originalWarn=console.warn;
  // PDF.js 5.6 still substitutes an empty stream for certain decoder failures
  // even with stopAtErrors. Observe that specific diagnostic so lost page data
  // cannot be reported as a successful check. This console belongs to our worker.
  const captureWarning=(...args)=>{
    if(args.some(value=>typeof value==='string'&&value.startsWith('Warning: Invalid stream:')))invalidStream=true;
    originalWarn.apply(console,args);
  };
  console.warn=captureWarning;
  const timedOut=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('checker-timeout')),limits.milliseconds);});
  try {
    const data=new Uint8Array(await file.arrayBuffer());
    report.file.sha256=await sha256(data);
    task=getDocument({
      data,stopAtErrors:true,isEvalSupported:false,enableXfa:false,
      disableFontFace:true,useSystemFonts:false,useWasm:false,useWorkerFetch:true,
      isOffscreenCanvasSupported:false,isImageDecoderSupported:false,
      cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
      standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href,
    });
    const inspect=async()=>{
      const pdf=await task.promise;
      if(pdf.numPages>MAX_PAGES) return stop(report,'report.limit','Report check incomplete','This PDF has more than 200 pages, which exceeds this checker’s limit. Open it in a PDF reader to check it.','warning');
      let characters=0,words=0;
      const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'word'}):null;
      for(let number=1;number<=pdf.numPages;number++) {
        const page=await pdf.getPage(number);
        const content=await page.getTextContent();
        if(invalidStream)throw new Error('invalid-pdf-stream');
        const text=content.items.map(item=>typeof item.str==='string'?item.str:'').join(' ').trim();
        characters+=text.length;
        if(characters>MAX_TEXT) return stop(report,'report.limit','Report check incomplete','This PDF contains more text than this checker can inspect. Open it in a PDF reader to check it.','warning');
        if(segmenter) {for(const word of segmenter.segment(text))if(word.isWordLike)words++;}
        else words+=(text.match(/\S+/g)||[]).length;
        page.cleanup();
        progress({completed:number,total:pdf.numPages,unit:'page'});
      }
      report.findings.push(finding('report.readable','pass','PDF pages and text could be read',`${pdf.numPages} page${pdf.numPages===1?' was':'s were'} inspected. Open the PDF in a reader to check its appearance and images.`));
      report.findings.push(finding('report.word-format','warning','Save the report as a Word document','This PDF could be read, but DOCX is the expected submission format. If you exported a PDF, save a DOCX copy from your original document. Changing the filename alone will not convert it.'));
      if(!/\.pdf$/i.test(file.name)) report.findings.push(finding('report.extension','warning','The file contains a PDF','The file contents are PDF, regardless of its filename. Save a DOCX copy from your document editor for submission.'));
      if(!words) report.findings.push(finding('report.pdf-text','warning','No extractable text found','This PDF may contain scanned pages or images, or it may be blank. Open it and check that your written report is present. Text in images is not counted.'));
      else report.findings.push(finding('report.words','pass',`Approximately ${words.toLocaleString()} words`,'Counted from extractable PDF text. Text in images is not counted, and the total may differ from Word.'));
      report.complete=true;report.format='PDF';report.pageCount=pdf.numPages;report.wordCount=words;
      report.notChecked.push('Page appearance and image contents','Text within images');
      return report;
    };
    return await Promise.race([inspect(),timedOut]);
  } catch(error) {
    if(error.message==='checker-timeout') return stop(report,'report.limit','Report check incomplete','PDF checking took too long and was stopped. Open the document in a PDF reader to check it.','warning');
    if(error.name==='PasswordException') return stop(report,'report.encrypted','Report is password-protected','Save a copy without a password, then check that copy.');
    return stop(report,'report.pdf-unreadable','PDF could not be fully read','The PDF’s pages or text could not be read. It may be damaged or use unsupported features. Open it in a PDF reader and save a fresh copy, preferably as DOCX from the original document.');
  } finally {
    clearTimeout(timer);
    if(task)await task.destroy().catch(()=>{});
    if(console.warn===captureWarning)console.warn=originalWarn;
  }
}
