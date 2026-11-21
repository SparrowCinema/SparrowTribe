const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tickets=require('../miniprogram/utils/tickets');
const previewModule=require('../miniprogram/utils/ticket-preview');
const pagePath=path.join(__dirname,'../miniprogram/pages/tickets');

const template=fs.readFileSync(path.join(pagePath,'tickets.wxml'),'utf8');
assert.equal((template.match(/class="al-editor-canvas"/g)||[]).length,1);
assert.match(template,/<canvas [^>]*id="ticket-editor"[^>]*bindtap="flipEditor"/);
assert.match(template,/catchtouchmove="moveEditorTouch"/);

let rejectCanvasImage=false,silentCanvasImage=false;
function drawingContext(){
  const ctx={labels:[],lights:[],colors:[],transforms:[]};
  const gradient={addColorStop(_,color){ctx.colors.push(color);}};
  return new Proxy(ctx,{get(target,key){
    if(key==='clearRect')return ()=>{target.labels=[];target.lights=[];target.colors=[];target.transforms=[];};
    if(key==='fillText')return label=>target.labels.push(label);
    if(key==='transform')return (...values)=>target.transforms.push(values);
    if(key==='getImageData')return ()=>({data:target.copied?[255,0,0,255]:[0,0,0,0]});
    if(key==='drawImage')return source=>{
      if(!source.frame)return;
      if(rejectCanvasImage)throw Error('Canvas image source unsupported');
      // 部分手机：drawImage 离屏画布不报错也不画
      if(silentCanvasImage)return;
      target.copied=true;
      const {labels,lights,colors}=source.frame;
      Object.assign(target,{labels:[...labels],lights:[...lights],colors:[...colors]});
    };
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
  createOffscreenCanvas(){const frame=drawingContext();return {frame,getContext:()=>frame};},
  showLoading(){},hideLoading(){},showActionSheet(){},
  canvasToTempFilePath({canvas,fileType,success}){
    assert.equal(canvas,exportNode);assert.equal(fileType,'png');
    exportedFace=canvas.getContext().labels;
    success({tempFilePath:'test.png'});
  }
};
vm.runInNewContext(fs.readFileSync(path.join(pagePath,'tickets.js'),'utf8'),{
  Page:page=>{options=page;},getApp:()=>({}),
  require:name=>name.endsWith('/tickets.js')?tickets:name.endsWith('/ticket-preview.js')?previewModule:{tr:text=>text},
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
  const rest=preview.lights.at(-1),restRainbow=preview.colors.filter(color=>color.startsWith('hsla'));
  assert.deepEqual(rest,[.42*tickets.W,.35*tickets.H]);
  assert.equal(new Set(restRainbow).size,5);
  const assertPerspective=()=>{
    const verticalScales=preview.transforms.map(matrix=>matrix[3]);
    assert(Math.max(...verticalScales)-Math.min(...verticalScales)>.05,
      'near and far sides must project at different heights');
  };
  page.moveEditorTouch({touches:[{x:90,y:160}]});
  advance(16);
  assert.deepEqual(preview.lights.at(-1),[.9*tickets.W,.8*tickets.H]);
  assert.notDeepEqual(preview.colors.filter(color=>color.startsWith('hsla')),restRainbow);
  assertPerspective();
  page.endEditorTouch();
  advance(16);
  assert.deepEqual(preview.lights.at(-1),rest);
  page.flipEditor();
  advance(170);assertFace('front');assertPerspective();
  advance(100);assertFace('back');assertPerspective();
  assert.equal(page.data.editFront,false);
  advance(250);assertFace('back');
  pendingImage.onload();await Promise.resolve();
  assertFace('back');
  await page.export(true);
  assert(exportedFace.includes('收藏票根'));
  assert.equal(exportContext.lights.length,0,'preview reflection stays out of the exported PNG');
  page.flipEditor();
  advance(270);assertFace('front');assertPerspective();
  advance(250);assertFace('front');
  assert.equal(page.data.editFront,true);
  rejectCanvasImage=true;
  page.moveEditorTouch({touches:[{x:90,y:160}]});
  advance(16);
  assertFace('front');assertPerspective();
  assert(preview.colors.some(color=>color.startsWith('hsla')),'direct drawing keeps the rainbow');
  // 离屏复制静默失败的手机：创建预览时检测出来，直接在页面画布上画（正反面、换款都能看到）
  rejectCanvasImage=false;silentCanvasImage=true;
  const quiet=drawingContext(),quietNode={width:630,height:1296,getContext:()=>quiet};
  const render=previewModule.createPreview(quietNode,()=>{const frame=drawingContext();return {frame,getContext:()=>frame};});
  render(draft,'front',null);
  assert(quiet.labels.includes('纪念票根'),'silent offscreen copy falls back to direct drawing');
  const shuffled={...draft,look:tickets.randomLook(draft)};quiet.colors=[];render(shuffled,'back',null);
  assert(quiet.labels.includes('收藏票根'));
  console.log('PASS: one canvas, reversible perspective flip, moving rainbow, late-poster guard, direct-render fallback, silent-copy detection and still PNG.');
})().catch(error=>{console.error(error);process.exitCode=1;});
