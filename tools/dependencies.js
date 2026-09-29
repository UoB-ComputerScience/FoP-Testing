// Materialise only the browser runtime files. These copies are ignored by Git.
import {copyFile,cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const root=fileURLToPath(new URL('../',import.meta.url));

export async function prepareDependencies() {
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  for(const [name,version] of Object.entries(manifest.dependencies)) {
    const installed=JSON.parse(await readFile(path.join(root,'node_modules',name,'package.json'),'utf8'));
    if(installed.version!==version)throw new Error('Run npm ci to install the pinned '+name+' version.');
  }
  const target=path.resolve(root,'checker/vendor');
  if(path.dirname(path.dirname(target))!==path.resolve(root))throw new Error('Invalid dependency output directory.');
  const zip=path.join(root,'node_modules/@zip.js/zip.js');
  const pdf=path.join(root,'node_modules/pdfjs-dist');
  await rm(target,{recursive:true,force:true});
  await mkdir(path.join(target,'pdfjs'),{recursive:true});
  await copyFile(path.join(zip,'index.min.js'),path.join(target,'zip.js'));
  await copyFile(path.join(zip,'LICENSE'),path.join(target,'LICENSE.txt'));
  for(const [source,destination] of [
    ['build/pdf.min.mjs','pdf.js'],
    ['LICENSE','LICENSE'],
  ])await copyFile(path.join(pdf,source),path.join(target,'pdfjs',destination));
  // Preserve the existing adaptation: PDF.js must not replace our worker's
  // message handler when its parser is imported into that same worker.
  const worker=await readFile(path.join(pdf,'build/pdf.worker.min.mjs'),'utf8');
  const registration='this.initializeFromPort(self)';
  if(worker.split(registration).length!==2)throw new Error('Review PDF.js worker registration before changing versions.');
  await writeFile(path.join(target,'pdfjs/pdf.worker.js'),
    '// Local adaptation: disable automatic self-port registration; the checker runs this parser inside its existing cancellable report worker.\n'+
    worker.replace(registration,'void 0'));
  for(const directory of ['cmaps','standard_fonts']) {
    await cp(path.join(pdf,directory),path.join(target,'pdfjs',directory),{recursive:true});
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await prepareDependencies();
  console.log('Prepared pinned browser dependencies in checker/vendor (ignored by Git).');
}
