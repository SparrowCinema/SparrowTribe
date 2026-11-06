// New film imports receive explicit premiere fields; research must supply verified values.
const fs=require('fs'),path=require('path'),P=require('../shared/premiere.js');
const root=path.resolve(__dirname,'..'),cat=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
const packs=cat.programmes.filter(p=>p.file).map(p=>{const file=path.join(root,p.file);return {file,pack:JSON.parse(fs.readFileSync(file,'utf8'))};}),known=new Map();
for(const {pack} of packs)for(const f of pack.films||[])if(f.worldPremiere)known.set(f.id,f.worldPremiere);
for(const {file,pack} of packs){let changed=false;
  for(const f of pack.films||[]){if(f.ev)continue;if(!f.worldPremiere){f.worldPremiere=JSON.parse(JSON.stringify(known.get(f.id)||P.pending()));changed=true;}}
  if(changed)fs.writeFileSync(file,JSON.stringify(pack,null,1)+'\n');
}
