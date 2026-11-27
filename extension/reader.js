'use strict';
const $=s=>document.querySelector(s);
let paper='',title='',source='',blocks=[],notes=[],running=false,stop=false,draft=null,selectedRange=null;
const ranges=new Map();
function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
$('#close').onclick=()=>{if(window.parent!==window)window.parent.postMessage({type:'alphabridge-close'},'https://www.alphaxiv.org');else window.close();};
// Both canonical alphaXiv host spellings can embed the reader.
if(document.referrer.startsWith('https://alphaxiv.org/'))$('#close').onclick=()=>window.parent.postMessage({type:'alphabridge-close'},'https://alphaxiv.org');
$('#settings').onclick=()=>AB.message({type:'options'});
$('#toggle').onclick=()=>{const hidden=document.body.classList.toggle('original-only');$('#toggle').textContent=hidden?'显示译文':'隐藏译文';};
let localDrafts=[],draftQueue=Promise.resolve(),pendingSelection=null;
function persistDrafts(){const snapshot=structuredClone(localDrafts);draftQueue=draftQueue.catch(()=>{}).then(()=>chrome.storage.local.set({['annotation-drafts:'+paper]:snapshot})).catch(()=>{$('#draft-status').textContent='草稿保存失败，请勿关闭页面';});}
function stashDraft(){if(!draft||draft.exported)return;draft.thought=$('#thought').value;const i=localDrafts.findIndex(n=>n.id===draft.id);if(i<0)localDrafts.push({...draft});else localDrafts[i]={...draft};persistDrafts();renderNotes();}
function closeNotes(){stashDraft();$('#notes').hidden=true;$('#annotate-selection').hidden=true;document.body.classList.remove('notes-open');}
function openNotes(){ABChat.setOpen(false);$('#notes').hidden=false;document.body.classList.add('notes-open');$('#annotate-selection').hidden=true;}
globalThis.ABAnnotations={close:closeNotes};
$('#notes-toggle').onclick=()=>{if($('#notes').hidden)openNotes();else closeNotes();};
$('#notes-close').onclick=closeNotes;$('#notes-ai').onclick=()=>ABChat.setOpen(true);
$('#thought').oninput=stashDraft;
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#notes,#annotate-selection,#notes-toggle'))closeNotes();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNotes();$('#annotate-selection').hidden=true;}});


async function translate(){
  if(running){stop=true;$('#translate').textContent='正在暂停…';return;}
  if(!blocks.length)return;
  running=true;stop=false;$('#translate').textContent='暂停翻译';
  try{
    const pending=blocks.filter(b=>b.translation.hidden);
    for(let i=0;i<pending.length;){
      if(stop)break;
      const batch=[];let size=0;
      while(i<pending.length&&batch.length<8&&(!batch.length||size+pending[i].text.length<7000)){batch.push(pending[i]);size+=pending[i++].text.length;}
      notice(`逐句翻译中：${blocks.filter(b=>!b.translation.hidden).length}/${blocks.length} 句。图、表和公式保留在正文中。`);
      const result=await AB.message({type:'translate',blocks:batch.map(({id,text})=>({id,text}))});
      for(const b of batch)ABDocument.renderTranslation(b,result[b.id]);
      restoreHighlights();
    }
    const n=blocks.filter(b=>!b.translation.hidden).length;
    notice(`${stop?'翻译已暂停':'翻译完成'}：${n}/${blocks.length} 句。译文保存在此浏览器中；选中文字即可批注。`);
  }catch(e){notice(e.message,true);}finally{running=false;$('#translate').textContent='翻译 / 继续';}
}
$('#translate').onclick=translate;

function selectionAnchor(range){
  const el=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  const anchor=el.closest('.pb-source,.pb-translation,[id]');
  if(!anchor)return {};
  const before=range.cloneRange();before.selectNodeContents(anchor);before.setEnd(range.startContainer,range.startOffset);
  return {anchor:anchor.closest('.pb-sentence')?.id||anchor.id,side:anchor.classList.contains('pb-translation')?'translation':'source',offset:before.toString().length};
}
function editNote(note,range=null){
  stashDraft();draft={...note};selectedRange=range||ranges.get(note.id)||null;
  $('#selected').textContent=draft.quote;$('#thought').value=draft.thought||'';
  $('#thought').readOnly=!!draft.exported;$('#save-status').textContent=draft.exported?'已保存；可在 Obsidian 中继续修改。':'';
  $('#discard-draft').hidden=!!draft.exported;$('#discard-draft').disabled=false;$('#save').hidden=!!draft.exported;$('#save').disabled=false;$('#open-note').hidden=!draft.exported;
  if(draft.uri)$('#open-note').href=draft.uri;
  $('#annotation').hidden=false;openNotes();
  if(!draft.exported){stashDraft();$('#thought').focus({preventScroll:true});}
  const anchor=document.getElementById(draft.anchor);if(anchor)anchor.scrollIntoView({block:'center'});
}
function updateSelection(){
  if(document.body.classList.contains('chat-open')||$('#notes').contains(document.activeElement))return;
  const s=getSelection(),quote=s?.toString().trim(),button=$('#annotate-selection');
  if(!quote||quote.length<2||quote.length>50000||!$('#document').contains(s.anchorNode)||!$('#document').contains(s.focusNode)){button.hidden=true;pendingSelection=null;return;}
  const range=s.getRangeAt(0).cloneRange();pendingSelection={range,quote};const r=range.getBoundingClientRect();
  button.style.left=Math.max(8,Math.min(r.right-56,innerWidth-70))+'px';button.style.top=Math.max(64,Math.min(r.bottom+5,innerHeight-42))+'px';button.hidden=false;
}
document.addEventListener('selectionchange',updateSelection);
window.addEventListener('scroll',()=>{$('#annotate-selection').hidden=true;},true);
$('#paper').addEventListener('pointerup',e=>{
  if(e.target.closest('button,a,.ab-figure-tools,.ab-pdf-image'))return;
  setTimeout(()=>{
    updateSelection();if(getSelection()?.toString().trim()||document.body.classList.contains('chat-open'))return;
    for(const n of notes){const r=ranges.get(n.id);if(r&&[...r.getClientRects()].some(b=>e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom)){editNote(n,r);break;}}
  },25);
});
$('#annotate-selection').onpointerdown=e=>e.preventDefault();
$('#annotate-selection').onclick=()=>{
  if(!pendingSelection)return;const {range,quote}=pendingSelection,anchor=selectionAnchor(range),block=blocks.find(b=>b.id===anchor.anchor);
  const existing=localDrafts.find(n=>n.quote===quote&&n.anchor===anchor.anchor&&n.offset===anchor.offset);
  editNote(existing||{id:crypto.randomUUID(),paper,title,source,quote,thought:'',at:new Date().toISOString(),...anchor,location:block?.section?'正文位置 '+block.section:'正文选区',section:block?.section||''},range);
};
$('#cancel').onclick=closeNotes;
const savingNotes=new Set();
async function discardDraft(id){
  if(savingNotes.has(id))return;
  try{
    await AB.message({type:'discard-draft',paper,id});
    if(draft?.id===id){draft=null;selectedRange=null;$('#annotation').hidden=true;$('#thought').value='';pendingSelection=null;getSelection()?.removeAllRanges();$('#annotate-selection').hidden=true;}
    localDrafts=localDrafts.filter(n=>n.id!==id);notes=notes.filter(n=>n.id!==id);ranges.delete(id);
    persistDrafts();await draftQueue;renderNotes();restoreHighlights();
    $('#draft-status').textContent='草稿已丢弃';
  }catch(e){$('#draft-status').textContent=e.message;}
}
$('#discard-draft').onclick=()=>{if(draft)void discardDraft(draft.id);};
$('#save').onclick=async()=>{
  if(!draft)return;stashDraft();const submitted={...draft},range=selectedRange?.cloneRange();savingNotes.add(submitted.id);$('#discard-draft').disabled=true;$('#save').disabled=true;$('#thought').readOnly=true;$('#save-status').textContent='正在保存…';
  try{
    const saved=await AB.message({type:'save-note',note:submitted});notes=await AB.message({type:'notes',paper});
    if(range)ranges.set(saved.id,range);
    if(draft?.id===submitted.id){draft=null;$('#annotation').hidden=true;closeNotes();}
    localDrafts=localDrafts.filter(n=>n.id!==submitted.id);persistDrafts();renderNotes();restoreHighlights();notice('批注已保存到 Obsidian；点击高亮可查看。');
  }catch(e){if(draft?.id===submitted.id){$('#save-status').textContent=e.message;$('#thought').readOnly=false;}notes=await AB.message({type:'notes',paper});renderNotes();}finally{savingNotes.delete(submitted.id);if(draft?.id===submitted.id){$('#save').disabled=false;$('#discard-draft').disabled=false;}}
};
function findRange(root,quote,offset){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let text='';
  while(walker.nextNode()){nodes.push({node:walker.currentNode,start:text.length});text+=walker.currentNode.textContent;}
  let start=typeof offset==='number'&&text.slice(offset,offset+quote.length)===quote?offset:text.indexOf(quote);
  if(start<0)return null;const end=start+quote.length,r=document.createRange();
  for(const x of nodes){const max=x.start+x.node.length;if(start>=x.start&&start<max)r.setStart(x.node,start-x.start);if(end>x.start&&end<=max){r.setEnd(x.node,end-x.start);return r;}}
  return null;
}
function restoreHighlights(){
  if(!CSS.highlights)return;
  for(const n of notes){
    if(ranges.get(n.id)?.startContainer.isConnected)continue;
    const sentence=document.getElementById(n.anchor||'');if(!sentence)continue;
    const root=sentence.querySelector(n.side==='translation'?'.pb-translation':'.pb-source')||sentence;
    const r=findRange(root,n.quote,n.offset);if(r)ranges.set(n.id,r);
  }
  CSS.highlights.set('ab-notes',new Highlight(...[...ranges.values()].filter(r=>r.startContainer.isConnected)));
}
function renderNotes(){
  $('#note-count').textContent=notes.length;$('#note-list').replaceChildren();
  for(const n of [...localDrafts.filter(d=>!notes.some(n=>n.id===d.id)),...notes]){
    const box=document.createElement('section');box.className='saved-note';const quote=document.createElement('blockquote');quote.textContent=n.quote;const thought=document.createElement('p');thought.textContent=n.thought||'未写批注';box.append(quote,thought);
    const view=document.createElement('button');view.textContent=n.exported?'查看批注':'继续编辑';view.onclick=()=>editNote(n);box.append(view);
    if(!n.exported){const discard=document.createElement('button');discard.textContent='丢弃草稿';discard.disabled=savingNotes.has(n.id);discard.onclick=()=>discardDraft(n.id);box.append(discard);}
    if(n.exported){const a=document.createElement('a');a.href=n.uri;a.textContent='在 Obsidian 打开 ↗';box.append(a);}else if(notes.some(item=>item.id===n.id)){const b=document.createElement('button');b.textContent='草稿 · 重试保存';b.onclick=async()=>{try{await AB.message({type:'save-note',note:n});notes=await AB.message({type:'notes',paper});renderNotes();}catch(e){notice(e.message,true);}};box.append(b);}
    const locate=document.createElement('button');locate.textContent='定位';locate.onclick=()=>document.getElementById(n.anchor)?.scrollIntoView({behavior:'smooth',block:'center'});box.append(locate);$('#note-list').append(box);
  }
}
function monitorImages(container){
  const failed=new Set();
  function report(){
    const visible=node=>!node.closest('.ab-html-artwork[hidden]');
    const n=[...failed].filter(visible).length+[...container.querySelectorAll('.ab-unsupported-media')].filter(visible).length;$('#media-status').hidden=!n;
    $('#media-status').textContent=`有 ${n} 处原文图片或嵌入内容未能显示；这与翻译进度无关，请检查网络或打开原文核对。`;
  }
  container.addEventListener('ab-figure-change',report);
  report();
  for(const img of container.querySelectorAll('img')){
    const original=img.getAttribute('src');let retrying=false,retried=false,placeholder=null;
    const loaded=()=>{failed.delete(img);placeholder?.remove();report();};
    const markFailed=()=>{
      failed.add(img);
      if(!placeholder){placeholder=document.createElement('span');placeholder.className='ab-media-failure';placeholder.textContent='原文图片未能加载。';
        if(original){const a=document.createElement('a');a.href=original;a.target='_blank';a.rel='noreferrer';a.textContent='打开原图 ↗';placeholder.append(' ',a);}
        img.after(placeholder);
      }
      report();
    };
    const error=async()=>{
      if(retrying)return;
      if(retried||!original){markFailed();return;}
      retrying=true;retried=true;
      try{const data=await AB.message({type:'asset',url:original});retrying=false;img.src=data;}
      catch{retrying=false;markFailed();}
    };
    img.addEventListener('load',loaded);img.addEventListener('error',error);
    // A cached or blocked image may have already failed before handlers were attached.
    if(img.complete){if(img.naturalWidth)loaded();else void error();}
  }
}
(async()=>{
  try{
    paper=AB.paperId(new URL(location.href).searchParams.get('paper'));
    localDrafts=(await chrome.storage.local.get('annotation-drafts:'+paper))['annotation-drafts:'+paper]||[];
    const loaded=await AB.message({type:'paper',id:paper});source=loaded.url;
    $('#document').append(ABDocument.sanitize(loaded.html,source));
    title=$('#document .ltx_title_document')?.textContent.trim()||paper;document.title=title+' · AlphaBridge';
    const meta=document.createElement('span');meta.textContent='保留结构化原文的图、表、公式和引用；HTML 会随窗口重新排版，不对应 PDF 页码。 ';
    const link=document.createElement('a');link.href=source;link.target='_blank';link.rel='noreferrer';link.textContent='查看原文 HTML ↗';$('#meta').append(meta,link);
    // Restrict internal navigation to the sanitized document, without losing the reader URL.
    $('#document').addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a){e.preventDefault();document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))?.scrollIntoView({behavior:'smooth'});}});
    ABChat.setPaper({paper,title,source},$('#document'));
    blocks=ABDocument.prepare($('#document'));monitorImages($('#document'));ABFigures.addSourceLinks($('#document'),paper);notes=await AB.message({type:'notes',paper});renderNotes();restoreHighlights();
    notice(`原文已载入，可划词批注。${blocks.length} 句可翻译；表格与公式不拆成孤立词条。`);
    const cfg=await AB.message({type:'config'});
    if(cfg.autoTranslate&&cfg.url&&cfg.model)await translate();
    else if(!cfg.url||!cfg.model)notice('原文已载入。翻译服务尚未配置；点击“设置”填写后，可开始全文翻译。');
  }catch(e){notice(e.message,true);$('#translate').disabled=true;}
})();
