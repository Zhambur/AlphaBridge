const cp=require('node:child_process'),{audit}=require('./privacy.cjs');
const commits=cp.execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),seen=new Set();
for(const rev of commits){const rows=cp.execFileSync('git',['ls-tree','-r',rev],{encoding:'utf8'}).trim().split('\n');for(const row of rows){const [meta,name]=row.split('\t'),hash=meta.split(' ')[2];if(seen.has(hash))continue;seen.add(hash);audit(name,cp.execFileSync('git',['cat-file','blob',hash],{maxBuffer:30*1024*1024}));}}
console.log('Audited '+commits.length+' reachable commits and '+seen.size+' unique file blobs.');
