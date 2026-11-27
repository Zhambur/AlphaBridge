/* Keep the LaTeXML structure, MathML, figures, tables and cross-references. */
globalThis.ABDocument = (()=>{
  const atomic='math,svg,.ltx_Math,.ltx_ref,.ltx_cite,.ltx_note';
  const sourceHosts=new Set(['arxiv.org','ar5iv.labs.arxiv.org','ar5iv.org']);
  function imageURL(value,base){
    try{const u=new URL(value,base);return u.protocol==='https:'&&sourceHosts.has(u.hostname)?u.href:null;}catch{return null;}
  }
  function normalizeTables(root){
    function retag(el,tag){
      if(el.localName===tag)return el;
      const replacement=document.createElement(tag);
      for(const a of el.attributes)replacement.setAttribute(a.name,a.value);
      replacement.append(...el.childNodes);el.replaceWith(replacement);return replacement;
    }
    // CSS display:table-cell on a span cannot implement colspan or rowspan.
    // LaTeXML records those values in classes; translate that metadata to HTML.
    // Run after sanitization, so an HTML reparse cannot eject a table from its
    // paragraph wrapper. Work inside-out to preserve nested tables.
    for(const table of [...root.querySelectorAll('.ltx_tabular')].reverse()){
      if(table.localName==='table')continue;
      for(const row of [...table.querySelectorAll('.ltx_tr')].filter(r=>r.closest('.ltx_tabular')===table)){
        for(const cell of [...row.children].filter(c=>c.matches('.ltx_td,.ltx_th'))){
          const td=retag(cell,cell.classList.contains('ltx_th')?'th':'td');
          for(const name of ['colspan','rowspan']){
            const cls=[...td.classList].find(c=>new RegExp('^ltx_'+name+'_\\d+$').test(c));
            if(cls){const value=Number(cls.split('_').pop());if(value>=1&&value<=1000)td.setAttribute(name,String(value));}
          }
        }
        retag(row,'tr');
      }
      for(const group of [...table.querySelectorAll('.ltx_thead,.ltx_tbody,.ltx_tfoot')].filter(g=>g.closest('.ltx_tabular')===table)){
        retag(group,group.classList.contains('ltx_thead')?'thead':group.classList.contains('ltx_tfoot')?'tfoot':'tbody');
      }
      retag(table,'table').classList.add('ab-native-table');
    }
  }
  function normalizeTextBoxes(root){
    // Only a single HTML text region inside one rounded rectangle (possibly
    // painted twice). Complex diagrams and all media stay in the SVG pipeline.
    for(const svg of root.querySelectorAll('svg.ltx_picture')){
      const objects=svg.querySelectorAll('foreignObject'),paths=[...svg.querySelectorAll('path')];
      if(objects.length!==1||!paths.length||svg.closest('figure'))continue;
      if([...svg.querySelectorAll('*')].some(n=>!n.closest('foreignObject')&&!['g','path','foreignObject'].includes(n.localName)))continue;
      const shape=paths[0].getAttribute('d')||'';
      if(paths.some(p=>p.getAttribute('d')!==shape)||shape.replace(/[^a-zA-Z]/g,'')!=='MLCLCLCLCZ')continue;
      const content=objects[0];
      if(content.querySelector('img,svg,math,table,.ltx_tabular')||!content.textContent.trim())continue;
      const box=document.createElement('div');box.className='ab-text-callout';
      if(svg.id)box.id=svg.id;
      box.append(...content.childNodes);
      // Strip coordinate-dependent wrappers and source black-on-black colors.
      for(const el of box.querySelectorAll('*')){
        el.removeAttribute('style');el.classList.remove('ltx_foreignobject_container','ltx_foreignobject_content','ltx_inline-block','ltx_minipage','ltx_align_bottom');
      }
      svg.replaceWith(box);
    }
  }
  function sanitize(html,url){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const article=doc.querySelector('article.ltx_document');
    if(!article)throw Error('原文缺少可识别的正文结构');
    // LaTeXML embeds many vector figures as <object>. Render them as inert images
    // before forbidding active embedded documents; never enable <object> itself.
    for(const object of article.querySelectorAll('object')){
      const src=imageURL(object.getAttribute('data')||'',url);
      if(src&&/^image\/(?:svg\+xml|png|jpeg|webp|gif)$/i.test(object.getAttribute('type')||'')){
        const img=doc.createElement('img');
        for(const attr of ['id','class','width','height','style'])if(object.hasAttribute(attr))img.setAttribute(attr,object.getAttribute(attr));
        img.src=src;img.alt='原文图示';object.replaceWith(img);
      }else{
        const missing=doc.createElement('span');missing.className='ab-unsupported-media';missing.textContent='此嵌入内容暂无法显示，请查看原文。';object.replaceWith(missing);
      }
    }
    // Normalize URLs before sanitization; only public paper-source assets survive.
    for(const el of article.querySelectorAll('*')){
      for(const a of [...el.attributes])if(/^on/i.test(a.name)||['srcset','srcdoc','formaction','xlink:href'].includes(a.name))el.removeAttribute(a.name);
      if(el.hasAttribute('style')&&/url\s*\(|@import|expression|position\s*:\s*fixed/i.test(el.getAttribute('style')))el.removeAttribute('style');
      if(el.hasAttribute('href')){
        const raw=el.getAttribute('href');
        try{const u=new URL(raw,url);if(!['http:','https:'].includes(u.protocol))el.removeAttribute('href');else if(raw.startsWith('#'))el.setAttribute('href',raw);else{el.setAttribute('href',u.href);el.setAttribute('target','_blank');el.setAttribute('rel','noreferrer noopener');}}catch{el.removeAttribute('href');}
      }
      if(el.hasAttribute('src')){
        try{const u=new URL(el.getAttribute('src'),url);if(u.protocol==='https:'&&['arxiv.org','ar5iv.labs.arxiv.org','ar5iv.org'].includes(u.hostname))el.setAttribute('src',u.href);else el.removeAttribute('src');}catch{el.removeAttribute('src');}
      }
    }
    // LaTeXML/TikZ figures put labels, MathML and photos in SVG foreignObject.
    // Allow this HTML integration point while still sanitizing every descendant.
    // Allowing the tag alone keeps empty boxes: its HTML children need the explicit
    // integration-point setting too. Scripts, frames and event handlers stay banned.
    const clean=DOMPurify.sanitize(article.outerHTML,{USE_PROFILES:{html:true,mathMl:true,svg:true},ADD_TAGS:['foreignObject'],HTML_INTEGRATION_POINTS:{foreignobject:true},FORBID_TAGS:['script','style','iframe','object','embed','form','input','button','textarea','video','audio','link','meta','base'],FORBID_ATTR:['srcset','srcdoc'],ADD_ATTR:['alttext'],RETURN_DOM_FRAGMENT:true});
    normalizeTables(clean);
    normalizeTextBoxes(clean);
    // Keep source IDs separate from the extension controls and generated sentence IDs.
    for(const el of clean.querySelectorAll('[id]')){el.dataset.sourceId=el.id;el.id='paper-'+el.id;}
    for(const a of clean.querySelectorAll('a[href^="#"]'))a.setAttribute('href','#paper-'+a.getAttribute('href').slice(1));
    return clean;
  }
  function projection(element){
    const units=[];let text='';
    function walk(n){
      if(n.nodeType===Node.TEXT_NODE){const s=n.nodeValue;if(s){units.push({node:n,start:text.length,end:text.length+s.length,atom:false});text+=s;}return;}
      if(n.nodeType!==Node.ELEMENT_NODE)return;
      if(n.matches(atomic)){units.push({node:n,start:text.length,end:text.length+1,atom:true});text+='\uFFFC';return;}
      for(const child of n.childNodes)walk(child);
    }
    for(const n of element.childNodes)walk(n);
    function boundary(offset,end=false){
      if(offset>=text.length)return [element,element.childNodes.length];
      const u=units.find(u=>offset>=u.start&&offset<u.end);
      if(!u)return [element,0];
      if(u.atom){const i=[...u.node.parentNode.childNodes].indexOf(u.node);return [u.node.parentNode,i+(end&&offset>u.start?1:0)];}
      return [u.node,offset-u.start];
    }
    return {text,boundary};
  }
  function slices(text){
    const segments=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(x=>({start:x.index,end:x.index+x.segment.length}));
    for(let i=0;i<segments.length-1;){
      const s=text.slice(segments[i].start,segments[i].end).trim();
      if(/(?:\b(?:Fig|Figs|Eq|Eqs|Sec|Secs|Dr|Prof|vs|al|No|Table)|\be\.g|\bi\.e)\.$/i.test(s)||/:$/.test(s)||/^(?:Figure|Table)\s*\d+\.$/i.test(s)){segments[i].end=segments[i+1].end;segments.splice(i+1,1);}else i++;
    }
    // Footnote markers and standalone citation tokens belong to the adjacent sentence.
    for(let i=segments.length-1;i>0;i--){
      if(!/[a-zA-Z]/.test(text.slice(segments[i].start,segments[i].end))){segments[i-1].end=segments[i].end;segments.splice(i,1);}
    }
    return segments;
  }
  function sentenceText(source){
    const clone=source.cloneNode(true),math=[];
    for(const note of clone.querySelectorAll('.ltx_note'))note.replaceWith(note.querySelector('.ltx_note_mark')?.textContent||'');
    for(const el of clone.querySelectorAll('math,.ltx_Math')){
      if(!clone.contains(el))continue;
      const marker=`⟦M${math.length}⟧`;math.push(el.cloneNode(true));el.replaceWith(marker);
    }
    return {text:clone.textContent.replace(/\s+/g,' ').trim(),math};
  }
  function prepare(container){
    const blocks=[];
    // LaTeXML tables may be <table> or span.ltx_tabular, including inside a .ltx_p.
    // Neither a table descendant nor a paragraph wrapping a table is prose.
    const excluded='svg,foreignObject,table,.ltx_tabular,.ltx_tr,.ltx_td,.ltx_equation,.ltx_equationgroup,.ltx_bibliography,.ltx_authors,.ltx_note';
    const protectedContent='table,.ltx_tabular,figure,img,svg,object,.ltx_equation,.ltx_equationgroup,math[display="block"],.ab-unsupported-media';
    const ps=[...container.querySelectorAll('.ltx_p,figcaption.ltx_caption')].filter(p=>!p.closest(excluded)&&!p.querySelector('.ltx_p')&&!p.querySelector(protectedContent));
    for(const p of ps){
      const pr=projection(p);if(!/[a-zA-Z]{3}/.test(pr.text)||pr.text.trim().length<12)continue;
      const section=p.closest('[data-source-id]')?.dataset.sourceId||'';
      const pieces=[];
      for(const slice of slices(pr.text)){
        if(!pr.text.slice(slice.start,slice.end).trim())continue;
        const range=document.createRange();range.setStart(...pr.boundary(slice.start));range.setEnd(...pr.boundary(slice.end,true));
        const source=document.createElement('span');source.className='pb-source';source.append(range.cloneContents());
        const translation=document.createElement('span');translation.className='pb-translation';translation.lang='zh-CN';translation.hidden=true;
        const span=document.createElement('span');span.className='pb-sentence';span.id='ab-s'+blocks.length;span.append(source,translation);
        const data=sentenceText(source);blocks.push({id:span.id,text:data.text,math:data.math,source,translation,section});pieces.push(span);
      }
      p.replaceChildren(...pieces);
    }
    return blocks;
  }
  function renderTranslation(block,text){
    const out=document.createDocumentFragment();
    for(const part of text.split(/(⟦M\d+⟧)/)){
      const m=part.match(/^⟦M(\d+)⟧$/);
      if(m&&block.math[Number(m[1])]){const node=block.math[Number(m[1])].cloneNode(true);node.removeAttribute('id');for(const el of node.querySelectorAll('[id]'))el.removeAttribute('id');out.append(node);}else out.append(document.createTextNode(part));
    }
    block.translation.replaceChildren(out);block.translation.hidden=false;
  }
  return {sanitize,prepare,slices,projection,renderTranslation};
})();
