import * as pdfjs from './vendor/pdfjs/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('vendor/pdfjs/build/pdf.worker.mjs');
const docs=new Map(),MAX=100*1024*1024;
async function documentFor(paper){
  if(!/^(?:\d{4}\.\d{4,5}|[a-zA-Z.-]+\/\d{7})(?:v\d+)?$/.test(paper))throw Error('PDF 论文编号无效');
  if(docs.has(paper))return docs.get(paper);
  const loading=(async()=>{
    const url='https://arxiv.org/pdf/'+paper,cache=await caches.open('alphabridge-pdf-v1');let response=await cache.match(url);
    if(response&&!/v\d+$/.test(paper)&&Date.now()-Number(response.headers.get('x-ab-time'))>86400000)response=null;
    if(!response){
      const r=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(90000)});if(!r.ok||new URL(r.url).hostname!=='arxiv.org')throw Error('下载 arXiv PDF 失败（HTTP '+r.status+'）');
      if(Number(r.headers.get('content-length'))>MAX)throw Error('PDF 超过 100 MB');
      const reader=r.body.getReader(),chunks=[];let size=0;
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();throw Error('PDF 超过 100 MB');}chunks.push(value);}
      const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
      if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('下载结果不是 PDF');
      response=new Response(bytes,{headers:{'content-type':'application/pdf','x-ab-time':String(Date.now())}});await cache.put(url,response.clone());
      const keys=await cache.keys();while(keys.length>6)await cache.delete(keys.shift());
    }
    const bytes=new Uint8Array(await response.arrayBuffer());
    const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const base=chrome.runtime.getURL('vendor/pdfjs/');
    const doc=await pdfjs.getDocument({data:bytes,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',isEvalSupported:false}).promise;
    return {doc,fingerprint};
  })();docs.set(paper,loading);
  try{const result=await loading;if(docs.size>2){const oldest=docs.keys().next().value;if(oldest!==paper){const d=await docs.get(oldest);docs.delete(oldest);await d.doc.destroy();}}return result;}catch(e){docs.delete(paper);throw e;}
}
// Offscreen documents do not animate; print intent avoids requestAnimationFrame.
async function canvasFor(page,scale=1){const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({intent:'print',canvasContext:canvas.getContext('2d'),viewport}).promise;return canvas;}
async function index(doc){const figures={};for(let pageNo=1;pageNo<=doc.numPages;pageNo++){
  const page=await doc.getPage(pageNo),vp=page.getViewport({scale:1}),text=await page.getTextContent(),lines=[];
  for(const item of text.items){if(!item.str?.trim())continue;const t=pdfjs.Util.transform(vp.transform,item.transform),height=Math.hypot(t[2],t[3]);let line=lines.find(l=>Math.abs(l.y-t[5])<2);if(!line){line={y:t[5],items:[]};lines.push(line);}line.items.push({text:item.str,x:t[4],right:t[4]+item.width,top:t[5]-height});}
  lines.sort((a,b)=>a.y-b.y);for(const line of lines)line.items.sort((a,b)=>a.x-b.x);
  const captions=lines.map(l=>({...l,text:l.items.map(i=>i.text).join(' ')})).filter(l=>/^\s*(Figure|Fig\.?|Table)\s+([A-Za-z]?\d+)\s*[.:]/i.test(l.text));
  let canvas,pixels;for(const line of captions){const match=line.text.match(/^\s*(Figure|Fig\.?|Table)\s+([A-Za-z]?\d+)/i),kind=/table/i.test(match[1])?'Table':'Figure',label=kind+' '+match[2];let clip=[0,0,1,1],confident=false;
    if(kind==='Figure'&&!page.rotate){
      canvas??=await canvasFor(page);pixels??=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const left=Math.max(0,Math.floor(line.items[0].x-4)),right=Math.min(canvas.width,Math.ceil(Math.max(...line.items.map(i=>i.right))+4));
      const bottom=Math.max(0,Math.floor(Math.min(...line.items.map(i=>i.top))-2));
      const ink=y=>{let count=0;for(let x=left;x<right;x++){const i=(y*canvas.width+x)*4;if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<235&&++count>=3)return true;}return false;};
      let y=bottom-1;while(y>0&&!ink(y))y--;const last=y;let blank=0,top=-1;for(;y>=Math.max(0,bottom-650);y--){blank=ink(y)?0:blank+1;if(blank>=12){top=y+blank;break;}}
      if(top>=0&&last-top>30&&right-left>20){clip=[left/vp.width,Math.max(0,top-3)/vp.height,right/vp.width,Math.min(bottom,last+4)/vp.height];
        const inside=lines.filter(l=>l.y>top&&l.y<last&&l.items.some(i=>i.x>=left&&i.right<=right));
        const prose=inside.filter(l=>l.items.some(i=>i.text.length>75&&i.right-i.x>(right-left)*.8&&l.y-i.top>=9)).length>=3;
        const ops=await page.getOperatorList();const graphics=ops.fnArray.some(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.constructPath].includes(op));
        confident=graphics&&!prose&&(last-top)<vp.height*.72;
      }
    }
    (figures[label]??=[]).push({page:pageNo,label,caption:line.text.slice(0,500),clip,confident});
  }
  if(canvas){canvas.width=0;canvas.height=0;}page.cleanup();
}for(const values of Object.values(figures))if(values.length>1)for(const v of values)v.confident=false;return figures;}
async function dispatch(m){
  const entry=await documentFor(m.paper),{doc,fingerprint}=entry;if(m.fingerprint&&m.fingerprint!==fingerprint)throw Error('PDF 版本已变化，请重新打开阅读页确认裁剪');
  const common={ok:true,fingerprint,pageCount:doc.numPages};if(m.type==='pdf-index'){entry.index??=index(doc).catch(e=>{entry.index=null;throw e;});return {...common,figures:await entry.index};}
  if(!Number.isInteger(m.page)||m.page<1||m.page>doc.numPages)throw Error('PDF 页码无效');
  const c=m.clip??[0,0,1,1];if(!Array.isArray(c)||c.length!==4||c.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)||c[2]-c[0]<.005||c[3]-c[1]<.005)throw Error('裁剪坐标无效');
  const page=await doc.getPage(m.page),vp=page.getViewport({scale:1});let scale=Math.min(3.2,(m.preview?1000:2000)/(vp.width*(c[2]-c[0])),2400/(vp.height*(c[3]-c[1])));
  // Clip during render instead of allocating an enormous full-page bitmap.
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width*(c[2]-c[0])*scale);canvas.height=Math.ceil(vp.height*(c[3]-c[1])*scale);
  await page.render({intent:'print',canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale}),transform:[1,0,0,1,-c[0]*vp.width*scale,-c[1]*vp.height*scale]}).promise;
  const image=canvas.toDataURL('image/jpeg',.9),result={...common,page:m.page,image,width:canvas.width,height:canvas.height};canvas.width=0;page.cleanup();return result;
}
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(m.target!=='pdf-engine'||sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return;
  if(m.type==='pdf-ping'){reply({ok:true});return;}
  const run=queue.catch(()=>{}).then(()=>dispatch(m));queue=run;run.then(value=>reply({ok:true,value}),e=>reply({ok:false,error:e.message}));return true;
});
