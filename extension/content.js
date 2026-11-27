(() => {
  const host=document.createElement('div');host.id='alphabridge-tools';
  const root=host.attachShadow({mode:'open'});document.documentElement.append(host);
  root.innerHTML=`<style>
    :host{all:initial}*{box-sizing:border-box}button,input,textarea{font:14px system-ui}
    button{cursor:pointer;border:1px solid #cdd9d4;border-radius:8px;background:white;color:#214f42;padding:9px 13px}button:hover{background:#edf5f0}
    #dock{position:fixed;right:22px;bottom:22px;display:flex;gap:6px;z-index:2147483640;font:13px system-ui}
    #hint{position:fixed;right:22px;bottom:70px;max-width:340px;background:#fff7dd;color:#443a24;padding:12px;border-radius:10px;z-index:2147483641;font:14px/1.6 system-ui}
    #annotate{position:fixed;z-index:2147483642;padding:5px 9px;font:12px system-ui;box-shadow:0 2px 8px #0002}#note{position:fixed;right:12px;top:12px;bottom:80px;width:min(350px,calc(100vw - 24px));overflow:auto;background:white;color:#23382e;box-shadow:0 8px 40px #0003;border:1px solid #d4dfd9;border-radius:12px;padding:14px;z-index:2147483642;font:14px/1.6 system-ui}
    textarea{width:100%;min-height:90px;resize:vertical;margin:10px 0;padding:8px;border:1px solid #cad6cf;border-radius:6px}blockquote{margin:0;max-height:110px;overflow:auto;white-space:pre-wrap;color:#5b675f;font-size:13px}#saved{position:fixed;right:22px;bottom:75px;width:340px;max-height:70vh;overflow:auto;background:white;padding:18px;border:1px solid #d4dfd9;border-radius:12px;z-index:2147483643;font:14px/1.6 system-ui;color:#23382e}#saved section{padding:12px 0;border-bottom:1px solid #d4dfd9}#saved p{white-space:pre-wrap}#status{font-size:12px;margin:8px 0}#save{background:#285f4e;color:white}a{color:#285f4e}
    #overlay{position:fixed;inset:0;z-index:2147483645;background:#f5f5f1}iframe{width:100%;height:100%;border:0}[hidden]{display:none!important}
  </style><div id="dock"><button id="read">双语原文</button><button id="saved-toggle">批注</button><button id="settings" title="AlphaBridge 设置">⚙</button></div><div id="hint" hidden></div><button id="annotate" hidden>AlphaBridge · 批注</button><div id="note" hidden><strong>AlphaBridge 批注</strong><blockquote id="quote"></blockquote><textarea id="thought" placeholder="写下你的批注（可留空）"></textarea><div id="status"></div><button id="save">保存到 Obsidian</button> <button id="dismiss">收起</button> <button id="discard">丢弃草稿</button><a id="open" hidden>打开笔记 ↗</a></div><aside id="saved" hidden></aside><div id="overlay" hidden><iframe title="AlphaBridge 双语原文"></iframe></div>`;
  const $=s=>root.querySelector(s);let draft=null,selectionRange=null,pending=null,lastUrl='',saving=false;
  let writes=Promise.resolve();
  function storeDraft(note,remove=false){if(!note)return writes;const snapshot={...note};writes=writes.then(async()=>{await AB.message({type:'host-draft-write',note:snapshot,remove});}).catch(e=>hint(e.message));return writes;}
  function closeNote(){$('#note').hidden=true;}
  function hideTrigger(){pending=null;$('#annotate').hidden=true;}
  function edit(note,range=null){draft={...note};selectionRange=range;$('#quote').textContent=note.quote;$('#thought').value=note.thought||'';$('#status').textContent='';$('#open').hidden=true;$('#save').hidden=false;$('#discard').hidden=false;$('#save').disabled=saving;$('#discard').disabled=saving;$('#note').hidden=false;$('#saved').hidden=true;hideTrigger();$('#thought').focus();}
  $('#thought').oninput=()=>{if(draft&&!saving){draft.thought=$('#thought').value;storeDraft(draft);}};
  function hint(text){$('#hint').textContent=text;$('#hint').hidden=false;setTimeout(()=>$('#hint').hidden=true,10000);}
  function currentPaper(){try{return AB.paperId(location.href);}catch{return location.pathname;}}
  function update(){if(lastUrl===location.href)return;lastUrl=location.href;hideTrigger();draft=null;selectionRange=null;$('#overlay').hidden=true;$('#overlay iframe').removeAttribute('src');$('#note').hidden=true;$('#saved').hidden=true;$('#dock').hidden=!/\/(abs|pdf|overview|private)\//.test(location.pathname);}
  setInterval(update,700);update();
  function open(){try{const id=AB.paperId(location.href);$('#overlay iframe').src=AB.extensionURL('reader.html')+'?paper='+encodeURIComponent(id);$('#overlay').hidden=false;}catch(e){hint(e.message);}}
  $('#read').onclick=open;$('#settings').onclick=()=>AB.message({type:'options'}).catch(e=>hint(e.message));
  chrome.runtime.onMessage.addListener(m=>{if(m.type==='open-reader')open();});
  const extensionOrigin=new URL(AB.extensionURL()).origin;
  window.addEventListener('message',e=>{if(e.source===$('#overlay iframe').contentWindow&&e.origin===extensionOrigin&&e.data?.type==='alphabridge-close'){$('#overlay').hidden=true;$('#overlay iframe').removeAttribute('src');}});
  function selectionChanged(){
    if(!$('#overlay').hidden||!$('#note').hidden||$('#dock').hidden)return;
    const selection=window.getSelection(),quote=selection?.toString().trim();
    const node=selection?.anchorNode,element=node?.nodeType===1?node:node?.parentElement;
    if(!quote||quote.length<2||quote.length>50000||!selection.rangeCount||element?.closest('input,textarea,[contenteditable="true"]')||node?.getRootNode()===root){hideTrigger();return;}
    const range=selection.getRangeAt(0).cloneRange(),box=range.getBoundingClientRect();
    pending={quote,range,paper:currentPaper()};
    $('#annotate').style.left=Math.max(8,Math.min(box.right+8,innerWidth-160))+'px';
    $('#annotate').style.top=Math.max(8,Math.min(box.bottom+8,innerHeight-40))+'px';$('#annotate').hidden=false;
  }
  document.addEventListener('selectionchange',selectionChanged);
  document.addEventListener('pointerup',e=>{if(!e.composedPath().includes(host))setTimeout(selectionChanged,20);});
  document.addEventListener('pointerdown',e=>{if(!e.composedPath().includes(host)){closeNote();$('#saved').hidden=true;hideTrigger();}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNote();$('#saved').hidden=true;hideTrigger();}});
  document.addEventListener('scroll',hideTrigger,true);window.addEventListener('resize',hideTrigger);
  $('#annotate').onpointerdown=e=>e.preventDefault();
  $('#annotate').onclick=()=>{
    if(!pending||saving)return;
    const {quote,range,paper}=pending;
    const note={id:crypto.randomUUID(),paper,title:document.title.replace(/\s*[|–-]\s*alphaXiv.*$/i,''),source:location.href,quote,thought:'',at:new Date().toISOString(),location:'alphaXiv 页面选区'};
    storeDraft(note);edit(note,range);
  };
  async function savedNotes(){
    const paper=currentPaper();await writes;const saved=await AB.message({type:'notes',paper});const local=await AB.message({type:'host-drafts',paper});const notes=[...saved.map(n=>n.exported?n:(local.find(d=>d.id===n.id)||n)),...local.filter(n=>!saved.some(s=>s.id===n.id))];if(paper!==currentPaper())return;$('#saved').replaceChildren();
    const h=document.createElement('strong');h.textContent='摘录与批注';$('#saved').append(h);
    if(!notes.length){const p=document.createElement('p');p.textContent='选中文字，即可写批注并保存。';$('#saved').append(p);}
    for(const n of notes){const box=document.createElement('section'),q=document.createElement('blockquote'),p=document.createElement('p');q.textContent=n.quote;p.textContent=n.thought||'未写批注';box.append(q,p);
      if(n.exported){const a=document.createElement('a');a.href=n.uri;a.textContent='在 Obsidian 打开 ↗';box.append(a);}
      else{const b=document.createElement('button');b.textContent='继续编辑';b.onclick=()=>{if(!saving)edit(n);};const d=document.createElement('button');d.textContent='丢弃草稿';d.onclick=async()=>{if(saving)return;try{await storeDraft(n,true);if(draft?.id===n.id)draft=null;await savedNotes();}catch(e){hint(e.message);}};box.append(b,d);}
      $('#saved').append(box);
    }
  }
  $('#saved-toggle').onclick=async()=>{closeNote();hideTrigger();$('#saved').hidden=!$('#saved').hidden;if(!$('#saved').hidden){try{await savedNotes();}catch(e){hint(e.message);}}};
  $('#dismiss').onclick=closeNote;
  $('#discard').onclick=async()=>{if(!draft||saving)return;const note=draft;try{await storeDraft(note,true);if(draft?.id===note.id){draft=null;closeNote();hideTrigger();}hint('草稿已丢弃');}catch(e){hint(e.message);}};
  $('#save').onclick=async()=>{
    if(!draft||saving)return;const note={...draft,thought:$('#thought').value},range=selectionRange;saving=true;$('#save').disabled=true;$('#discard').disabled=true;$('#thought').readOnly=true;$('#status').textContent='正在保存…';
    try{await AB.message({type:'save-note',note});await storeDraft(note,true);
      if(draft?.id===note.id){draft=null;closeNote();}
      hint('已保存到 Obsidian');
      if(range&&note.paper===currentPaper()&&CSS.highlights){CSS.highlights.set('alphabridge-selection',new Highlight(range));}
    }catch(e){if(draft?.id===note.id)$('#status').textContent=e.message;else hint(e.message);}finally{saving=false;$('#save').disabled=false;$('#discard').disabled=false;$('#thought').readOnly=false;}
  };
})();
