// Copy an explicit set of public inputs. Never publish the checkout wholesale.
import {cp,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {prepareDependencies,root} from './dependencies.js';

await prepareDependencies();
const output=path.resolve(root,'_site');
if(path.dirname(output)!==path.resolve(root))throw new Error('Invalid site output directory.');
await rm(output,{recursive:true,force:true});
await mkdir(output);
const years=(await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{2}-\d{2}$/.test(e.name)).map(e=>e.name);
for(const entry of ['index.html','assets',...years,'checker/js','checker/checks']) {
  await cp(path.join(root,entry),path.join(output,entry),{recursive:true});
}
// Copy only the known dependency assets, not arbitrary files from a local cache.
for(const entry of ['zip.js','LICENSE.txt','pdfjs/pdf.js','pdfjs/pdf.worker.js','pdfjs/LICENSE','pdfjs/cmaps','pdfjs/standard_fonts']) {
  const destination=path.join(output,'checker/vendor',entry);
  await mkdir(path.dirname(destination),{recursive:true});
  await cp(path.join(root,'checker/vendor',entry),destination,{recursive:true});
}
console.log('Built the student site in _site/.');
