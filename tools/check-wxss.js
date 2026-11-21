// 小程序 WXSS 不支持通配符选择器（*、>*、*+* 等），出现就会整页编译失败。calc() 里的乘号不算。
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const files=[];(function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(fs.statSync(p).isDirectory())walk(p);else if(n.endsWith('.wxss'))files.push(p);}})(path.join(root,'miniprogram'));
const bad=[];
for(const f of files){
  const css=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  let depth=0,sel='';
  for(const ch of css){
    if(ch==='{'){if(/(^|[\s>+~,(])\*/.test(sel)||/\*\s*[:+~>.[]/.test(sel))bad.push(path.relative(root,f)+': '+sel.trim().slice(-80));sel='';depth++;}
    else if(ch==='}'){depth--;sel='';}
    else if(ch===';'&&depth===0)sel='';
    else sel+=ch;
  }
}
if(bad.length){console.error('WXSS 不支持通配符选择器：\n'+bad.join('\n'));process.exit(1);}
console.log('PASS: '+files.length+' WXSS files have no universal selectors.');
