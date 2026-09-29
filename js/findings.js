import zip from '../checks/zip.js';
import report from '../checks/report.js';
import archive from '../checks/archive.js';

const definitions={...zip,...report,...archive};
const statuses=new Set(['error','warning','pass','info']);

export function makeFinding(key,values={},paths=[]) {
  const definition=definitions[key];
  if(!definition || !statuses.has(definition.status)) throw new Error(`Invalid check definition: ${key}`);
  const format=text=>text.replace(/\{(\w+)\}/g,(_,name)=>{
    if(!Object.hasOwn(values,name)) throw new Error(`Missing ${name} for check ${key}`);
    return String(values[name]);
  });
  return {id:definition.id,status:definition.status,title:format(definition.title),message:format(definition.message),paths};
}
