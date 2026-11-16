import fs from 'fs';import path from 'path';
import * as S from './index.js';
const fn=S.runFullAudit;
const root=process.argv[2]||'.';const files=[];
(function w(d){for(const f of fs.readdirSync(d)){if(['node_modules','.git','quet'].includes(f))continue;const p=path.join(d,f);const s=fs.statSync(p);if(s.isDirectory())w(p);else if(/\.(js|ts|gs|html)$/.test(f)&&!/(min|fflate|pdf)\./.test(f))files.push(p)}})(root);
const sum={};
for(const p of files){const code=fs.readFileSync(p,'utf8');let r;try{r=fn(code,p)}catch(e){continue}const arr=Object.values(r.findings||{}).flat();
 for(const f of arr){const k=`${f.severity}|${f.category}|${f.pattern||f.type}`;(sum[k]??=[]).push(path.relative(root,p)+':'+f.line)}}
for(const [k,v] of Object.entries(sum).sort())console.log(k,v.length,v.slice(0,4).join(' '));
