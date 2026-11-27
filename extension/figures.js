/* PDF images replace only figure artwork; captions and translations stay live. */
globalThis.ABFigures=(()=>{
  const records=[];let paper='',indexPromise=null,queue=Promise.resolve(),dialog,zoom,active=null,previewToken=0,clip=[0,0,1,1],currentPage=1,drag=null;
  const $=s=>dialog.querySelector(s);
  function job(message){const run=queue.catch(()=>{}).then(()=>AB.message(message));queue=run;return run;}
  function getIndex(){if(!indexPromise)indexPromise=job({type:'pdf-index',paper}).catch(e=>{indexPromise=null;throw e;});return indexPromise;}
  function key(record){return 'pdf-choice:'+paper+':'+record.id;}
  function status(record,text){record.status.textContent=text;}
  function makeButton(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
  async function replace(record,choice,persist=true,rendered=null,canCommit=()=>true){
    const data=rendered||await job({type:'pdf-render',paper,...choice,preview:false});
    const image=new Image();image.className='ab-pdf-image';image.alt=record.label+' · PDF 原图';image.src=data.image;await image.decode();if(!canCommit())return false;
    if(!record.original){record.original=document.createElement('div');record.original.hidden=true;record.original.className='ab-html-artwork';for(const n of [...record.figure.childNodes])if(n!==record.caption)record.original.append(n);record.figure.prepend(record.original);}
    record.image?.remove();record.image=image;
    if(record.label.startsWith('Table'))record.caption.after(image);else record.figure.insertBefore(image,record.caption);
    record.figure.dispatchEvent(new Event('ab-figure-change',{bubbles:true}));
    record.choice=choice;record.showOriginal.hidden=false;record.enlarge.hidden=false;
    image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label','放大 '+record.label+' 的 PDF 原图');image.onclick=()=>showZoom(record);image.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showZoom(record);}};
    status(record,`PDF 第 ${choice.page} 页 · ${choice.manual?'已确认裁剪':'自动裁剪，可调整'}`);
    if(persist)await chrome.storage.local.set({[key(record)]:{...choice,mode:'pdf'}});record.edit.textContent='调整裁剪';return true;
  }
  async function restore(record){
    record.userTouched=true;
    if(record.original){record.image?.remove();record.image=null;record.original.replaceWith(...record.original.childNodes);record.original=null;}
    record.figure.dispatchEvent(new Event('ab-figure-change',{bubbles:true}));
    record.showOriginal.hidden=true;record.enlarge.hidden=true;status(record,'正在显示 HTML 图；可重新选择 PDF 原图。');
    await chrome.storage.local.set({[key(record)]:{mode:'html'}});
  }
  function showZoom(record){
    if(!zoom){zoom=document.createElement('dialog');zoom.className='ab-pdf-dialog ab-pdf-zoom';const header=document.createElement('header');header.append(makeButton('适合窗口 / 原始大小',()=>zoom.classList.toggle('natural')),makeButton('关闭',()=>zoom.close()));const body=document.createElement('div');body.className='ab-zoom-body';const img=new Image();body.append(img);zoom.append(header,body);document.body.append(zoom);}
    zoom.querySelector('img').src=record.image.src;zoom.querySelector('img').alt=record.image.alt;zoom.classList.remove('natural');zoom.showModal();
  }
  function drawClip(){
    const box=$('#pdf-selection');box.style.left=clip[0]*100+'%';box.style.top=clip[1]*100+'%';box.style.width=(clip[2]-clip[0])*100+'%';box.style.height=(clip[3]-clip[1])*100+'%';
    [...dialog.querySelectorAll('[data-bound]')].forEach((el,i)=>el.value=(clip[i]*100).toFixed(1));
  }
  function createDialog(){
    dialog=document.createElement('dialog');dialog.className='ab-pdf-dialog';dialog.id='ab-pdf-crop';
    dialog.innerHTML=`<header><strong id="pdf-title">选择 PDF 原图</strong><button id="pdf-close" type="button">取消</button></header><div class="ab-pdf-toolbar"><button id="pdf-prev" type="button">上一页</button><label>页码 <input id="pdf-page" type="number" min="1" value="1"></label><span id="pdf-total"></span><button id="pdf-next" type="button">下一页</button><button id="pdf-full" type="button">整页</button><button id="pdf-proposal" type="button">建议区域</button></div><p id="pdf-instruction">在页面上拖动框选整张图，保留子图和图例，通常不包含图注。也可修改下方百分比坐标。</p><div id="pdf-stage-scroll"><div id="pdf-stage"><img id="pdf-page-image" alt="PDF 页面预览" draggable="false"><div id="pdf-selection"></div></div></div><footer><div class="ab-pdf-bounds"><label>左 % <input data-bound="0" type="number" min="0" max="100" step="0.1"></label><label>上 % <input data-bound="1" type="number" min="0" max="100" step="0.1"></label><label>右 % <input data-bound="2" type="number" min="0" max="100" step="0.1"></label><label>下 % <input data-bound="3" type="number" min="0" max="100" step="0.1"></label></div><span id="pdf-crop-status" role="status"></span><button id="pdf-apply" type="button">使用这个区域</button></footer>`;
    document.body.append(dialog);
    $('#pdf-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{previewToken++;active=null;});
    $('#pdf-prev').onclick=()=>loadPage(currentPage-1);$('#pdf-next').onclick=()=>loadPage(currentPage+1);$('#pdf-page').onchange=()=>loadPage(Number($('#pdf-page').value));
    $('#pdf-full').onclick=()=>{clip=[0,0,1,1];drawClip();};
    $('#pdf-proposal').onclick=()=>{const c=active?.candidate;if(c){clip=c.clip.slice();loadPage(c.page,true);}};
    for(const input of dialog.querySelectorAll('[data-bound]'))input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value)){clip[Number(input.dataset.bound)]=Math.min(1,Math.max(0,value/100));drawClip();}};
    const stage=$('#pdf-stage');const point=e=>{const r=stage.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
    stage.onpointerdown=e=>{if($('#pdf-apply').disabled)return;e.preventDefault();drag=point(e);stage.setPointerCapture(e.pointerId);clip=[...drag,...drag];drawClip();};
    stage.onpointermove=e=>{if(!drag)return;const p=point(e);clip=[Math.min(drag[0],p[0]),Math.min(drag[1],p[1]),Math.max(drag[0],p[0]),Math.max(drag[1],p[1])];drawClip();};
    stage.onpointerup=stage.onpointercancel=()=>{drag=null;};
    $('#pdf-apply').onclick=async()=>{
      if(!active)return;
      if(clip[2]-clip[0]<.005||clip[3]-clip[1]<.005){$('#pdf-crop-status').textContent='请框选一个完整区域。';return;}
      const record=active,token=previewToken,selected=clip.slice(),page=currentPage;
      $('#pdf-apply').disabled=true;$('#pdf-crop-status').textContent='正在生成清晰原图…';
      try{
        // Keep cancellation reversible: render first, then commit only if still open.
        const data=await job({type:'pdf-render',paper,page,clip:selected,fingerprint:record.fingerprint,preview:false});
        if(active!==record||token!==previewToken)return;
        await replace(record,{page,clip:selected,fingerprint:record.fingerprint,manual:true},true,data,()=>active===record&&token===previewToken);
        dialog.close();
      }catch(e){if(active===record)$('#pdf-crop-status').textContent=e.message;}
      finally{if(active===record)$('#pdf-apply').disabled=false;}
    };
  }
  async function loadPage(page,keepClip=false){
    if(!active)return;const record=active;
    if(!Number.isInteger(page)||page<1||page>record.pageCount){$('#pdf-crop-status').textContent='页码超出范围。';$('#pdf-page').value=currentPage;return;}
    const token=++previewToken;currentPage=page;$('#pdf-page').value=page;$('#pdf-apply').disabled=true;$('#pdf-crop-status').textContent='正在渲染页面…';$('#pdf-stage').hidden=true;
    if(!keepClip)clip=[0,0,1,1];
    try{const data=await job({type:'pdf-render',paper,page,fingerprint:record.fingerprint,preview:true});if(token!==previewToken||active!==record)return;
      const image=$('#pdf-page-image');image.src=data.image;await image.decode();if(token!==previewToken||active!==record)return;
      $('#pdf-stage').hidden=false;drawClip();$('#pdf-stage-scroll').scrollTop=Math.max(0,clip[1]*image.clientHeight-$('#pdf-stage-scroll').clientHeight*.12);$('#pdf-crop-status').textContent='确认裁剪包含完整图表后，点击“使用这个区域”。';$('#pdf-apply').disabled=false;
    }catch(e){if(token===previewToken)$('#pdf-crop-status').textContent=e.message;}
  }
  async function edit(record){
    record.userTouched=true;
    record.edit.disabled=true;
    try{const idx=await getIndex();record.fingerprint=idx.fingerprint;record.pageCount=idx.pageCount;record.candidate=idx.figures[record.label]?.[0];
      if(!dialog)createDialog();active=record;$('#pdf-title').textContent=record.label+' · 选择 PDF 原图';$('#pdf-total').textContent='/ '+idx.pageCount;$('#pdf-page').max=idx.pageCount;
      const selected=record.choice?.fingerprint===idx.fingerprint?record.choice:record.candidate;
      clip=selected?.clip?.slice()||[0,0,1,1];$('#pdf-proposal').disabled=!record.candidate;dialog.showModal();await loadPage(selected?.page||1,true);
    }catch(e){status(record,e.message);}finally{record.edit.disabled=false;}
  }
  async function initialize(){
    const cfg=await AB.message({type:'config'});
    const choices=await chrome.storage.local.get(records.map(key));
    if(!cfg.pdfFigures&&!records.some(r=>choices[key(r)]?.mode==='pdf')){for(const r of records)status(r,'HTML 图 · 可选择 PDF 原图');return;}
    let idx;try{idx=await getIndex();}catch(e){for(const r of records)status(r,e.message);return;}
    for(const r of records){
      if(r.userTouched)continue;
      r.fingerprint=idx.fingerprint;r.pageCount=idx.pageCount;r.candidate=idx.figures[r.label]?.[0];
      const saved=choices[key(r)];
      if(saved?.mode==='html'){status(r,'已选择保留 HTML 图');continue;}
      const choice=saved?.fingerprint===idx.fingerprint&&saved.mode==='pdf'?saved:cfg.pdfFigures&&r.candidate?.confident?{page:r.candidate.page,clip:r.candidate.clip,fingerprint:idx.fingerprint,manual:false}:null;
      if(!choice){status(r,r.candidate?'裁剪边界需确认 · 点击选择 PDF 原图':'未定位到唯一图注 · 可手动选择页码和区域');continue;}
      try{status(r,'正在载入 PDF 原图…');await replace(r,choice,true,null,()=>!r.userTouched);r.edit.textContent='调整裁剪';}catch(e){status(r,e.message);}
    }
  }
  function addSourceLinks(root,id){
    paper=AB.paperId(id);
    // Match the PDF edition to the HTML's own asset paths when the page URL omits vN.
    if(!/v\d+$/.test(paper)){
      const escaped=paper.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const versions=new Set();
      for(const img of root.querySelectorAll('img[src]')){try{const url=new URL(img.src);if(['arxiv.org','ar5iv.labs.arxiv.org','ar5iv.org'].includes(url.hostname)){const match=url.pathname.match(new RegExp('/'+escaped+'(v\\d+)(?:/|$)'));if(match)versions.add(match[1]);}}catch{}}
      if(versions.size===1)paper+=[...versions][0];
    }
    for(const figure of root.querySelectorAll('figure')){
      const caption=figure.querySelector(':scope > figcaption');if(!caption)continue;
      const labelText=caption.querySelector('.ltx_tag_figure,.ltx_tag_table')?.textContent||caption.textContent;
      const match=labelText.match(/\b(Figure|Fig\.?|Table)\s*([A-Za-z]?\d+)/i);if(!match)continue;
      const label=(match[1].toLowerCase()==='table'?'Table':'Figure')+' '+match[2];
      const bar=document.createElement('div');bar.className='ab-figure-tools';const state=document.createElement('span');state.setAttribute('role','status');
      const record={figure,caption,label,id:figure.dataset.sourceId||label,status:state};
      record.edit=makeButton('选择 PDF 原图',()=>edit(record));record.enlarge=makeButton('放大',()=>showZoom(record));record.enlarge.hidden=true;
      record.showOriginal=makeButton('切回 HTML',()=>restore(record).catch(e=>status(record,e.message)));record.showOriginal.hidden=true;
      const link=document.createElement('a');link.href='https://arxiv.org/pdf/'+paper;link.target='_blank';link.rel='noopener noreferrer';link.textContent='原 PDF ↗';
      bar.append(state,record.edit,record.enlarge,record.showOriginal,link);figure.after(bar);status(record,'正在准备 PDF 原图…');records.push(record);
    }
    if(records.length)initialize().catch(e=>{for(const r of records)status(r,e.message);});
  }
  return {addSourceLinks};
})();
