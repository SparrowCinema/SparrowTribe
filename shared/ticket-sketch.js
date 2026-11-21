/* Hand-drawn artwork treatments shared by the ticket album and exports. */
(function(root,factory){
  if(typeof module==="object"&&module.exports) module.exports=factory();
  else root.SparrowTicketSketch=factory();
})(typeof self==="undefined"?this:self,function(){
  "use strict";

  const PAPER=[249,241,224];
  const INK=[45,36,34];
  const BLUE_PAPER=[239,247,251];
  const BLUE_INK=[20,53,105];
  const styles=[
    {id:"crayon",label:"蜡笔乱涂"},
    {id:"watercolor",label:"淡彩水彩"},
    {id:"woodcut",label:"木刻版画"},
    {id:"blue-ink",label:"蓝墨速写"},
    {id:"doodle",label:"彩色涂鸦"}
  ];
  const storageKey="sparrow-ticket-art-style";
  const normalize=value=>styles.some(style=>style.id===value)?value:styles[0].id;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const luma=(r,g,b)=>.24*r+.58*g+.18*b;
  const distance=(r,g,b,color)=>.30*(r-color[0])**2+.52*(g-color[1])**2+.18*(b-color[2])**2;

  function reduceColors(pixels,w,h,limit=12){
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
    while(palette.length<limit){
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
    return {labels,palette};
  }

  const mix=(a,b,weight)=>a+(b-a)*weight;
  function stylize(pixels,w,h,width,height,styleId){
    const style=normalize(styleId);
    if(style==="doodle")return drawDoodle(pixels,w,h,width,height);
    const crayon=style==="crayon",wash=style==="watercolor",wood=style==="woodcut";
    const paper=style==="blue-ink"?BLUE_PAPER:PAPER,ink=style==="blue-ink"?BLUE_INK:INK;
    const {labels,palette:source}=reduceColors(pixels,w,h);
    const tones=source.map(color=>clamp((luma(...color)-19)/211,0,1));
    const palette=source.map((color,k)=>{
      const light=luma(...color);
      if(wood)return ink.map((c,i)=>mix(c,paper[i],Math.round(tones[k]*5)/5));
      if(!wash&&!crayon)return paper.map((c,i)=>mix(c,ink[i],(1-tones[k])*.25));
      const lifted=235*(light/255)**.92;
      return color.map((c,i)=>{
        const saturated=clamp((c-light)*(wash?1.22:1.54)+lifted+PAPER[i]*.10,0,255);
        return wash?mix(saturated,paper[i],.29):saturated;
      });
    });
    const nearby=source.map(a=>source.map(b=>{
      const contrast=Math.sqrt(distance(...a,b));
      return clamp((contrast-(crayon?24:18))/85,0,wood ? .82 : .69);
    }));
    const out=new Uint8ClampedArray(width*height*4);
    const regions=crayon?new Uint8Array(width*height):null;
    const label=(x,y)=>labels[clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1)];
    let seed=87191;
    const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const wobbleX=Math.sin(y*.20),wobbleY=Math.sin(x*.18);
      const sx=(x+1.4*wobbleX+.6*Math.sin((x+y)*.43))*w/width;
      const sy=(y+1.3*wobbleY+.6*Math.sin((x-y)*.36))*h/height;
      const i=y*width+x,s=i*4,k=label(sx,sy);
      const color=palette[k],tone=tones[k],edges=nearby[k],tooth=random();
      if(crayon)regions[i]=k;
      const d=wash ? 0 : wood||crayon ? .46 : .32;
      const edge=wash?0:Math.max(edges[label(sx-d,sy)],edges[label(sx+d,sy)],edges[label(sx,sy-d)],edges[label(sx,sy+d)]);
      if(wash){
        const ux=sx-.5,uy=sy-.5,fx=ux-Math.floor(ux),fy=uy-Math.floor(uy);
        const nw=palette[label(ux,uy)],ne=palette[label(ux+1,uy)],sw=palette[label(ux,uy+1)],se=palette[label(ux+1,uy+1)];
        const bloom=.035+.065*Math.sin(x*.056+y*.039)+.034*wobbleY;
        for(let c=0;c<3;c++){
          const washColor=mix(mix(nw[c],ne[c],fx),mix(sw[c],se[c],fx),fy);
          out[s+c]=mix(washColor,paper[c],bloom+tooth*.095);
        }
      }else{
        const depth=1-tone;
        const ridge=y+x*.68+wobbleY*1.25;
        const grainLine=(ridge%7+7)%7<.9+tone*1.7;
        const cross=(x-y*.33+height+wobbleX*1.2)%8<1.35;
        let shade=edge*(.74+tooth*.26);
        let grain=tooth>.95 ? .22 : tooth*.034;
        if(wood)grain=grainLine ? .34+tone*.25 : grain*.55;
        else if(!crayon){
          const hatch=clamp((depth-.22)/.78,0,1);
          shade=Math.max(shade,grainLine?hatch*.72:cross&&depth>.59?hatch*.25:0);
          grain=tooth*.04;
        }
        for(let c=0;c<3;c++) out[s+c]=mix(mix(color[c],ink[c],shade),paper[c],grain);
      }
      out[s+3]=255;
    }
    if(!crayon)return out;
    // Staggered wax-pencil strokes expose small slivers of paper inside colour patches.
    for(let y=0;y<height;y+=5) for(let x=0;x<width;x+=5){
      const sx=Math.min(width-1,x+Math.floor(random()*5));
      const sy=Math.min(height-1,y+Math.floor(random()*5));
      const k=regions[sy*width+sx],length=4+Math.floor(random()*13);
      const angle=-.68+Math.sin(k*1.9+sy*.02)*.48+(random()-.5)*.68;
      const pigment=random()>.25?paper:ink;
      const strength=.16+random()*.36;
      for(let step=0;step<length;step++){
        const tx=sx+step,ty=sy+Math.round(step*angle+Math.sin(step*.5)*.4);
        if(tx>=width||ty<0||ty>=height||regions[ty*width+tx]!==k)break;
        const i=(ty*width+tx)*4,weight=strength*(1-step/length);
        for(let c=0;c<3;c++) out[i+c]=mix(out[i+c],pigment[c],weight);
      }
    }
    return out;
  }

  const DOODLE_PAPER=[255,253,245];
  const DOODLE_INK=[26,20,24];

  function doodlePigment(color){
    const [r,g,b]=color,light=luma(r,g,b),chroma=Math.max(...color)-Math.min(...color);
    if(light<38)return DOODLE_INK;
    if(light>164&&chroma<30)return DOODLE_PAPER;
    // Keep warm highlights peach and reduce neutral shadows to broad, muted fills.
    if(r-g>12&&r-b>12&&r-g<57&&light>83&&light<211){
      return light>119?[255,224,184]:[247,199,151];
    }
    if(chroma<17){
      if(light<66)return [124,128,151];
      return g>=r&&g>=b?[193,211,194]:[201,204,218];
    }
    const base=clamp(175+(light-125)*.92,77,244);
    return color.map(channel=>clamp(base+(channel-light)*2.8,17,252));
  }

  function doodleRegions(labels,w,h,paletteSize,radius){
    const regions=new Uint8Array(labels),votes=new Uint8Array(paletteSize);
    for(let y=radius;y<h-radius;y++) for(let x=radius;x<w-radius;x++){
      const i=y*w+x,k=labels[i];
      votes.fill(0);
      for(let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++)votes[labels[i+dy*w+dx]]++;
      if(votes[k]>=3*radius)continue;
      const dominant=votes.findIndex(count=>count>=5*radius);
      if(dominant!==-1)regions[i]=dominant;
    }
    return regions;
  }

  function doodleDetail(pixels,w,h){
    const tones=new Float32Array(w*h),details=new Float32Array(w*h);
    for(let i=0;i<tones.length;i++)tones[i]=luma(pixels[i*4],pixels[i*4+1],pixels[i*4+2]);
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
      const i=y*w+x;
      const surround=(tones[i-w-1]+tones[i-w+1]+tones[i+w-1]+tones[i+w+1])/4;
      details[i]=clamp((surround-tones[i]-9)/44,0,.84);
    }
    return details;
  }

  function drawDoodle(pixels,w,h,width,height){
    const {labels,palette}=reduceColors(pixels,w,h,9);
    const radius=w>=70?2:1;
    const regions=doodleRegions(labels,w,h,palette.length,radius);
    const fills=palette.map(doodlePigment),details=doodleDetail(pixels,w,h);
    const warm=fills.map(([r,g,b])=>r>235&&g>175&&g<237&&b<210);
    const edges=fills.map((a,i)=>fills.map((b,j)=>{
      if(i===j)return 0;
      const contrast=Math.min(Math.sqrt(distance(...a,b)),Math.sqrt(distance(...palette[i],palette[j]))*1.65);
      return clamp((contrast-31)/56,0,1);
    }));
    const out=new Uint8ClampedArray(width*height*4),field=new Uint8Array(width*height);
    const cell=(x,y)=>clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1);
    const label=(x,y)=>regions[cell(x,y)];
    const unit=width/200,edgeWidth=Math.max(.45,.84/Math.sqrt(width/w));
    let seed=0x85ebca6b;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Offset the contour by a fraction of a sample to give the black line uneven edges.
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const px=x/unit,py=y/unit;
      const sx=(x+unit*(.69*Math.sin(py*.37)+.27*Math.sin((px+py)*.73)))*w/width;
      const sy=(y+unit*(.71*Math.sin(px*.32)+.23*Math.sin((px-py)*.69)))*h/height;
      const i=y*width+x,s=i*4,source=cell(sx,sy),k=regions[source],env=edges[k];
      // Keep a few small dark marks inside warm fills for fine detail such as eyes.
      const detail=warm[k]?details[source]:0;
      const pen=Math.max(detail,env[label(sx-edgeWidth,sy)],env[label(sx+edgeWidth,sy)],env[label(sx,sy-edgeWidth)],env[label(sx,sy+edgeWidth)]);
      field[i]=pen>.45?255:k;
      const dry=random(),ink=pen*(dry>.982?.54:1);
      for(let c=0;c<3;c++)out[s+c]=mix(fills[k][c],DOODLE_INK[c],ink);
      out[s+3]=255;
    }
    // Break up wide filled areas with short, tapered gaps like dry marker on paper.
    const spacing=Math.max(4,Math.round(unit*7));
    for(let y=0;y<height;y+=spacing) for(let x=0;x<width;x+=spacing){
      const sx=x+Math.floor(random()*spacing),sy=y+Math.floor(random()*spacing);
      if(sx>=width||sy>=height)continue;
      const k=field[sy*width+sx];
      if(k===255||fills[k]===DOODLE_PAPER||random()<.54)continue;
      const length=Math.max(2,Math.round(unit*(2+random()*9)));
      const angle=-.9+Math.sin(k*2.4)*.39+(random()-.5)*.45;
      for(let dx=0;dx<length;dx++){
        const tx=sx+dx,ty=sy+Math.round(dx*angle);
        if(tx>=width||ty<0||field[ty*width+tx]!==k)break;
        const i=(ty*width+tx)*4,weight=.29+.59*Math.sin(Math.PI*(dx+1)/(length+1));
        for(let c=0;c<3;c++)out[i+c]=mix(out[i+c],DOODLE_PAPER[c],weight);
      }
    }
    return out;
  }

  const imageCache=new WeakMap();
  function paint(surface,image,crop,frame,createCanvas,cropCover,ticketScale=1,styleId){
    if(!createCanvas)return false;
    try{
      let cache=imageCache.get(image);
      if(!cache){cache=new Map();imageCache.set(image,cache);}
      const {x,y,w,h}=frame;
      const width=Math.min(w,ticketScale>=.7?w:ticketScale>=.36?220:120);
      const height=Math.max(1,Math.round(width*h/w));
      const style=normalize(styleId),key=style+":"+width+":"+crop;
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
        data.data.set(stylize(source.data,sw,sh,width,height,style));
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

  return {styles,storageKey,normalize,stylize,paint};
});
