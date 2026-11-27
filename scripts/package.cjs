/* Packages tracked sources only. Never recursively zip a working checkout. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {zipSync,unzipSync}=require('fflate'),{audit}=require('./privacy.cjs');
const root=path.resolve(__dirname,'..');process.chdir(root);
const manifest=JSON.parse(fs.readFileSync('extension/manifest.json'));
if(manifest.permissions.includes('nativeMessaging'))throw Error('Standalone release must not require native messaging');
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),entries={};
for(const name of files){const bytes=fs.readFileSync(name);audit(name,bytes);if(name.startsWith('extension/')||['README.md','SETUP.md'].includes(name))entries[name]=new Uint8Array(bytes);}
for(const required of ['extension/manifest.json','extension/vault.js','extension/pdf-engine.js','extension/vendor/pdfjs/build/pdf.mjs','extension/vendor/pdfjs/build/pdf.worker.mjs'])if(!entries[required])throw Error('Missing tracked source: '+required);
const output=process.env.AB_RELEASE_DIR||path.join(root,'work','release-'+manifest.version);fs.mkdirSync(output,{recursive:true});
const name='AlphaBridge-'+manifest.version+'.zip',bytes=zipSync(entries,{level:6}),file=path.join(output,name);fs.writeFileSync(file,bytes);
const unpacked=unzipSync(bytes);for(const [name,original] of Object.entries(entries)){audit(name,unpacked[name]);if(!Buffer.from(original).equals(Buffer.from(unpacked[name])))throw Error('ZIP mismatch: '+name);}
const hash=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),hash+'  '+name+'\n');
console.log(JSON.stringify({file,files:Object.keys(entries).length,bytes:bytes.length,sha256:hash},null,2));
