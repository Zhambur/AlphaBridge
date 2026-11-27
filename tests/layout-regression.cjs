const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert/strict');
const root=process.cwd(),out=process.env.AB_TEST_OUTPUT||root+'/work/test-output';
(async()=>{
const ctx=await chromium.launchPersistentContext(root+'/work/layout-browser-'+Date.now(),{...(process.env.AB_BROWSER_PATH?{executablePath:process.env.AB_BROWSER_PATH}:{channel:process.env.AB_BROWSER_CHANNEL||'msedge'}),headless:true,args:['--disable-extensions-except='+root+'/extension','--load-extension='+root+'/extension'],ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1600,height:1100}});
const checks=[];function check(name,v){assert(v,name);checks.push(name);console.log('PASS',name);}
try{
 const html=fs.readFileSync(root+'/work/embodied.html','utf8');
 // Reproduce the old defects with the saved, pre-fix implementation.
 const before=await ctx.newPage();await before.goto('about:blank');await before.addScriptTag({path:root+'/extension/vendor/purify.min.js'});await before.addScriptTag({path:root+'/work/layout-fix-before/document.js'});
 const old=await before.evaluate(html=>{const box=document.createElement('div');box.append(ABDocument.sanitize(html,'https://arxiv.org/html/2610.22471'));const tables=[...box.querySelectorAll('.ltx_tabular')].map(t=>t.outerHTML);ABDocument.prepare(box);return {images:box.querySelectorAll('img').length,translatedTable:box.querySelector('#paper-S9\\.T7').querySelectorAll('.ltx_tabular .pb-sentence,.pb-source .ltx_tabular').length,changedTables:tables.filter((t,i)=>t!==box.querySelectorAll('.ltx_tabular')[i]?.outerHTML).length};},html);
 console.log('BEFORE',old);check('Old SVG loss reproduced',old.images===21);check('Old semantic-table damage reproduced',old.changedTables>0);
 await before.close();
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');const id=worker.url().split('/')[2];await worker.evaluate(()=>chrome.storage.local.set({config:{pdfFigures:false}}));
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('chrome-extension://'+id+'/reader.html?paper=2610.22471');await page.waitForSelector('.pb-source',{timeout:90000});
 const result=await page.evaluate(html=>{
   const raw=new DOMParser().parseFromString(html,'text/html').querySelector('.ltx_document');
   const clean=document.createElement('div');clean.append(ABDocument.sanitize(html,'https://arxiv.org/html/2610.22471'));
   const before=[...clean.querySelectorAll('.ltx_tabular')].map(t=>t.outerHTML);const images=[...clean.querySelectorAll('img')];const rawText=raw.textContent.replace(/\s/g,'');
   const bs=ABDocument.prepare(clean);
   const expected=[...clean.querySelectorAll('.ltx_tabular')];
   const live=document.querySelector('#document');
   const cells=[...live.querySelector('#paper-S9\\.T7 .ltx_tr').children].filter(x=>x.matches('.ltx_td')).map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}});
   return {textPreserved:rawText===clean.textContent.replace(/\s/g,''),tables:expected.length,unchanged:before.every((s,i)=>s===expected[i].outerHTML),rawImages:raw.querySelectorAll('img').length,svgObjects:raw.querySelectorAll('object[type="image/svg+xml"]').length,images:clean.querySelectorAll('img').length,imageNodesSame:images.every((img,i)=>img===clean.querySelectorAll('img')[i]),objects:clean.querySelectorAll('object').length,translatedTables:live.querySelectorAll('.ltx_tabular .pb-sentence,.pb-source .ltx_tabular').length,nativeTables:live.querySelectorAll('table.ltx_tabular').length,colspan:live.querySelector('#paper-S9\\.T7 .ltx_colspan_3')?.getAttribute('colspan'),rowspan:live.querySelector('#paper-S9\\.T7 .ltx_rowspan_2')?.getAttribute('rowspan'),figure3:live.querySelector('#paper-S2\\.F3 img')?.src,cells,sentences:bs.length};
 },html);
 console.log('AFTER',JSON.stringify(result));
 check('Original text retained',result.textPreserved);check('All 32 semantic tables unchanged',result.tables===32&&result.unchanged);check('No table enters sentence translation',result.translatedTables===0);check('All 5 SVG objects become inert images',result.images===26&&result.svgObjects===5&&result.objects===0);check('Images retain their DOM nodes during preparation',result.imageNodesSame);
 check('Semantic tables use native cells and preserve merged headers',result.nativeTables===32&&result.colspan==='3'&&result.rowspan==='2');
 check('Table 7 header cells remain horizontal',result.cells.length>=5&&result.cells.slice(1).every((c,i)=>c.x>result.cells[i].x));
 // Synthetic cases cover structures absent from the original Attention fixture.
 const synthetic=await page.evaluate(()=>{
   const html='<article class="ltx_document"><div class="ltx_p" id="wrap"><img src="https://arxiv.org/html/x.png"><span>Text next to a figure must not lose its image.</span></div><p class="ltx_p">An ordinary sentence. Another sentence.</p><p class="ltx_p"><span class="ltx_tabular"><span class="ltx_tr"><span class="ltx_td"><span class="ltx_p">Cell content is not prose.</span></span></span></span></p><object type="text/html" data="https://evil.example/x"></object><object type="image/svg+xml" data="https://evil.example/x.svg"></object></article>';
   const box=document.createElement('div');box.append(ABDocument.sanitize(html,'https://arxiv.org/html/1'));const wrapper=box.querySelector('#paper-wrap').outerHTML;ABDocument.prepare(box);
   return {wrapper:box.querySelector('#paper-wrap').outerHTML===wrapper,cell:!box.querySelector('.ltx_tabular .pb-source'),safe:!box.querySelector('object,iframe,img[src*="evil"]'),warnings:box.querySelectorAll('.ab-unsupported-media').length};
 });check('Image-bearing paragraphs and nested semantic cells untouched',synthetic.wrapper&&synthetic.cell);check('Unsafe objects remain blocked with visible placeholders',synthetic.safe&&synthetic.warnings===2);
 await page.waitForFunction(()=>[...document.querySelectorAll('#document img')].every(x=>x.complete&&x.naturalWidth>0),null,{timeout:90000});
 check('All 26 real paper images rendered',await page.locator('#document img').evaluateAll(xs=>xs.length===26&&xs.every(x=>x.naturalWidth>0)));
 // Exercise translation insertion with a labelled fixture, without using any model credentials.
 await page.evaluate(()=>{for(const b of blocks)ABDocument.renderTranslation(b,'【版式测试译文】'+b.text);});
 check('Translation insertion still leaves tables untouched',await page.locator('.ltx_tabular .pb-sentence,.pb-source .ltx_tabular').count()===0);
 await page.locator('[data-source-id="S9.T7"]').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:out+'/AlphaBridge-table7-fixed.png'});
 await page.locator('[data-source-id="S2.F3"]').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:out+'/AlphaBridge-figure3-fixed.png'});
 await page.locator('[data-source-id="S2.F4"]').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:out+'/AlphaBridge-figure4-fixed.png'});
 // A failed image is reported even after translation progress changes.
 const failed=await page.evaluate(async()=>{
   const old=AB.message;AB.message=async()=>{throw Error('fixture failure')};
   const box=document.createElement('div');const img=document.createElement('img');img.src='https://arxiv.org/html/invalid-fixture.png';box.append(img);document.querySelector('#document').append(box);monitorImages(box);
   img.dispatchEvent(new Event('error'));await new Promise(r=>setTimeout(r,50));notice('翻译完成');
   const ok=!document.querySelector('#media-status').hidden&&!!box.querySelector('.ab-media-failure');box.remove();AB.message=old;return ok;
 });check('Image failures remain visible independently of translation status',failed);
 
 const svgFallback=await page.evaluate(async()=>{const data=await AB.message({type:'asset',url:'https://arxiv.org/html/2610.22471v2/icl_package.svg'});const img=new Image();img.src=data;await img.decode();return data.startsWith('data:image/svg+xml;base64,')&&img.naturalWidth>0;});
 check('SVG fallback returns a renderable inert image',svgFallback);
 const attention=await page.evaluate(html=>{const raw=new DOMParser().parseFromString(html,'text/html').querySelector('.ltx_document');const box=document.createElement('div');box.append(ABDocument.sanitize(html,'https://arxiv.org/html/1706.03762v7'));ABDocument.prepare(box);return {textPreserved:raw.textContent.replace(/\s/g,'')===box.textContent.replace(/\s/g,''),structurePreserved:['math','.ltx_tabular','figure'].every(tag=>raw.querySelectorAll(tag).length===box.querySelectorAll(tag).length),rawImages:raw.querySelectorAll('img').length,svgObjects:raw.querySelectorAll('object[type="image/svg+xml"]').length,images:box.querySelectorAll('img').length};},fs.readFileSync(root+'/work/attention.html','utf8'));
 // SVG objects now become images here too; the old img-only count omitted them.
 check('Original Attention fixture retains text, formulas, tables and figures',attention.textPreserved&&attention.structurePreserved&&attention.images===attention.rawImages+attention.svgObjects);
check('No reader runtime errors',!errors.length);
 const report={version:JSON.parse(fs.readFileSync(root+'/extension/manifest.json','utf8')).version,verifiedAt:new Date().toISOString(),paper:'2610.22471',checks,before:old,after:result,attention,errors};fs.writeFileSync(root+'/work/layout-fix-verification.json',JSON.stringify(report,null,2));
}finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exit(1)});
