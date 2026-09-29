import {makeFinding} from './findings.js';
import {LIMITS} from './profiles.js';
import {sha256} from './checker.js';

const stop=(report,key,values)=>({...report,complete:false,findings:[makeFinding(key,values)]});
const MAX_PAGES=200;
const MAX_TEXT=2*1024*1024;

export async function checkPdfReport(file,report,{progress=()=>{},limits=LIMITS}={}) {
  if(file.size>limits.archiveBytes) return stop(report,'report.limit.warning.3');
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
      if(pdf.numPages>MAX_PAGES) return stop(report,'report.limit.warning.4');
      let characters=0,words=0;
      const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'word'}):null;
      for(let number=1;number<=pdf.numPages;number++) {
        const page=await pdf.getPage(number);
        const content=await page.getTextContent();
        if(invalidStream)throw new Error('invalid-pdf-stream');
        const text=content.items.map(item=>typeof item.str==='string'?item.str:'').join(' ').trim();
        characters+=text.length;
        if(characters>MAX_TEXT) return stop(report,'report.limit.warning.5');
        if(segmenter) {for(const word of segmenter.segment(text))if(word.isWordLike)words++;}
        else words+=(text.match(/\S+/g)||[]).length;
        page.cleanup();
        progress({completed:number,total:pdf.numPages,unit:'page'});
      }
      report.findings.push(makeFinding('report.readable.pass.2',{pages:pdf.numPages,pageVerb:pdf.numPages===1?' was':'s were'}));
      report.findings.push(makeFinding('report.word-format.warning.2'));
      if(!/\.pdf$/i.test(file.name)) report.findings.push(makeFinding('report.extension.warning.2'));
      if(!words) report.findings.push(makeFinding('report.pdf-text.warning'));
      else report.findings.push(makeFinding('report.words.pass.2',{count:words.toLocaleString()}));
      report.complete=true;report.format='PDF';report.pageCount=pdf.numPages;report.wordCount=words;
      report.notChecked.push('Page appearance and image contents','Text within images');
      return report;
    };
    return await Promise.race([inspect(),timedOut]);
  } catch(error) {
    if(error.message==='checker-timeout') return stop(report,'report.limit.warning.6');
    if(error.name==='PasswordException') return stop(report,'report.encrypted.error');
    return stop(report,'report.pdf-unreadable.error');
  } finally {
    clearTimeout(timer);
    if(task)await task.destroy().catch(()=>{});
    if(console.warn===captureWarning)console.warn=originalWarn;
  }
}
