/* Directory handles stay in extension-origin IndexedDB, never in page messages. */
globalThis.ABVault=(()=>{
  const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('alphabridge-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('handles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  async function handle(value){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction('handles',value===undefined?'readonly':'readwrite'),s=tx.objectStore('handles');const r=value===undefined?s.get('vault'):value===null?s.delete('vault'):s.put(value,'vault');tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('目录配置未保存'));});}finally{d.close();}}
  function folderParts(folder){if(typeof folder!=='string'||folder.length>240)throw Error('笔记子目录无效');if(!folder)return [];const parts=folder.replaceAll('\\','/').split('/');if(parts.some(p=>!p||p==='.'||p==='..'||/[<>:"|?*\x00-\x1f]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('请填写仓库内的相对子目录，不要包含 .. 或特殊字符');return parts;}
  async function status(){const h=await handle();return {selected:!!h,name:h?.name||'',permission:h?await h.queryPermission({mode:'readwrite'}):'prompt'};}
  async function select(){const h=await showDirectoryPicker({id:'alphabridge-vault',mode:'readwrite'});try{await h.getDirectoryHandle('.obsidian');}catch{throw Error('请选择包含 .obsidian 文件夹的 Obsidian 仓库根目录');}await handle(h);return status();}
  async function authorize(){const h=await handle();if(!h)return select();const permission=await h.requestPermission({mode:'readwrite'});if(permission!=='granted')throw Error('未获得目录写入权限，批注仍保留为草稿');return status();}
  function validate(n){
    for(const [k,max,required] of [['id',36,true],['paper',300,true],['title',2000,true],['quote',50000,true],['thought',50000,false],['source',3000,true],['section',300,false],['location',500,false],['at',80,false]]){const v=n[k]??'';if(typeof v!=='string'||v.length>max||v.includes('\0')||(required&&!v.trim()))throw Error('摘录字段无效：'+k);}
    if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(n.id))throw Error('摘录编号无效');
    const u=new URL(n.source);if(u.protocol!=='https:'||u.username||u.password||!['alphaxiv.org','www.alphaxiv.org','arxiv.org','ar5iv.org','ar5iv.labs.arxiv.org'].includes(u.hostname))throw Error('摘录来源无效');
  }
  async function save(n,cfg){validate(n);const parts=folderParts(cfg.noteFolder||'');return navigator.locks.request('alphabridge-vault-write',async()=>{
    const vault=await handle();if(!vault||await vault.queryPermission({mode:'readwrite'})!=='granted')throw Error('请在插件设置中选择 Obsidian 仓库并授权写入；草稿已保留');
    let dir=vault;for(const part of parts)dir=await dir.getDirectoryHandle(part,{create:true});
    let stem;try{stem=AB.paperId(n.paper).replace(/v\d+$/,'').replaceAll('/','-');}catch{stem='alpha-'+(await AB.hash(n.paper)).slice(0,20);}
    const filename='AlphaBridge-'+stem+'.md',file=await dir.getFileHandle(filename,{create:true});
    const oldFile=await file.getFile();if(oldFile.size>20*1024*1024)throw Error('笔记文件超过 20 MB，请更换笔记子目录');
    const old=await oldFile.text(),marker='^ab-'+n.id;
    if(!old.split(/\r?\n/).includes(marker)){
      const title=n.title.replace(/[\r\n]/g,' ');const prefix=old?'':`---\ntitle: ${JSON.stringify(title)}\nsource: ${JSON.stringify(n.source)}\npaper: ${JSON.stringify(n.paper)}\n---\n\n# ${title}\n`;
      const url=new URL(n.source);if(n.section)url.hash=n.section;
      const quote=n.quote.split(/\r?\n/).map(l=>'> '+l.replaceAll('<','&lt;').replaceAll('>','&gt;')).join('\n');
      const addition=`\n## 摘录 · ${(n.at||'').slice(0,10)}\n\n${quote}\n\n${n.thought||''}\n\n[返回原文](${url.href.replaceAll('(','%28').replaceAll(')','%29')}) · ${(n.location||'').replace(/[\r\n]/g,' ')}\n\n${marker}\n`;
      const writer=await file.createWritable({keepExistingData:true});try{const latest=await file.getFile();if(latest.lastModified!==oldFile.lastModified||latest.size!==oldFile.size)throw Error('笔记刚被其他程序修改，请重试保存');await writer.seek(oldFile.size);await writer.write(prefix+addition);await writer.close();}catch(e){await writer.abort().catch(()=>{});throw e;}
    }
    const relative=[...parts,filename].join('/');return {ok:true,path:relative,uri:'obsidian://open?vault='+encodeURIComponent(cfg.vaultName||vault.name)+'&file='+encodeURIComponent(relative.replace(/\.md$/,''))};
  });}
  return {handle,select,authorize,status,folderParts,save};
})();
