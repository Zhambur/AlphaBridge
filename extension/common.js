/* Shared deterministic helpers. No page content is treated as executable code. */
globalThis.AB = (() => {
  function paperId(value) {
    let s = String(value || '').trim();
    if (s.includes('://')) {
      const u = new URL(s);
      if (!['www.alphaxiv.org','alphaxiv.org','arxiv.org','ar5iv.labs.arxiv.org','ar5iv.org'].includes(u.hostname)) throw Error('不是支持的论文地址');
      s = decodeURIComponent(u.pathname).replace(/^\/(?:abs|pdf|html|overview)\//, '').replace(/\.pdf$/, '');
    }
    if (!/^(?:\d{4}\.\d{4,5}|[a-zA-Z.-]+\/\d{7})(?:v\d+)?$/.test(s)) throw Error('当前双语原文支持 arXiv 论文；其他页面仍可划词保存。');
    return s;
  }
  function endpoint(value) {
    const u = new URL(value);
    if (u.username || u.password || u.search || u.hash || !['http:','https:'].includes(u.protocol)) throw Error('模型接口地址无效');
    if (u.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(u.hostname)) throw Error('远端模型地址须使用 HTTPS');
    return u.href.replace(/\/$/,'').replace(/(?:\/chat\/completions)?$/, '/chat/completions');
  }
  async function hash(s) {
    const b = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  const reloadHint='AlphaBridge 已更新或连接失效，请刷新 alphaXiv 网页后重新打开双语原文。';
  function runtime(){
    const r=globalThis.chrome?.runtime;
    if(!r?.id||typeof r.getURL!=='function')throw Error(reloadHint);
    return r;
  }
  function extensionURL(path=''){
    try{return runtime().getURL(path);}catch{throw Error(reloadHint);}
  }
  async function message(data) {
    try{const r=await runtime().sendMessage(data);if (!r?.ok) throw Error(r?.error || '插件未响应');return r.value;}
    catch(e){if(/Extension context invalidated|reading '(getURL|sendMessage)'/i.test(e.message))throw Error(reloadHint);throw e;}
  }
  return {paperId,endpoint,hash,message,extensionURL};
})();
