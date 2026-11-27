const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function fixturePDF(){
  const stream='BT /F1 18 Tf 70 740 Td (AlphaBridge synthetic fixture) Tj ET\n0.1 0.5 0.8 rg 70 500 350 180 re f\n0 0 0 rg BT /F1 12 Tf 70 470 Td (Figure 1: A colored box for browser rendering tests.) Tj ET\n';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
  let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');return Buffer.from(pdf+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
(async()=>{
  const root=path.resolve(__dirname,'..'),work=path.join(root,'work','standalone-'+Date.now()),extension=path.join(work,'extension');fs.mkdirSync(work,{recursive:true});
  fs.cpSync(process.env.AB_TEST_EXTENSION||path.join(root,'extension'),extension,{recursive:true,filter:p=>path.basename(p)!=='local-defaults.json'});
  const c=await chromium.launchPersistentContext(path.join(work,'profile'),{...(process.env.AB_BROWSER_PATH?{executablePath:process.env.AB_BROWSER_PATH}:{channel:process.env.AB_BROWSER_CHANNEL||'msedge'}),headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension],ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1400,height:1000}});
  c.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});
  const checks=[],check=(name,value)=>{assert(value,name);checks.push(name);console.log('PASS',name);};
  try{
    const w=c.serviceWorkers()[0]||await c.waitForEvent('serviceworker'),id=w.url().split('/')[2],p=await c.newPage();
    await p.goto('chrome-extension://'+id+'/options.html');await p.waitForFunction(()=>document.querySelector('#vault-status').textContent.includes('尚未'));
    const cfg=await p.evaluate(()=>AB.message({type:'config'}));check('Published defaults contain no local values',!cfg.vaultName&&!cfg.vaultHint&&!cfg.noteFolder&&!cfg.url&&!cfg.model&&!cfg.key);
    const n={id:'12345678-1234-4234-9234-123456789abc',paper:'1706.03762v7',title:'Fixture paper',quote:'Selected text',thought:'A thought',source:'https://arxiv.org/abs/1706.03762v7',at:'2026-01-01T00:00:00Z'};
    check('Missing directory grant fails without losing draft',await p.evaluate(async n=>{try{await AB.message({type:'save-note',note:n});return false;}catch{return (await AB.message({type:'notes',paper:n.paper})).some(v=>v.id===n.id&&!v.exported);}},n));
    await p.evaluate(async()=>{const sandbox=await navigator.storage.getDirectory(),vault=await sandbox.getDirectoryHandle('test-vault',{create:true});await vault.getDirectoryHandle('.obsidian',{create:true});await ABVault.handle(vault);const cfg=await AB.message({type:'config'});await AB.message({type:'save-config',config:{...cfg,noteFolder:'Reading/Papers',vaultName:'Test Vault'}});});
    const saved=await p.evaluate(n=>AB.message({type:'save-note',note:n}),n);check('Real filesystem API export succeeds without native host',saved.exported&&saved.path==='Reading/Papers/AlphaBridge-1706.03762.md'&&saved.uri.includes('Test%20Vault'));
    const read=()=>p.evaluate(async()=>{let d=await ABVault.handle();for(const s of ['Reading','Papers'])d=await d.getDirectoryHandle(s);return (await (await d.getFileHandle('AlphaBridge-1706.03762.md')).getFile()).text();});
    check('Markdown contains quote and thought',(await read()).includes('> Selected text')&&(await read()).includes('A thought'));
    await p.evaluate(n=>AB.message({type:'save-note',note:n}),n);check('Duplicate save is idempotent',(await read()).split('^ab-'+n.id).length===2);
    await p.evaluate(async()=>{let d=await ABVault.handle();for(const s of ['Reading','Papers'])d=await d.getDirectoryHandle(s);const f=await d.getFileHandle('AlphaBridge-1706.03762.md'),old=await(await f.getFile()).text(),writer=await f.createWritable();await writer.write(old+'\nUser edit stays\n');await writer.close();});
    await p.evaluate(n=>Promise.all([AB.message({type:'save-note',note:{...n,id:'22345678-1234-4234-9234-123456789abc'}}),AB.message({type:'save-note',note:{...n,id:'32345678-1234-4234-9234-123456789abc'}})]),n);
    check('Concurrent appends preserve user edits',(await read()).includes('User edit stays')&&(await read()).match(/\^ab-/g).length===3);
    check('Traversal and invalid paths rejected',await p.evaluate(async()=>{for(const noteFolder of ['../outside','C:/private','a//b','CON','a/..']){try{await AB.message({type:'save-config',config:{noteFolder}});return false;}catch{}}return true;}));
    await p.reload();check('Directory handle persists across reload',await p.evaluate(async()=>!!await ABVault.handle()));
    await p.locator('#forget-vault').click();await p.waitForFunction(()=>document.querySelector('#vault-status').textContent==='尚未选择目录');
    check('Disconnect removes filesystem access',await p.evaluate(async()=>!await ABVault.handle()));
    await p.screenshot({path:path.join(work,'options.png')});
    const pdf=fixturePDF();await p.evaluate(async data=>{const cache=await caches.open('alphabridge-pdf-v1');await cache.put('https://arxiv.org/pdf/1706.03762v7',new Response(new Uint8Array(data),{headers:{'x-ab-time':String(Date.now())}}));},[...pdf]);
    const idx=await p.evaluate(()=>Promise.race([AB.message({type:'pdf-index',paper:'1706.03762v7'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('PDF index timed out')),25000))]));check('Bundled PDF.js indexes real PDF without Python',idx.pageCount===1&&idx.figures['Figure 1']?.length===1);
    check('Figure proposal detects synthetic graphic',idx.figures['Figure 1'][0].confident);
    const rendered=await p.evaluate(fingerprint=>AB.message({type:'pdf-render',paper:'1706.03762v7',page:1,clip:[0,0,1,1],fingerprint,preview:true}),idx.fingerprint);
    check('PDF page renders to image',rendered.width===1000&&rendered.image.startsWith('data:image/jpeg;base64,'));
    const crop=await p.evaluate(fingerprint=>AB.message({type:'pdf-render',paper:'1706.03762v7',page:1,clip:[.12,.15,.65,.36],fingerprint}),idx.fingerprint);
    check('Crop contains actual blue graphic',await p.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const rgba=x.getImageData(Math.floor(i.width/2),Math.floor(i.height/2),1,1).data;return rgba[2]>rgba[0]+80;},crop.image));
    await p.evaluate(src=>{const i=new Image();i.id='pdf-test-preview';i.src=src;document.body.replaceChildren(i);},rendered.image);await p.locator('#pdf-test-preview').screenshot({path:path.join(work,'pdf-preview.png')});
    check('Invalid crops and stale fingerprints rejected',await p.evaluate(async()=>{for(const extra of [{clip:[.8,0,.1,1]},{fingerprint:'wrong'}]){try{await AB.message({type:'pdf-render',paper:'1706.03762v7',page:1,...extra});return false;}catch{}}return true;}));
    await p.evaluate(()=>AB.message({type:'clear-pdf-cache'}));check('Cache clears on request',await p.evaluate(async()=>!(await caches.keys()).includes('alphabridge-pdf-v1')));
    check('Native messaging permission removed',!JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'))).permissions.includes('nativeMessaging'));
    fs.writeFileSync(path.join(work,'verification.json'),JSON.stringify({checks,scope:'Filesystem tests use real OPFS handles; OS directory picker requires a human grant.'},null,2));console.log('ARTIFACTS',work);
  }finally{await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
