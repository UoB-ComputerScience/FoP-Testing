import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../tools/dependencies.js';

test('deployment contains the student site, resolves local references and excludes development/private folders',async()=>{
  execFileSync(process.execPath,[path.join(root,'tools/build.js')],{cwd:root});
  const output=path.join(root,'_site');
  const years=(await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{2}-\d{2}$/.test(e.name)).map(e=>e.name);
  assert.deepEqual((await readdir(output)).sort(),['index.html','assets','checker',...years].sort());
  assert.deepEqual((await readdir(path.join(output,'checker'))).sort(),['checks','js','vendor']);
  const files=await readdir(output,{recursive:true});
  for(const file of files) {
    assert(!/(^|[\\/])(TestFiles|tests|java|node_modules|\.git)([\\/]|$)/.test(file),file);
    if(!/\.(html|js)$/.test(file)||file.includes('vendor'))continue;
    const text=await readFile(path.join(output,file),'utf8');
    const references=[...text.matchAll(/(?:src=|href=|from\s+|import\(|new URL\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)];
    for(const [,reference] of references) {
      const target=path.resolve(output,path.dirname(file),reference);
      assert(target.startsWith(output+path.sep),`${file}: reference escapes the site`);
      await stat(target);
    }
  }
  for(const entry of ['zip.js','pdfjs/pdf.js','pdfjs/pdf.worker.js','pdfjs/cmaps','pdfjs/standard_fonts']) {
    await stat(path.join(output,'checker/vendor',entry));
  }
});
