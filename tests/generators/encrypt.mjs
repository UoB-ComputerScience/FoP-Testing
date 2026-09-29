// Used by the Python generators. No external Node packages are needed.
import {readFile,writeFile} from 'node:fs/promises';
import {ZipReader,ZipWriter,Uint8ArrayReader,Uint8ArrayWriter} from '../../checker/vendor/zip.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node encrypt.mjs INPUT.zip OUTPUT.zip');
const reader=new ZipReader(new Uint8ArrayReader(await readFile(input)),{useWebWorkers:false});
const writer=new ZipWriter(new Uint8ArrayWriter(),{password:'archive-test',useWebWorkers:false});
try {
  for(const entry of await reader.getEntries()) {
    const data=entry.directory?undefined:new Uint8ArrayReader(await entry.getData(new Uint8ArrayWriter()));
    await writer.add(entry.filename,data,{directory:entry.directory});
  }
  await writeFile(output,await writer.close(),{flag:'wx'});
} finally {await reader.close();}
