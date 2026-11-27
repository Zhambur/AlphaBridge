const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const localFile=path.resolve(__dirname,'../extension/local-defaults.json');
const local=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile)):{};
const privateValues=[os.homedir(),path.resolve(__dirname,'..'),local.vaultHint].filter(Boolean);
function audit(name,bytes){
  if(/(?:^|\/)(?:local-defaults\.json|config\.json|\.env|host\.cmd|org\.alphabridge\.obsidian\.json)$/.test(name))throw Error('Local-only file: '+name);
  if(!/\.(?:[cm]?js|json|html|css|md|txt|ps1|cmd|py|yml|yaml)$/.test(name))return;
  const text=Buffer.from(bytes).toString('utf8'),normalized=text.replaceAll('\\\\','/').replaceAll('\\','/').toLowerCase();
  for(const value of privateValues)if(normalized.includes(value.replaceAll('\\','/').toLowerCase()))throw Error('Personal path found: '+name);
  if(/\b[A-Z]:[\\/](?:Users|ObsidianNote|Anaconda)[\\/]/i.test(text))throw Error('Machine-specific path: '+name);
  if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/.test(text))throw Error('Possible secret: '+name);
}
module.exports={audit};
