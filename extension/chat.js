'use strict';
globalThis.ABChat=(()=>{
  const el=id=>document.getElementById(id);
  let ready=false,metadata={},quote='',history=[],busy=false;
  const drawer=el('chat-drawer'),question=el('chat-question');
  function setQuote(text){quote=text;el('chat-quote').textContent=text;el('chat-quote-box').hidden=!text;}
  function syncSelection(){
    // Moving into the composer must not discard the quote just selected in the paper.
    if(drawer.contains(document.activeElement))return;
    const s=window.getSelection(),paper=el('document');
    setQuote(s&&!s.isCollapsed&&paper.contains(s.anchorNode)&&paper.contains(s.focusNode)?s.toString().trim():'');
  }
  document.addEventListener('selectionchange',syncSelection);
  el('paper').addEventListener('pointerup',syncSelection);
  function toggle(open){
    drawer.hidden=!open;document.body.classList.toggle('chat-open',open);
    el('chat-toggle').setAttribute('aria-expanded',String(open));
    if(open){globalThis.ABAnnotations?.close();syncSelection();}
  }
  el('chat-toggle').onclick=()=>toggle(drawer.hidden);
  el('chat-close').onclick=()=>{toggle(false);el('chat-toggle').focus();};
  drawer.addEventListener('keydown',e=>{if(e.key==='Escape'){toggle(false);el('chat-toggle').focus();}});
  el('chat-unquote').onclick=()=>{setQuote('');window.getSelection()?.removeAllRanges();};
  function append(role,text,selected=''){
    const node=document.createElement('section');node.className='chat-message '+role;
    const label=document.createElement('strong');label.textContent=role==='user'?'你':'AI';node.append(label);
    if(selected){const q=document.createElement('blockquote');q.textContent=selected;node.append(q);}
    const body=document.createElement('div');body.className='chat-answer';if(role==='assistant')ABChatMarkdown.render(body,text);else body.textContent=text;node.append(body);
    el('chat-messages').append(node);node.scrollIntoView({block:'nearest'});return node;
  }
  el('chat-new').onclick=()=>{
    if(busy)return;
    history=[];el('chat-messages').replaceChildren();el('chat-status').textContent='已开始新对话，仍使用当前论文的 arXiv 编号。';
  };
  question.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();el('chat-form').requestSubmit();}});
  el('chat-form').onsubmit=async e=>{
    e.preventDefault();if(busy||!ready)return;
    const prompt=question.value.trim(),selected=quote;if(!prompt){question.focus();return;}
    busy=true;question.disabled=true;el('chat-send').disabled=true;el('chat-new').disabled=true;
    el('chat-messages').querySelector('.chat-empty')?.remove();const pending=append('user',prompt,selected);
    el('chat-status').textContent='正在请求 AI 按 arXiv 编号读取论文…';
    try{
      const steps=[],readParts=new Set();let result,documentData=null,overviewRead=false;
      for(let round=0;round<12;round++){
        result=await AB.message({type:'chat',...metadata,history,question:prompt,quote:selected,steps,hasRead:readParts.size>0});
        if(result.answer)break;
        steps.push(result.assistant);
        for(const call of result.assistant.tool_calls){
          let args;try{args=JSON.parse(call.function.arguments);}catch{throw Error('模型返回的取文参数无效。');}
          if(AB.paperId(args.arxiv_id)!==metadata.paper)throw Error('模型请求了其他论文，已停止；当前只读取本篇论文。');
          if(!Number.isInteger(args.part)||args.part<0)throw Error('模型请求的论文分段无效。');
          if(!documentData){
            el('chat-status').textContent='AI 正在通过 arXiv 编号获取原文…';
            const loaded=await AB.message({type:'paper',id:metadata.paper});
            documentData=ABArxiv.parse(loaded);
          }
          if(args.part>0&&!overviewRead)throw Error('模型未先读取论文目录，请重试。');
          const value=ABArxiv.read(documentData,args.part);
          if(args.part===0)overviewRead=true;
          if(args.part>0)readParts.add(args.part);
          steps.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(value)});
          el('chat-status').textContent=`已读取摘要与目录；已读 ${readParts.size} / ${documentData.parts.length} 个正文分段，AI 正在继续阅读或回答…`;
        }
        result=null;
      }
      if(!result?.answer)throw Error('已达到本轮读取次数上限，尚未生成回答；请缩小问题范围。');
      history.push({role:'user',content:result.user},{role:'assistant',content:result.answer});
      append('assistant',result.answer);question.value='';el('chat-status').textContent=`本次读取：arXiv ${metadata.paper}，正文分段 ${[...readParts].sort((a,b)=>a-b).join('、')} / 共 ${documentData.parts.length} 段。`;
    }catch(error){pending.remove();el('chat-status').textContent=error.message+' 问题已保留，可重试。';}
    finally{busy=false;question.disabled=false;el('chat-send').disabled=false;el('chat-new').disabled=false;}
  };
  function setPaper(meta){
    metadata=meta;ready=true;
    el('chat-context').textContent=`arXiv ${meta.paper} · AI 按需读取原文，不预先发送全文。`;
    el('chat-send').disabled=false;
  }
  return {setPaper,setOpen:toggle};
})();
