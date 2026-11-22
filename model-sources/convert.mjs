import assimpjs from 'assimpjs';
import fs from 'node:fs'; import path from 'node:path';
const [,, out, ...inputs] = process.argv;
const ajs = await assimpjs();
const fl = new ajs.FileList();
for (const f of inputs) fl.AddFile(path.basename(f), new Uint8Array(fs.readFileSync(f)));
const r = ajs.ConvertFileList(fl, 'glb2');
if (!r.IsSuccess() || r.FileCount() === 0) { console.error('FAIL', r.GetErrorCode()); process.exit(1); }
for (let i = 0; i < r.FileCount(); i++) { const f = r.GetFile(i); console.log('out', f.GetPath(), f.GetContent().length); if (i===0) fs.writeFileSync(out, f.GetContent()); }
