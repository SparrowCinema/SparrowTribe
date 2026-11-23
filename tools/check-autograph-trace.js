// 签名照片 → 笔画（2026-11-23）：用合成的「纸上签名」位图测试描摹结果的格式、范围、形状与噪点处理。
const assert=require('assert'),Tr=require('../shared/autograph-trace.js');

// 在白纸上画粗黑线（模拟签字笔），可加纸面噪点、灰底、浅色污渍
function paper(w,h,opt={}){
  const data=new Uint8ClampedArray(w*h*4),bg=opt.bg??245;
  for(let i=0;i<w*h;i++){const n=opt.noise?Math.round((Math.random()-.5)*opt.noise):0;data[i*4]=data[i*4+1]=data[i*4+2]=Math.max(0,Math.min(255,bg+n));data[i*4+3]=255;}
  return {data,width:w,height:h};
}
function line(img,pts,r,ink=25){
  const {width:w,height:h,data}=img;
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i],L=Math.ceil(Math.hypot(x1-x0,y1-y0));
    for(let t=0;t<=L;t++){const cx=x0+(x1-x0)*t/L,cy=y0+(y1-y0)*t/L;
      for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){if(x<0||y<0||x>=w||y>=h||Math.hypot(x-cx,y-cy)>r)continue;const k=(y*w+x)*4;data[k]=data[k+1]=data[k+2]=ink;}}}
}
const curve=(cx,cy,r,a0,a1,n=40)=>Array.from({length:n},(_,i)=>{const a=a0+(a1-a0)*i/(n-1);return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];});

// 1. 一笔横线 + 一个圈 + 一笔竖线：描出来至少 3 笔，全部合法，横线是横的
let img=paper(800,400,{noise:18});
line(img,[[100,300],[700,300]],6);
line(img,curve(250,170,70,0,Math.PI*2,80),6);
line(img,[[520,90],[540,250]],6);
let r=Tr.trace(img,0);
assert(Tr.valid(r.strokes),'valid strokes');
assert(r.strokes.length>=3&&r.strokes.length<=8,'about 3 strokes, got '+r.strokes.length);
const longest=r.strokes.slice().sort((a,b)=>b.length-a.length)[0];
const xs=longest.filter((_,i)=>i%2===0),ys=longest.filter((_,i)=>i%2===1);
assert(Math.max(...xs)-Math.min(...xs)>600,'horizontal stroke spans the pad');
assert(Math.max(...ys)-Math.min(...ys)<40,'horizontal stroke stays flat');
// 等距：相邻点间距大致均匀（票面按段长决定粗细）
const gaps=[];for(let i=2;i<longest.length;i+=2)gaps.push(Math.hypot(longest[i]-longest[i-2],longest[i+1]-longest[i-1]));
assert(Math.max(...gaps.slice(0,-1))<20,'points evenly spaced');

// 2. 纸面污点被去掉：加一些小黑点，笔画数不变太多
const img2=paper(800,400,{noise:18});line(img2,[[100,300],[700,300]],6);
for(let i=0;i<40;i++){const x=Math.random()*800,y=Math.random()*400;line(img2,[[x,y],[x+1,y]],1.2);}
const r2=Tr.trace(img2,0);assert(Tr.valid(r2.strokes));assert(r2.strokes.length<=3,'specks removed, got '+r2.strokes.length);

// 3. 深底浅字自动反转
const img3=paper(600,300,{bg:30});line(img3,[[80,150],[520,150]],5,230);
const r3=Tr.trace(img3,0);assert(Tr.valid(r3.strokes)&&r3.strokes.length>=1,'light ink on dark paper');

// 4. 空白纸：没有墨迹
assert.equal(Tr.trace(paper(400,200,{noise:10}),0).reason,'noink');

// 5. 很复杂的签名（大量笔画）也不超过 80 笔 / 4000 点
const img5=paper(1000,500,{noise:12});
for(let i=0;i<140;i++)line(img5,curve(60+(i%14)*65,60+Math.floor(i/14)*40,14,0,Math.PI*1.6,18),2.5);
const r5=Tr.trace(img5,0);assert(Tr.valid(r5.strokes),'limits respected: '+r5.strokes.length+' strokes, '+r5.points+' points');

// 6. 深浅微调：更严时浅灰的笔画被去掉
const img6=paper(800,400);line(img6,[[100,120],[700,120]],6,25);line(img6,[[100,300],[700,300]],6,170);
const loose=Tr.trace(img6,40),strict=Tr.trace(img6,-60);
assert(loose.strokes.length>strict.strokes.length,'shift controls faint strokes ('+loose.strokes.length+' vs '+strict.strokes.length+')');
console.log('PASS: autograph trace — shapes, even spacing, speck removal, inverted paper, blank page, limits, threshold shift.');
// 7. 孤立的点（i 上的点）保留成一小段
const img7=paper(800,400,{noise:12});line(img7,[[100,300],[700,300]],6);line(img7,[[400,100],[401,100]],9);
const r7=Tr.trace(img7,0);assert(Tr.valid(r7.strokes));
assert(r7.strokes.some(s=>s.length<=6&&s[1]<200),'dot kept as a short mark ('+r7.strokes.map(s=>s.length).join(',')+')');
console.log('PASS: autograph trace — isolated dots kept.');
