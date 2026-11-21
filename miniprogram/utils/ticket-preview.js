const tickets=require('./tickets.js');
const {W,H}=tickets;
const REST_LIGHT={x:.42,y:.35};
const PERSPECTIVE=3.6*W;
const radians=degrees=>degrees*Math.PI/180;

function camera(width,height,yaw,pitch){
  const sinX=Math.sin(pitch),cosX=Math.cos(pitch);
  const sinY=Math.sin(yaw),cosY=Math.cos(yaw);
  function project(x,y){
    const u=x-W/2,v=y-H/2;
    const depth=-u*sinY+v*sinX*cosY;
    const factor=PERSPECTIVE/(PERSPECTIVE-depth);
    return [(u*cosY+v*sinX*sinY)*factor,v*cosX*factor];
  }
  const corners=[project(0,0),project(W,0),project(W,H),project(0,H)];
  const extentX=Math.max(...corners.map(p=>Math.abs(p[0])));
  const extentY=Math.max(...corners.map(p=>Math.abs(p[1])));
  const fit=Math.min(.96*width/W,.96*height/H,.495*width/extentX,.495*height/extentY);
  return (x,y)=>{
    const [u,v]=project(x,y);
    return [width/2+u*fit,height/2+v*fit];
  };
}

function patch(ctx,points,origin,xAxis,yAxis,x,width,paint){
  // A little clip overlap keeps antialiased edges from leaving seams between triangles.
  const cx=(points[0][0]+points[1][0]+points[2][0])/3;
  const cy=(points[0][1]+points[1][1]+points[2][1])/3;
  ctx.save();
  try{
    ctx.beginPath();
    points.forEach(([px,py],i)=>{
      const distance=Math.hypot(px-cx,py-cy)||1;
      const px2=px+(px-cx)/distance,py2=py+(py-cy)/distance;
      if(i)ctx.lineTo(px2,py2);else ctx.moveTo(px2,py2);
    });
    ctx.closePath();
    ctx.clip();
    const a=xAxis[0]/width,b=xAxis[1]/width,c=yAxis[0]/H,d=yAxis[1]/H;
    ctx.transform(a,b,c,d,origin[0]-a*x,origin[1]-b*x);
    paint();
  }finally{ctx.restore();}
}

function mesh(ctx,project,paint,strips){
  const delta=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const step=W/strips;
  let top=project(0,0),bottom=project(0,H);
  for(let i=0;i<strips;i++){
    const start=i*step,end=start+step;
    const nextTop=project(end,0),nextBottom=project(end,H);
    const paintStrip=()=>paint(start,step);
    patch(ctx,[top,nextTop,bottom],top,delta(nextTop,top),delta(bottom,top),start,step,paintStrip);
    patch(ctx,[nextTop,nextBottom,bottom],nextTop,delta(nextBottom,bottom),delta(nextBottom,nextTop),end,step,paintStrip);
    top=nextTop;bottom=nextBottom;
  }
}

function sheen(ctx,finish,side,light,active){
  const {kind,highlight}=tickets.shineOf(finish);
  const x=W*light.x,y=H*light.y;
  ctx.save();
  const spot=ctx.createRadialGradient(x,y,0,x,y,kind==='soft'?135:190);
  spot.addColorStop(0,highlight+(kind==='soft'?'12':active?'61':'32'));
  spot.addColorStop(1,highlight+'00');
  ctx.fillStyle=spot;
  ctx.fillRect(14,20,W-28,H-40);
  if(kind==='soft'){ctx.restore();return;}
  const front=side==='front';
  const foilX=front?24+light.x*372:63+light.x*294;
  const foilY=front?94+light.y*330:136+light.y*294;
  const band=ctx.createLinearGradient(foilX-150,foilY-96,foilX+150,foilY+96);
  if(kind==='spectrum'){
    const hue=(light.x*360+light.y*145)%360;
    const alpha=active?1:.66;
    band.addColorStop(0,'rgba(255,255,255,0)');
    [.18,.33,.50,.67,.82].forEach((stop,i)=>{
      band.addColorStop(stop,`hsla(${(hue+i*60)%360},100%,${i===2?92:70}%,${alpha})`);
    });
    band.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=band;
    ctx.globalAlpha=active ? .24 : .09;
    if(front)ctx.fillRect(25,95,370,328);
    else{ctx.beginPath();ctx.arc(W/2,283,149,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }else{
    band.addColorStop(0,highlight+'00');
    band.addColorStop(.48,highlight);
    band.addColorStop(1,highlight+'00');
  }
  ctx.strokeStyle=band;
  ctx.lineWidth=kind==='spectrum'?4.4:2.4;
  if(front)ctx.strokeRect(23,93,374,332);
  else{ctx.beginPath();ctx.arc(W/2,283,149,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

// 部分手机的微信里，把离屏画布 drawImage 到页面画布上不会报错、但什么也画不出来（预览一片空白，换款也不变）。
// 先画一个色块读回像素确认真的复制上去了；读不回或是透明的，就一直直接在页面画布上画。
function canCopy(ctx,texture,source){
  try{
    source.clearRect(0,0,8,8);source.fillStyle='#ff0000';source.fillRect(0,0,8,8);
    ctx.clearRect(0,0,8,8);ctx.drawImage(texture,0,0,8,8,0,0,8,8);
    const pixel=ctx.getImageData(0,0,1,1);
    ctx.clearRect(0,0,8,8);source.clearRect(0,0,8,8);
    const data=pixel&&pixel.data;
    return !!data&&data[3]>200&&data[0]>200;
  }catch(_){return false;}
}

function createPreview(node,createCanvas){
  const ctx=node.getContext('2d');
  let texture,source;
  try{texture=createCanvas(W,H);source=texture.getContext('2d');}catch(_){texture=null;}
  if(texture&&!canCopy(ctx,texture,source))texture=null;
  return (record,side,image,turn,position)=>{
    const light=position||REST_LIGHT;
    const yaw=turn??radians(position?(light.x-.5)*34:-3);
    const pitch=radians(position?(.5-light.y)*22:1);
    const project=camera(node.width,node.height,yaw,pitch);
    const artwork=target=>{
      tickets.draw(target,record,side,image,{x:0,y:0,w:W,h:H},createCanvas);
      sheen(target,record.look.finish,side,light,!!position);
    };
    ctx.clearRect(0,0,node.width,node.height);
    if(texture){
      try{
        source.clearRect(0,0,W,H);
        artwork(source);
        mesh(ctx,project,(start,span)=>{
          const left=Math.max(0,start-2),width=Math.min(W,start+span+2)-left;
          ctx.drawImage(texture,left,0,width,H,left,0,width,H);
        },9);
        return;
      }catch(_){
        texture=null;
        ctx.clearRect(0,0,node.width,node.height);
      }
    }
    // Some runtimes cannot use another canvas as an image source. Draw the same projected triangles directly.
    mesh(ctx,project,()=>artwork(ctx),4);
  };
}

module.exports={createPreview};
