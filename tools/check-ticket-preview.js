const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tickets=require('../miniprogram/utils/tickets');
const pagePath=path.join(__dirname,'../miniprogram/pages/tickets');

const template=fs.readFileSync(path.join(pagePath,'tickets.wxml'),'utf8');
assert.equal((template.match(/class="al-editor-canvas"/g)||[]).length,1);
assert.match(template,/<canvas [^>]*id="ticket-editor"[^>]*bindtap="flipEditor"/);

function drawingContext(){
  const ctx={labels:[],lights:[],scales:[]};
  const gradient={addColorStop(){}};
  return new Proxy(ctx,{get(target,key){
    if(key==='clearRect')return ()=>{target.labels=[];target.lights=[];target.scales=[];};
    if(key==='fillText')return label=>target.labels.push(label);
    if(key==='scale')return (x,y)=>target.scales.push([x,y]);
    if(key==='measureText')return label=>({width:label.length*12});
    if(key==='createLinearGradient')return ()=>gradient;
    if(key==='createRadialGradient')return (x,y)=>{target.lights.push([x,y]);return gradient;};
    if(key==='createPattern')return ()=>({});
    return target[key]??(()=>{});
  }});
}

let now=0,options,pendingImage,exportedFace;
const callbacks=[];
const preview=drawingContext(),exportContext=drawingContext();
const node={
  getContext:()=>preview,
  requestAnimationFrame:cb=>callbacks.push(cb),
  createImage:()=>{pendingImage={width:120,height:180};return pendingImage;}
};
const exportNode={getContext:()=>exportContext};
const wx={
  createSelectorQuery(){
    let selected;
    return {in(){return this;},select(id){selected=id;return this;},fields(){return this;},exec(cb){
      assert(['#ticket-editor','#ticket-export-canvas'].includes(selected),selected);
      cb([{node:selected==='#ticket-editor'?node:exportNode}]);
    }};
  },
  createOffscreenCanvas:()=>({getContext:drawingContext}),
  showLoading(){},hideLoading(){},showActionSheet(){},
  canvasToTempFilePath({canvas,fileType,success}){
    assert.equal(canvas,exportNode);assert.equal(fileType,'png');
    exportedFace=canvas.getContext().labels;
    success({tempFilePath:'test.png'});
  }
};
vm.runInNewContext(fs.readFileSync(path.join(pagePath,'tickets.js'),'utf8'),{
  Page:page=>{options=page;},getApp:()=>({}),
  require:name=>name.endsWith('/tickets.js')?tickets:{tr:text=>text},
  wx,setTimeout,clearTimeout,Date:{now:()=>now}
});

(async function(){
  const draft=tickets.sanitize({filmId:'one',title:'罗赛塔',art:'posters/rosetta.jpg',
    programme:'法国电影展',date:'2026-11-21',look:{finish:'holo',texture:'linen'}});
  const page={...options,data:{...options.data},_ready:true,_render:0,_side:'front',_draft:draft,
    _ticketBounds:{left:10,top:20,width:100,height:200},setData(data){Object.assign(this.data,data);}};
  const advance=millis=>{now+=millis;for(const callback of callbacks.splice(0))callback();};
  const assertFace=side=>{
    assert.equal(preview.labels.includes('纪念票根'),side==='front');
    assert.equal(preview.labels.includes('收藏票根'),side==='back');
  };
  await page.drawEditor();
  assertFace('front');
  const rest=preview.lights.at(-1);
  assert.deepEqual(rest,[.42*tickets.W,.35*tickets.H]);
  page.moveEditorTouch({touches:[{x:90,y:160}]});
  advance(16);
  assert.deepEqual(preview.lights.at(-1),[.9*tickets.W,.8*tickets.H]);
  page.endEditorTouch();
  advance(16);
  assert.deepEqual(preview.lights.at(-1),rest);
  page.flipEditor();
  advance(120);assertFace('front');
  assert(preview.scales[0][0]<630/tickets.W,'card narrows before swapping sides');
  advance(80);assertFace('back');
  assert.equal(page.data.editFront,false);
  advance(180);assertFace('back');
  assert.equal(preview.scales[0][0],630/tickets.W);
  pendingImage.onload();await Promise.resolve();
  assertFace('back');
  await page.export(true);
  assert(exportedFace.includes('收藏票根'));
  assert.equal(exportContext.lights.length,0,'preview reflection stays out of the exported PNG');
  page.flipEditor();
  advance(190);assertFace('front');
  advance(190);assertFace('front');
  assert.equal(page.data.editFront,true);
  console.log('PASS: native editor uses one canvas, swaps both ways, blocks late image overwrites and paints touch highlights.');
})().catch(error=>{console.error(error);process.exitCode=1;});
