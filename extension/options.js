const form=document.querySelector('#form'),status=document.querySelector('#status');
const language=form.elements.language,customLanguage=document.querySelector('#custom-language');
function updateLanguage(){const custom=language.value==='__custom__';document.querySelector('#custom-language-label').hidden=!custom;customLanguage.disabled=!custom;customLanguage.required=custom;}
language.onchange=updateLanguage;
async function load(){const cfg=await AB.message({type:'config'});for(const key of ['url','model','vaultHint','vaultName','noteFolder'])form.elements[key].value=cfg[key];const preset=[...language.options].some(o=>o.value!=='__custom__'&&o.value===cfg.language);language.value=preset?cfg.language:'__custom__';customLanguage.value=preset?'':(cfg.language||'');updateLanguage();form.elements.autoTranslate.checked=cfg.autoTranslate;form.elements.pdfFigures.checked=cfg.pdfFigures;form.elements.key.placeholder=cfg.key?'已保存，留空保持不变':'未配置';form.elements.key.value='';}
form.onsubmit=async e=>{
  e.preventDefault();status.className='';
  try{
    const data=Object.fromEntries(new FormData(form));data.language=language.value==='__custom__'?customLanguage.value.trim():language.value;if(!data.language)throw Error('请填写目标语言');data.autoTranslate=form.elements.autoTranslate.checked;data.pdfFigures=form.elements.pdfFigures.checked;
    if(data.url){const endpoint=AB.endpoint(data.url);const origin=new URL(endpoint).origin+'/*';const granted=await chrome.permissions.request({origins:[origin]});if(!granted)throw Error('未授权模型接口；设置未保存。');}
    await AB.message({type:'save-config',config:data});status.textContent='已保存。重新打开双语原文即可应用新设置。';await load();
  }catch(e){status.textContent=e.message;status.className='error';}
};
document.querySelector('#clear-key').onclick=async()=>{const cfg=await AB.message({type:'config'});await AB.message({type:'save-config',config:{...cfg,key:'__CLEAR__'}});await load();status.textContent='已清除密钥';};
async function vaultStatus(){const r=await ABVault.status();document.querySelector('#vault-status').textContent=r.selected?`已选择：${r.name} · ${r.permission==='granted'?'允许写入':'需重新授权'}`:'尚未选择目录';}
for(const [id,action] of [['choose-vault',()=>ABVault.select()],['authorize-vault',()=>ABVault.authorize()],['forget-vault',()=>ABVault.handle(null)]])document.getElementById(id).onclick=async()=>{try{await action();await vaultStatus();}catch(e){document.querySelector('#vault-status').textContent=e.name==='AbortError'?'已取消，原目录设置保持不变':e.message;}};
document.querySelector('#clear-pdf-cache').onclick=async()=>{try{await AB.message({type:'clear-pdf-cache'});document.querySelector('#cache-status').textContent='已清理缓存；下次使用时重新下载 PDF';}catch(e){document.querySelector('#cache-status').textContent=e.message;}};
load().then(vaultStatus).catch(e=>{status.textContent=e.message;});
