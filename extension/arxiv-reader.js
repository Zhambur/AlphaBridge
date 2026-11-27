/* Read public arXiv source only when the model requests it. */
globalThis.ABArxiv=(()=>{
  function parse(loaded){
    const root=document.createElement('div');root.append(ABDocument.sanitize(loaded.html,loaded.url));
    for(const math of root.querySelectorAll('math'))math.replaceWith(document.createTextNode(' '+(math.getAttribute('alttext')||math.textContent)+' '));
    for(const node of root.querySelectorAll('td,th,.ltx_td,.ltx_th'))node.append(document.createTextNode('\t'));
    for(const node of root.querySelectorAll('p,div,section,article,figure,figcaption,tr,h1,h2,h3,h4,li'))node.append(document.createTextNode('\n'));
    const text=root.textContent.replace(/[\t ]+/g,' ').replace(/\n\s*\n/g,'\n').trim(),parts=[];
    if(!text)throw Error('没有读到可用的论文正文。');
    for(let start=0;start<text.length;){
      let end=Math.min(start+10000,text.length);
      if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+7000)end=boundary+1;}
      parts.push(text.slice(start,end));start=end;
    }
    return {source:loaded.url,abstract:root.querySelector('.ltx_abstract')?.textContent.trim()||'原文未标记摘要',headings:[...root.querySelectorAll('h1,h2,h3,h4')].map(x=>x.textContent.trim()),parts};
  }
  function read(doc,part){
    if(!Number.isInteger(part)||part<0||part>doc.parts.length)throw Error('模型请求的论文分段超出范围。');
    if(part===0)return {source:doc.source,kind:'overview',abstract:doc.abstract,headings:doc.headings,totalParts:doc.parts.length,index:doc.parts.map((text,i)=>({part:i+1,startsWith:text.slice(0,160)})),note:'This is an overview, not the full paper. Read relevant numbered parts before answering. No image pixels are available.'};
    return {source:doc.source,part,totalParts:doc.parts.length,text:doc.parts[part-1]};
  }
  return {parse,read};
})();
