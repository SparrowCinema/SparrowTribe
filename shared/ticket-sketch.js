/* Optional wax-pencil treatment for the picture on a ticket. */
(function(root,factory){
  if(typeof module==="object"&&module.exports) module.exports=factory();
  else root.SparrowTicketSketch=factory();
})(typeof self==="undefined"?this:self,function(){
  "use strict";

  const PAPER=[249,241,224];
  const INK=[45,36,34];
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const luma=(r,g,b)=>.24*r+.58*g+.18*b;
  const distance=(r,g,b,color)=>.30*(r-color[0])**2+.52*(g-color[1])**2+.18*(b-color[2])**2;

  function reduceColors(pixels,w,h){
    // Clean fine noise before grouping similar pigments into a small palette.
    const samples=new Float32Array(w*h*3);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const p=(y*w+x)*4,s=(y*w+x)*3;
      const left=x?p-4:p,right=x+1<w?p+4:p,above=y?p-w*4:p,below=y+1<h?p+w*4:p;
      for(let c=0;c<3;c++){
        const value=(pixels[p+c]*4+pixels[left+c]+pixels[right+c]+pixels[above+c]+pixels[below+c])/8;
        samples[s+c]=value*pixels[p+3]/255+PAPER[c]*(1-pixels[p+3]/255);
      }
    }
    const labels=new Uint8Array(w*h);
    const lights=Float32Array.from(labels,(_,i)=>luma(samples[i*3],samples[i*3+1],samples[i*3+2]));
    const byLight=Array.from(labels.keys()).sort((a,b)=>lights[a]-lights[b]);
    const pigmentAt=i=>Array.from(samples.subarray(i*3,i*3+3));
    const palette=[pigmentAt(byLight[Math.floor(byLight.length/2)])];
    const nearest=new Float32Array(labels.length).fill(Infinity);
    let picker=0x61c88647;
    while(palette.length<12){
      const last=palette[palette.length-1];
      let total=0;
      for(let i=0;i<labels.length;i++){
        const s=i*3;
        nearest[i]=Math.min(nearest[i],distance(samples[s],samples[s+1],samples[s+2],last));
        total+=nearest[i];
      }
      if(!total)break;
      picker=(Math.imul(1664525,picker)+1013904223)>>>0;
      let weight=total*picker/4294967296, i=0;
      while(i<nearest.length-1&&weight>nearest[i])weight-=nearest[i++];
      palette.push(pigmentAt(i));
    }
    for(let pass=0;pass<5;pass++){
      const sums=palette.map(()=>[0,0,0,0]);
      for(let i=0;i<labels.length;i++){
        const s=i*3,r=samples[s],g=samples[s+1],b=samples[s+2];
        let best=0,min=Infinity;
        palette.forEach((color,j)=>{const d=distance(r,g,b,color);if(d<min){best=j;min=d;}});
        labels[i]=best;
        const sum=sums[best];
        sum[0]+=r;sum[1]+=g;sum[2]+=b;sum[3]++;
      }
      if(pass===4)break;
      sums.forEach(([r,g,b,n],i)=>{if(n)palette[i]=[r/n,g/n,b/n];});
    }
    return {labels,palette:palette.map(color=>{
      const light=luma(...color);
      const lifted=235*(light/255)**.92;
      return color.map((c,i)=>clamp((c-light)*1.48+lifted+PAPER[i]*.10,0,255));
    })};
  }

  function stylize(pixels,w,h,width,height){
    const {labels,palette}=reduceColors(pixels,w,h);
    const nearby=palette.map(a=>palette.map(b=>{
      const delta=Math.sqrt(distance(...a,b));
      return clamp((delta-30)/90,0,.71);
    }));
    const out=new Uint8ClampedArray(width*height*4);
    const regions=new Uint8Array(width*height);
    const label=(x,y)=>labels[clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1)];
    let seed=87191;
    const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const sx=(x+1.4*Math.sin(y*.20)+.6*Math.sin((x+y)*.43))*w/width;
      const sy=(y+1.3*Math.sin(x*.18)+.6*Math.sin((x-y)*.36))*h/height;
      const i=y*width+x,s=i*4,k=label(sx,sy),r=nearby[k];
      regions[i]=k;
      const edge=Math.max(r[label(sx-.32,sy)],r[label(sx+.32,sy)],r[label(sx,sy-.32)],r[label(sx,sy+.32)]);
      const ink=edge*(.78+random()*.22);
      const tooth=random();
      const grain=tooth>.95 ? .21 : tooth*.035;
      for(let c=0;c<3;c++) out[s+c]=palette[k][c]*(1-ink-grain)+INK[c]*ink+PAPER[c]*grain;
      out[s+3]=255;
    }
    // Short, uneven pencil strokes leave little gaps in each patch of pigment.
    for(let y=0;y<height;y+=5) for(let x=0;x<width;x+=5){
      const sx=Math.min(width-1,x+Math.floor(random()*5));
      const sy=Math.min(height-1,y+Math.floor(random()*5));
      const k=regions[sy*width+sx],length=2+Math.floor(random()*12),angle=.46+random()*.38;
      const pigment=random()>.22?PAPER:INK;
      const strength=.10+random()*.27;
      for(let step=0;step<length;step++){
        const tx=sx+step,ty=sy-Math.round(step*angle);
        if(tx>=width||ty<0||regions[ty*width+tx]!==k)break;
        const i=(ty*width+tx)*4,mix=strength*(1-step/length);
        for(let c=0;c<3;c++) out[i+c]=out[i+c]*(1-mix)+pigment[c]*mix;
      }
    }
    return out;
  }

  const imageCache=new WeakMap();
  function paint(surface,image,crop,frame,createCanvas,cropCover,ticketScale=1){
    if(!createCanvas)return false;
    try{
      let cache=imageCache.get(image);
      if(!cache){cache=new Map();imageCache.set(image,cache);}
      const {x,y,w,h}=frame;
      const width=Math.min(w,ticketScale>=.7?w:ticketScale>=.36?220:120);
      const height=Math.max(1,Math.round(width*h/w));
      const key=width+":"+crop;
      let drawing=cache.get(key);
      if(!drawing){
        const sw=Math.min(92,Math.max(32,Math.round(width*.4)));
        const sh=Math.max(1,Math.round(sw*h/w));
        const sample=createCanvas(sw,sh).getContext("2d");
        cropCover(sample,image,crop,{x:0,y:0,w:sw,h:sh});
        const source=sample.getImageData(0,0,sw,sh);
        if(!source.data.some((value,i)=>i%4===3&&value>0))return false;
        drawing=createCanvas(width,height);
        const target=drawing.getContext("2d");
        const data=target.createImageData(width,height);
        data.data.set(stylize(source.data,sw,sh,width,height));
        target.putImageData(data,0,0);
        if(cache.size===2)cache.delete(cache.keys().next().value);
        cache.set(key,drawing);
      }
      surface.drawImage(drawing,x,y,w,h);
      return true;
    }catch(_){
      // A cross-origin or unsupported canvas still gets a usable original image.
      return false;
    }
  }

  return {stylize,paint};
});
