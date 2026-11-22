/* Hand-drawn artwork treatments shared by the ticket album and exports. */
(function(root,factory){
  if(typeof module==="object"&&module.exports) module.exports=factory();
  else root.SparrowTicketSketch=factory();
})(typeof self==="undefined"?this:self,function(){
  "use strict";

  const PAPER=[249,241,224];
  const INK=[45,36,34];
  // 2026-11-21：去掉木刻版画、蓝墨速写、卡通漫画；新增波普网点、孟菲斯涂鸦。旧的选择会换成相近的一款（ALIAS）。
  // 2026-11-22：报纸网点设为默认，放在最前（没选过风格的票根都用它）
  const styles=[
    {id:"news-dots",label:"报纸网点"},
    {id:"crayon",label:"蜡笔乱涂"},
    {id:"kid-crayon",label:"童趣蜡笔"},
    {id:"doodle",label:"彩色涂鸦"},
    {id:"watercolor",label:"淡彩水彩"},
    {id:"pop-dots",label:"波普网点"},
    {id:"memphis",label:"孟菲斯涂鸦"},
    {id:"cmyk-dots",label:"四色网点"},
    {id:"crt",label:"老电视"},
    {id:"ccd",label:"CCD 复古"},
    {id:"projector",label:"胶片放映"},
    {id:"film70",label:"70mm 胶片"}
  ];
  const ALIAS={woodcut:"crayon","blue-ink":"watercolor",cartoon:"pop-dots",riso:"cmyk-dots",lenticular:"crt"}; // 2026-11-22 去掉孔版双色，换成四色网点
  const storageKey="sparrow-ticket-art-style";
  const normalize=value=>styles.some(style=>style.id===value)?value:ALIAS[value]||styles[0].id;
  const filmStyleOptions=[{id:"",label:"跟随收藏册"},...styles];
  const filmStorageKey="sparrow-ticket-art-style-by-film";
  const filmIdPattern=/^[\w-]{1,80}$/;

  function parseFilmStyles(raw){
    try{
      const values=JSON.parse(raw||"{}");
      if(!values||typeof values!=="object"||Array.isArray(values))return new Map();
      // 已删除的风格（如卡通漫画）按 ALIAS 换成相近的一款，不丢掉这部电影的选择
      return new Map(Object.entries(values).filter(([filmId,style])=>filmIdPattern.test(filmId)&&(normalize(style)===style||ALIAS[style])).map(([filmId,style])=>[filmId,normalize(style)]));
    }catch(_){return new Map();}
  }

  function readFilmStyles(read){
    try{return parseFilmStyles(read(filmStorageKey));}catch(_){return new Map();}
  }

  function saveFilmStyle(read,write,filmId,style){
    if(typeof filmId!=="string"||!filmIdPattern.test(filmId)||(style!==""&&normalize(style)!==style))return null;
    try{
      const overrides=parseFilmStyles(read(filmStorageKey));
      if(style)overrides.set(filmId,style);
      else overrides.delete(filmId);
      write(filmStorageKey,JSON.stringify(Object.fromEntries(overrides)));
      return overrides;
    }catch(_){return null;}
  }
  // 云端同步（2026-11-21）：两个风格设置各自记一个修改时间（META_KEY），随个人档案的 art 字段同步，合并时逐项取较新的
  const metaKey="sparrow-ticket-art-meta";
  function readMeta(read){try{const m=JSON.parse(read(metaKey)||"{}");return {d:+m.d||0,f:m.f&&typeof m.f==="object"&&!Array.isArray(m.f)?m.f:{}};}catch(_){return {d:0,f:{}};}}
  // 改完风格后调用：filmId 为空表示改的是收藏册默认风格
  function markArt(read,write,filmId,at){
    try{const m=readMeta(read),t=Math.max(at||Date.now(),(filmId?+m.f[filmId]||0:m.d)+1);if(filmId)m.f[filmId]=t;else m.d=t;write(metaKey,JSON.stringify(m));return true;}catch(_){return false;}
  }
  function artSnapshot(read){
    const m=readMeta(read),films=readFilmStyles(read),out={d:{s:"",t:m.d},f:{}};
    try{const d=read(storageKey);if(d&&normalize(d)===d)out.d.s=d;}catch(_){}
    films.forEach((s,id)=>{out.f[id]={s,t:+m.f[id]||0};});
    Object.keys(m.f).forEach(id=>{if(!films.has(id)&&filmIdPattern.test(id))out.f[id]={del:1,t:+m.f[id]||0};});
    return out;
  }
  // 把云端的风格设置合进本机：逐项取较新的；返回是否有变化
  function applyArt(read,write,remote){
    if(!remote||typeof remote!=="object")return false;
    try{
      const local=artSnapshot(read),m=readMeta(read),films=readFilmStyles(read);let changed=false;
      const rd=remote.d||{};
      if(+rd.t>local.d.t&&typeof rd.s==="string"){
        const s=rd.s?normalize(rd.s):"";
        if(s!==local.d.s){if(s)write(storageKey,s);changed=true;}
        m.d=+rd.t;
      }
      const rf=remote.f&&typeof remote.f==="object"?remote.f:{};
      Object.keys(rf).forEach(id=>{
        const e=rf[id];if(!filmIdPattern.test(id)||!e||!(+e.t>(+m.f[id]||0)))return;
        if(e.del){if(films.delete(id))changed=true;}
        else{const s=normalize(e.s);if(films.get(id)!==s){films.set(id,s);changed=true;}}
        m.f[id]=+e.t;
      });
      if(changed)write(filmStorageKey,JSON.stringify(Object.fromEntries(films)));
      write(metaKey,JSON.stringify(m));
      return changed;
    }catch(_){return false;}
  }
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
    if(style==="kid-crayon")return drawKidCrayon(pixels,w,h,width,height);
    if(style==="pop-dots")return drawPopDots(pixels,w,h,width,height);
    if(style==="memphis")return drawMemphis(pixels,w,h,width,height);
    if(style==="cmyk-dots"||style==="news-dots")return drawHalftone(pixels,w,h,width,height,style);
    if(style==="crt")return drawCRT(pixels,w,h,width,height);
    if(style==="ccd")return drawCCD(pixels,w,h,width,height);
    if(style==="projector")return drawProjector(pixels,w,h,width,height);
    if(style==="film70")return drawFilm70(pixels,w,h,width,height);
    const crayon=style==="crayon",wash=style==="watercolor",wood=false;
    const paper=PAPER,ink=INK;
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

  // 童趣蜡笔：像孩子用油蜡笔画的——大块饱和平涂、粗而毛糙的黑色勾线、蜡笔在粗纸上留下的白色斜纹，
  // 颜色还会稍微涂出线外（填色层相对勾线错开一点）。画面偏抽象。
  const KID_PAPER=[255,254,249];
  const KID_INK=[22,18,20];
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  function valueNoise(x,y){
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
  }
  function kidPigment(color){
    const base=doodlePigment(color);
    if(base===DOODLE_INK)return KID_INK;
    if(base===DOODLE_PAPER)return KID_PAPER;
    const light=luma(...base);
    return base.map(c=>clamp(light+(c-light)*1.25-6,10,250));
  }
  function drawKidCrayon(pixels,w,h,width,height){
    const {labels,palette}=reduceColors(pixels,w,h,8);
    const regions=doodleRegions(doodleRegions(labels,w,h,palette.length,w>=120?3:w>=70?2:1),w,h,palette.length,w>=70?2:1);
    const fills=palette.map(kidPigment),details=doodleDetail(pixels,w,h);
    const warm=fills.map(([r,g,b])=>r>225&&g>165&&g<240&&b<215);
    const edges=fills.map((a,i)=>fills.map((b,j)=>{
      if(i===j)return 0;
      const contrast=Math.min(Math.sqrt(distance(...a,b)),Math.sqrt(distance(...palette[i],palette[j]))*1.7);
      return clamp((contrast-26)/48,0,1);
    }));
    const angles=fills.map((_,k)=>-.62+Math.sin(k*2.17+.4)*.55);   // 每块颜色的涂抹方向不同
    const out=new Uint8ClampedArray(width*height*4);
    const cell=(x,y)=>clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1);
    const label=(x,y)=>regions[cell(x,y)];
    const unit=width/200,edgeWidth=Math.max(.6,1.25/Math.sqrt(width/w));
    const offX=1.6*unit*w/width,offY=1.1*unit*h/height;     // 填色错位：颜色涂出线外一点
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const px=x/unit,py=y/unit;
      const sx=(x+unit*(.9*Math.sin(py*.29)+.35*Math.sin((px+py)*.61)))*w/width;
      const sy=(y+unit*(.9*Math.sin(px*.27)+.3*Math.sin((px-py)*.57)))*h/height;
      const i=y*width+x,s=i*4,source=cell(sx,sy),k=regions[source],env=edges[k];
      const detail=warm[k]?details[source]*1.1:0;
      let pen=Math.max(detail,env[label(sx-edgeWidth,sy)],env[label(sx+edgeWidth,sy)],env[label(sx,sy-edgeWidth)],env[label(sx,sy+edgeWidth)]);
      const grit=valueNoise(px*1.9,py*1.9);
      pen=pen>.35?clamp(pen*(.78+grit*.5)-(valueNoise(px*.35+40,py*.35)>.86?.6:0),0,1):0;   // 粗、毛、偶尔断笔
      const f=label(sx+offX,sy+offY),fill=fills[f],a=angles[f];
      const along=px*Math.cos(a)+py*Math.sin(a),across=-px*Math.sin(a)+py*Math.cos(a);
      const streak=(across*.62+valueNoise(along*.18,across*.9)*1.6)%1;
      const tooth=valueNoise(px*2.6,py*2.6);
      let bare=0;
      if(fill!==KID_PAPER){
        bare=(streak<.16?.62:0)+(tooth>.72?(tooth-.72)*2.4:0);
        bare=clamp(bare*(.65+valueNoise(px*.12,py*.12)*.7),0,.88);
      }
      for(let c=0;c<3;c++)out[s+c]=mix(mix(fill[c],KID_PAPER[c],bare),KID_INK[c],pen);
      out[s+3]=255;
    }
    return out;
  }

  // 波普网点：六十年代波普 / 老漫画——粗黑勾线，红黄蓝粉白几种纯色，中间调用 45° 本戴网点（Ben-Day dots）在白底上印出来。
  const POP=[[255,214,0],[232,32,42],[30,91,216],[255,138,179],[38,190,140]];
  const POP_WHITE=[255,253,246],POP_BLACK=[16,14,18];
  function popPigment(color){
    const light=luma(...color),chroma=Math.max(...color)-Math.min(...color);
    if(light>200&&chroma<36)return POP_WHITE;
    // 暗而有颜色的块保留色相（暗红仍是红）；只有近黑的中性色才用黑，暗灰用波普常见的蓝色阴影
    if(chroma<26)return light<26?POP_BLACK:light<120||color[2]>=color[0]?POP[2]:POP[3];
    // 按色相角找最近的波普原色：黄 52°、红 0°、蓝 222°、粉 335°、绿 160°（橙偏红，紫偏粉）
    const [r,g,b]=color,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
    let hue=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hue=(hue*60+360)%360;
    const HUES=[52,0,222,335,160];let best=POP[0],min=Infinity;
    HUES.forEach((hh,i)=>{const dd=Math.min(Math.abs(hue-hh),360-Math.abs(hue-hh));if(dd<min){min=dd;best=POP[i];}});
    return best;
  }
  function drawPopDots(pixels,w,h,width,height){
    const {labels,palette}=reduceColors(pixels,w,h,7);
    const regions=doodleRegions(doodleRegions(labels,w,h,palette.length,w>=70?2:1),w,h,palette.length,1);
    const fills=palette.map(popPigment),tones=palette.map(c=>luma(...c)/255);
    // 最多只留一块黑（最暗的那块），其余暗块换成蓝 / 红实色，画面不至于大片发黑
    let darkest=-1;fills.forEach((f,i)=>{if(f===POP_BLACK&&(darkest<0||tones[i]<tones[darkest]))darkest=i;});
    fills.forEach((f,i)=>{if(f===POP_BLACK&&i!==darkest)fills[i]=palette[i][0]>palette[i][2]?POP[1]:POP[2];});
    const edges=palette.map((a,i)=>palette.map((b,j)=>i===j?0:clamp((Math.sqrt(distance(...a,b))-22)/40,0,1)));
    const out=new Uint8ClampedArray(width*height*4);
    const cell=(x,y)=>clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1);
    const label=(x,y)=>regions[cell(x,y)];
    const unit=width/200,ew=Math.max(.55,1.05/Math.sqrt(width/w)),step=unit*3.6;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const sx=(x+unit*.5*Math.sin(y/unit*.21))*w/width,sy=(y+unit*.5*Math.sin(x/unit*.19))*h/height;
      const k=label(sx,sy),env=edges[k],fill=fills[k],o=(y*width+x)*4;
      const pen=Math.max(env[label(sx-ew,sy)],env[label(sx+ew,sy)],env[label(sx,sy-ew)],env[label(sx,sy+ew)]);
      let color=fill;
      if(fill!==POP_BLACK&&fill!==POP_WHITE){
        // 亮的颜色块印网点，暗的、纯的块整片平涂
        const cover=clamp(1.25-tones[k]*1.1,0,1);
        if(cover<.92){
          const u=(x+y)/Math.SQRT2/step,v=(x-y)/Math.SQRT2/step,du=u-Math.round(u),dv=v-Math.round(v);
          const r=Math.sqrt(du*du+dv*dv),rad=.62*Math.sqrt(cover);
          const t=clamp((rad-r)*step/1.1+.5,0,1);           // 网点边缘稍微柔一点，避免锯齿
          color=[0,1,2].map(c=>mix(POP_WHITE[c],fill[c],t));
        }
      }
      const ink=pen>.4?1:0;
      for(let c=0;c<3;c++)out[o+c]=mix(color[c],POP_BLACK[c],ink);
      out[o+3]=255;
    }
    return out;
  }

  // 孟菲斯涂鸦：八十年代孟菲斯设计风——糖果色大色块，每块叠一种涂鸦花纹（波浪线、圆点阵、锯齿条纹、彩纸屑、网格），
  // 粗黑描边带一点错位投影，画面抽象、热闹。
  const MEM=[[255,111,89],[255,216,77],[127,214,194],[184,161,255],[91,192,235],[255,158,205]];
  const MEM_BG=[255,248,236],MEM_INK=[20,18,24],MEM_DARK=[52,44,112];
  function drawMemphis(pixels,w,h,width,height){
    const {labels,palette}=reduceColors(pixels,w,h,6);
    const regions=doodleRegions(doodleRegions(labels,w,h,palette.length,w>=70?3:1),w,h,palette.length,w>=70?2:1);
    // 按明暗顺序分配糖果色：最暗一块用黑、最亮一块留奶油底，其余轮流取色
    const order=palette.map((c,i)=>[luma(...c),i]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    const fills=[],pattern=[];
    order.forEach((k,rank)=>{
      // 最暗一块用深靛蓝（上面印亮色花纹），最亮一块留奶油底，其余轮流取糖果色；不出现大片纯黑
      fills[k]=rank===0&&luma(...palette[k])<90?MEM_DARK:rank===order.length-1&&luma(...palette[k])>190?MEM_BG:MEM[(k*2+rank)%MEM.length];
      pattern[k]=(k*3+rank)%5;
    });
    const edges=palette.map((a,i)=>palette.map((b,j)=>i===j?0:1));
    const out=new Uint8ClampedArray(width*height*4);
    const cell=(x,y)=>clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1);
    const label=(x,y)=>regions[cell(x,y)];
    const unit=width/200,ew=Math.max(.6,1.1/Math.sqrt(width/w)),sh=1.6*unit*w/width;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const px=x/unit,py=y/unit,o=(y*width+x)*4;
      const sx=(x+unit*.8*Math.sin(py*.17))*w/width,sy=(y+unit*.8*Math.sin(px*.15))*h/height;
      const k=label(sx,sy),fill=fills[k],env=edges[k];
      const pen=Math.max(env[label(sx-ew,sy)],env[label(sx+ew,sy)],env[label(sx,sy-ew)],env[label(sx,sy+ew)]);
      // 错位投影：描边往右下再画一道
      const kd=label(sx-sh,sy-sh),shadow=kd!==k&&fills[kd]!==MEM_BG&&fill!==MEM_INK;
      let color=shadow?[0,1,2].map(c=>mix(fill[c],MEM_INK[c],.85)):fill;
      if(fill!==MEM_INK&&!shadow){
        const ink=fill===MEM_BG?MEM[(k+2)%MEM.length]:fill===MEM_DARK?MEM[1]:MEM_INK;
        let mark=false;
        switch(pattern[k]){
          case 0:{const wv=py+Math.sin(px*.42+k)*2.4;mark=Math.abs(((wv%9)+9)%9-4.5)<.75;break;}           // 波浪线
          case 1:{const gx=((px%7)+7)%7-3.5,gy=((py%7)+7)%7-3.5;mark=gx*gx+gy*gy<1.6;break;}           // 圆点阵
          case 2:{const t=px*.7+Math.abs(((py*.9)%6+6)%6-3)*1.4;mark=((t%8)+8)%8<1.4;break;}                // 锯齿条纹
          case 3:{const cx=Math.floor(px/14),cy=Math.floor(py/14),r=hash(cx+k*7,cy);                 // 彩纸屑
            if(r>.45){const ox=cx*14+3+hash(cy,cx)*8,oy=cy*14+3+hash(cx*3,cy*5)*8,a=r*6.28,dx=px-ox,dy=py-oy;
              const u=dx*Math.cos(a)+dy*Math.sin(a),v=-dx*Math.sin(a)+dy*Math.cos(a);
              mark=r>.72?Math.abs(u)<2.6&&Math.abs(v)<.8:(v>-1.4&&v<1.6&&Math.abs(u)<(1.6-v)*.9);}break;}
          default:{mark=((px%10)+10)%10<.8||((py%10)+10)%10<.8;}                                         // 网格
        }
        if(mark)color=pattern[k]===3&&fill!==MEM_BG?MEM[(k+3)%MEM.length]:ink;
      }
      const lineInk=pen>.5?1:0;
      for(let c=0;c<3;c++)out[o+c]=mix(color[c],MEM_INK[c],lineInk);
      out[o+3]=255;
    }
    return out;
  }

  const imageCache=new WeakMap();
  // 印刷网点（2026-11-22）：把海报当成一张放大看的印刷品。
  // 四色网点：青、品红、黄、黑四块版各自按 15° / 75° / 0° / 45° 排网点，叠印在白纸上，版与版之间错开一点（套印不准）；
  // 报纸网点：一块黑版 45° 网点印在泛黄的新闻纸上，网点略有扩张。
  const HT_PAPER=[252,250,244],NEWS_PAPER=[236,229,212];
  const HT_INK={c:[0,158,224],m:[232,18,122],y:[255,226,0],k:[28,28,34],news:[34,31,30]};
  function drawHalftone(pixels,w,h,width,height,style){
    const at=(x,y,c)=>{ // 双线性取样，网点大小随画面平滑变化
      const fx=clamp(x*w/width-.5,0,w-1),fy=clamp(y*h/height-.5,0,h-1),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=fx-x0,ty=fy-y0;
      const p=(xx,yy)=>pixels[(yy*w+xx)*4+c];
      return mix(mix(p(x0,y0),p(x1,y0),tx),mix(p(x0,y1),p(x1,y1),tx),ty);
    };
    const rgb=(x,y)=>[at(x,y,0),at(x,y,1),at(x,y,2)];
    const unit=width/200,news=style==="news-dots";
    const step=unit*(news?3.2:5);
    // 每块版：油墨颜色、网角、错版偏移、取这一版浓度的函数
    const plates=style==="cmyk-dots"?[
      {ink:HT_INK.y,a:0,dx:0,dy:0,f:c=>c.y},
      {ink:HT_INK.c,a:15,dx:-.7,dy:.4,f:c=>c.c},
      {ink:HT_INK.m,a:75,dx:.6,dy:-.5,f:c=>c.m},
      {ink:HT_INK.k,a:45,dx:0,dy:.2,f:c=>c.k}
    ]:[{ink:HT_INK.news,a:45,dx:0,dy:0,f:c=>c.k}];
    plates.forEach(pl=>{const r=pl.a*Math.PI/180;pl.cos=Math.cos(r);pl.sin=Math.sin(r);pl.ox=pl.dx*unit;pl.oy=pl.dy*unit;});
    const paper=news?NEWS_PAPER:HT_PAPER;
    const sep=([r,g,b])=>{ // RGB → 各版浓度（0…1）
      r/=255;g/=255;b/=255;
      if(!news){const lift=.72;r=Math.pow(r,lift);g=Math.pow(g,lift);b=Math.pow(b,lift);} // 先提亮：网点画面要透气，暗部不至于糊成一片
      if(news){const l=.24*r+.58*g+.18*b;return {k:clamp(Math.pow(1-l,1.1)*1.08-.03,0,1)};}
      const k=1-Math.max(r,g,b),d=1-k||1;
      // 黑版只压最暗处，颜色交给青、品、黄三版的彩色网点；单版浓度封顶，网点不连成一片
      return {c:Math.min(.7,(1-r-k*.5)/d*.9),m:Math.min(.7,(1-g-k*.5)/d*.9),y:Math.min(.75,(1-b-k*.5)/d*.9),k:clamp(k*1.3-.5,0,.72)};
    };
    const out=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const o=(y*width+x)*4;let col=paper.slice();
      for(const pl of plates){
        const px=x-pl.ox,py=y-pl.oy;
        // 转到这一版的网格坐标，找最近的网点中心，在中心取样决定点的大小
        const u=(px*pl.cos+py*pl.sin)/step,v=(-px*pl.sin+py*pl.cos)/step,cu=Math.round(u),cv=Math.round(v);
        const cx=(cu*pl.cos-cv*pl.sin)*step+pl.ox,cy=(cu*pl.sin+cv*pl.cos)*step+pl.oy;
        const cover=clamp(pl.f(sep(rgb(cx,cy))),0,1);if(cover<.03)continue;
        const du=u-cu,dv=v-cv,dist=Math.sqrt(du*du+dv*dv),rad=.56*Math.sqrt(cover)*(news?1.08:1);
        let t=clamp((rad-dist)*step/1.2+.5,0,1);
        if(t<=0)continue;
        for(let c=0;c<3;c++)col[c]*=1-t*(1-pl.ink[c]/255); // 油墨叠印（正片叠底）
      }
      if(news){const g=(valueNoise(x*.55+11,y*.55)-.5)*10;for(let c=0;c<3;c++)col[c]+=g;}
      for(let c=0;c<3;c++)out[o+c]=col[c];
      out[o+3]=255;
    }
    return out;
  }
  // 老电视 / CCD 复古（2026-11-22，替换 3D 光栅）
  function bilinear(pixels,w,h){
    return (fx,fy,c)=>{fx=clamp(fx,0,w-1);fy=clamp(fy,0,h-1);const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=fx-x0,ty=fy-y0,p=(xx,yy)=>pixels[(yy*w+xx)*4+c];
      return mix(mix(p(x0,y0),p(x1,y0),tx),mix(p(x0,y1),p(x1,y1),tx),ty);};
  }
  // 老电视：显像管弧面（桶形变形 + 圆角暗边），红蓝错位，水平扫描线，RGB 荧光条，高光发散，一道滚动亮带和轻微雪花
  function drawCRT(pixels,w,h,width,height){
    const at=bilinear(pixels,w,h),unit=width/200,line=Math.max(2,unit*1.5),out=new Uint8ClampedArray(width*height*4);
    const band=.25+((w*7+h*13)%50)/100; // 滚动亮带的位置（随画面固定）
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const o=(y*width+x)*4,nx=x/width*2-1,ny=y/height*2-1,r2=nx*nx+ny*ny,k=1+.07*r2; // 桶形变形
      const ux=nx*k,uy=ny*k;
      const edge=Math.max(Math.abs(ux),Math.abs(uy));
      if(edge>1){out[o]=out[o+1]=out[o+2]=10;out[o+3]=255;continue;}
      const sx=(ux+1)/2*w-.5,sy=(uy+1)/2*h-.5,ca=(.6+r2*1.4)*w/width*unit; // 越靠边红蓝分得越开
      let col=[at(sx-ca,sy,0),at(sx,sy,1),at(sx+ca,sy,2)];
      // 偏冷、对比稍强，亮部微微溢出
      col=col.map((v,c)=>{v=v/255;v=clamp((v-.5)*1.18+.52,0,1);return Math.pow(v,.92)*255*(c===2?1.04:c===0?.97:1);});
      const scan=.72+.28*Math.pow(Math.sin(y/line*Math.PI),2); // 扫描线
      const tri=Math.floor(x/Math.max(1,unit*.8))%3,mask=[tri===0?1.06:.9,tri===1?1.06:.9,tri===2?1.06:.9]; // 荧光条
      const glow=Math.exp(-Math.pow((y/height-band)*9,2))*.12;
      const vig=clamp(1-Math.pow(r2*.55,1.6),0,1)*clamp((1-edge)*28,0,1); // 四角暗、边缘圆角
      const snow=(hash(x*.7,y*1.3)-.5)*14;
      for(let c=0;c<3;c++)out[o+c]=clamp((col[c]*scan*mask[c]*(1+glow)+snow)*vig,0,255);
      out[o+3]=255;
    }
    return out;
  }
  // CCD 复古：早年小卡片机 / 初代手机的直出——画面偏软，高光过曝发白，暗部发灰偏青、亮部偏暖，
  // 颗粒和彩色噪点明显，四角轻微暗角（2026-11-22 去掉了日期戳）
  function drawCCD(pixels,w,h,width,height){
    const at=bilinear(pixels,w,h),unit=width/200,out=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const o=(y*width+x)*4,sx=x*w/width-.5,sy=y*h/height-.5;
      let r=at(sx,sy,0)/255,g=at(sx,sy,1)/255,b=at(sx,sy,2)/255;
      const l=.3*r+.59*g+.11*b;
      // 曝光偏高、高光削顶；黑位抬起
      const expo=v=>{v=v*1.18+.035;return v>.82?.82+(v-.82)*.35:v;};
      r=expo(r);g=expo(g);b=expo(b);
      // 分离色调：暗部青绿，亮部暖黄；饱和度略高
      const sh=1-l,hi=l;r+= -.03*sh+.05*hi;g+=.02*sh+.02*hi;b+=.04*sh-.06*hi;
      const m=(r+g+b)/3;r=m+(r-m)*1.15;g=m+(g-m)*1.15;b=m+(b-m)*1.15;
      const nx=x/width*2-1,ny=y/height*2-1,vig=1-.22*Math.pow(nx*nx*.8+ny*ny*.6,1.3);
      const grain=(hash(x*1.1,y*.9)-.5)*.09*(1.2-l),cn=(hash(x*.5+3,y*.5+7)-.5)*.05; // 亮度颗粒 + 彩色噪点
      out[o]=clamp((r+grain+cn)*vig*255,0,255);out[o+1]=clamp((g+grain)*vig*255,0,255);out[o+2]=clamp((b+grain-cn)*vig*255,0,255);out[o+3]=255;
    }
    return out;
  }
  // 胶片放映（2026-11-22）：像老放映机投在幕布上的一帧——中间亮、四周暗的光斑，褪色偏暖的胶片色，
  // 粗颗粒，几道竖向划痕和灰尘白点 / 黑点，画面轻微晃动错位，帧窗圆角暗边，边上一点漏光
  function drawProjector(pixels,w,h,width,height){
    const at=bilinear(pixels,w,h),unit=width/200,out=new Uint8ClampedArray(width*height*4);
    const seed=(w*31+h*17+pixels[(Math.floor(h/2)*w+Math.floor(w/2))*4])%997; // 同一张海报的划痕、灰尘固定
    const rnd=k=>hash(seed*.37+k*1.7,k*.91+seed*.13);
    const scratches=Array.from({length:3+Math.floor(rnd(1)*3)},(_,i)=>({x:rnd(10+i)*width,wob:rnd(20+i)*unit*2,len:.4+rnd(30+i)*.6,y0:rnd(40+i)*.5,dark:rnd(50+i)<.35}));
    const dust=Array.from({length:14},(_,i)=>({x:rnd(60+i)*width,y:rnd(80+i)*height,r:unit*(.5+rnd(100+i)*1.4),dark:rnd(120+i)<.5}));
    const weave=unit*.8*(rnd(7)-.5),flick=.94+rnd(8)*.1,leak=rnd(9)<.5?0:1;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const o=(y*width+x)*4,nx=x/width*2-1,ny=y/height*2-1;
      const band=Math.sin(y/height*Math.PI*3+seed)*unit*.35; // 片门晃动：画面有一点横向抖
      const sx=(x+weave+band)*w/width-.5,sy=y*h/height-.5;
      let r=at(sx,sy,0)/255,g=at(sx,sy,1)/255,b=at(sx,sy,2)/255;
      const l=.3*r+.59*g+.11*b;
      // 褪色：饱和度降低、黑位抬起、整体偏琥珀
      r=mix(l,r,.62);g=mix(l,g,.62);b=mix(l,b,.62);
      r=.07+r*.9;g=.055+g*.86;b=.04+b*.72;
      r+=.05*l;g+=.02*l;
      // 放映光斑：中心亮、边角暗
      const d2=nx*nx*.9+ny*ny*.7,spot=(1.12-.55*Math.pow(d2,1.15))*flick;
      // 颗粒（中间调最明显）
      const gr=(hash(x*1.3+seed,y*1.7)-.5)*.16*(1-Math.abs(l-.5));
      let col=[r,g,b].map(v=>(v*spot+gr));
      // 漏光：一侧边缘的暖橙光晕
      if(leak){const lk=Math.exp(-Math.pow((nx+1)*2.4,2))*.35*(.6+.4*Math.sin(ny*3+seed));col=[col[0]+lk,col[1]+lk*.45,col[2]+lk*.1];}
      // 划痕
      for(const sc of scratches){const yy=y/height;if(yy<sc.y0||yy>sc.y0+sc.len)continue;const cx=sc.x+Math.sin(yy*9+sc.x)*sc.wob,dd=Math.abs(x-cx);if(dd<unit*.6){const a=(1-dd/(unit*.6))*.55;col=col.map(v=>sc.dark?v*(1-a):v+(1-v)*a);}}
      // 灰尘
      for(const p of dust){const dd=Math.hypot(x-p.x,(y-p.y)*.8);if(dd<p.r){const a=(1-dd/p.r)*.8;col=col.map(v=>p.dark?v*(1-a):v+(1-v)*a);}}
      // 帧窗：圆角暗边
      const ex=Math.max(0,Math.abs(nx)-.9)/.1,ey=Math.max(0,Math.abs(ny)-.93)/.07,gate=clamp(1-Math.hypot(ex,ey),0,1);
      for(let c=0;c<3;c++)out[o+c]=clamp(col[c]*255*(.08+.92*gate),0,255);
      out[o+3]=255;
    }
    return out;
  }
  // 70mm 胶片（2026-11-22）：像在灯箱上扫描的一格 70mm 正片——两侧黑色片基上一排排圆角齿孔透出灯箱的白光，
  // 片边印着「70MM SAFETY FILM」和帧号；画面色彩浓郁、对比稍强、细颗粒，高光边缘有一圈红色光晕（halation）
  const FONT5={"0":"01110100011001110101110011000101110","1":"00100011000010000100001000010001110","2":"01110100010000100110010001000011111","3":"11110000010000101110000010000111110","4":"00010001100101010010111110001000010","5":"11111100001111000001000011000101110","6":"00110010001000011110100011000101110","7":"11111000010001000100010000100001000","8":"01110100011000101110100011000101110","9":"01110100011000101111000010001001100","M":"10001110111010110001100011000110001","F":"11111100001000011110100001000010000","S":"01111100001000001110000010000111110","A":"01110100011000111111100011000110001","E":"11111100001000011110100001000011111","T":"11111001000010000100001000010000100","Y":"10001100010101000100001000010000100","I":"01110001000010000100001000010001110","L":"10000100001000010000100001000011111",">":"10000010000010000010001000100010000"};
  function drawFilm70(pixels,w,h,width,height){
    const at=bilinear(pixels,w,h),unit=width/200,out=new Uint8ClampedArray(width*height*4);
    const edge=Math.round(width*.11),ix0=edge,ix1=width-edge,iy0=Math.round(unit*3),iy1=height-Math.round(unit*3),iw=ix1-ix0,ih=iy1-iy0;
    const base=[18,14,12],light=[244,240,228];
    const ph=unit*4.4,pw=unit*4.2,pr=unit*1,px0=Math.round(edge*.42-pw/2); // 齿孔：高 ph、宽 pw、圆角 pr，间距 1.8 倍高
    const hole=(x,y)=>{const lx=x<width/2?x-px0:x-(width-px0-pw);if(lx<0||lx>pw)return 0;const k=((y+ph*.4)%(ph*1.8)),ly=k;if(ly>ph)return 0;
      const dx=Math.max(0,Math.max(pr-lx,lx-(pw-pr))),dy=Math.max(0,Math.max(pr-ly,ly-(ph-pr)));return clamp(1-(Math.hypot(dx,dy)-pr+.5),0,1);};
    // 先算画面（含红色光晕）
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const o=(y*width+x)*4;let col;
      if(x>=ix0&&x<ix1&&y>=iy0&&y<iy1){
        const sx=(x-ix0)/iw*w-.5,sy=(y-iy0)/ih*h-.5;
        let r=at(sx,sy,0)/255,g=at(sx,sy,1)/255,b=at(sx,sy,2)/255;
        // 胶片色：S 形对比、饱和度提高、暗部微微偏青、亮部偏暖
        const S=v=>v*v*(3-2*v)*.4+v*.6;r=S(r);g=S(g);b=S(b);
        const m=(r+g+b)/3;r=m+(r-m)*1.1;g=m+(g-m)*1.1;b=m+(b-m)*1.08;
        const l=.3*r+.59*g+.11*b;r+=.04*l-.01;b+=.03*(1-l)-.02;
        // halation：周围高光在这里渗出的红晕（取样附近几个点的亮部）
        let hal=0;for(const [ox,oy] of [[2.2,0],[-2.2,0],[0,2.2],[0,-2.2]]){const q=(at(sx+ox,sy+oy,0)+at(sx+ox,sy+oy,1))/510;hal+=Math.max(0,q-.78);}
        r+=hal*.5;g+=hal*.08;
        const gr=(hash(x*1.9,y*2.3)-.5)*.07;
        // 画框四角轻微圆角
        const cx=Math.max(0,Math.max(ix0+unit*1.5-x,x-(ix1-1-unit*1.5))),cy=Math.max(0,Math.max(iy0+unit*1.5-y,y-(iy1-1-unit*1.5))),inside=clamp(unit*1.5-Math.hypot(cx,cy)+.5,0,1);
        col=[r+gr,g+gr,b+gr].map((v,c)=>mix(base[c],clamp(v,0,1)*255,inside));
      } else {
        // 片基：近黑偏棕，轻微不均匀
        const n=(valueNoise(x*.08,y*.05)-.5)*8;col=base.map(v=>v+n);
        const t=hole(x,y);if(t>0)col=col.map((v,c)=>mix(v,light[c]-(hash(x,y)*10),t));
      }
      for(let c=0;c<3;c++)out[o+c]=clamp(col[c],0,255);
      out[o+3]=255;
    }
    // 片边字：沿齿孔外侧竖排，暖黄色的小点阵字
    const put=(px,py)=>{px=Math.round(px);py=Math.round(py);if(px<0||py<0||px>=width||py>=height)return;const o=(py*width+px)*4;out[o]=mix(out[o],232,.85);out[o+1]=mix(out[o+1],196,.85);out[o+2]=mix(out[o+2],120,.85);};
    const dot=Math.max(1,Math.round(unit*.55)),colX=Math.min(width-1,px0+pw+Math.round(unit*1.6));
    const vtext=(txt,x,y0)=>{let y=y0;for(const ch of txt){if(ch===" "){y+=dot*4;continue;}const g=FONT5[ch];if(!g){y+=dot*6;continue;}
      for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(g[r*5+c]==="1"){ // 竖排：字顺时针转 90°
        for(let a=0;a<dot;a++)for(let b=0;b<dot;b++)put(x+(6-r)*dot+a,y+c*dot+b);}
      y+=dot*6;}};
    const frame=String(10+Math.floor(hash(w,h)*80));
    vtext("70MM SAFETY FILM",colX,Math.round(height*.12));
    vtext(">"+frame,colX,Math.round(height*.68));
    vtext(frame+"A",width-colX-dot*7,Math.round(height*.3));
    return out;
  }
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
        // 童趣蜡笔、卡通要保留人物轮廓，取样更细（其余风格保持原来的粗取样）
        const sw=style==="film70"?Math.min(170,Math.max(60,Math.round(width*.5))):style==="projector"?Math.min(150,Math.max(52,Math.round(width*.45))):style==="crt"?Math.min(170,Math.max(60,Math.round(width*.55))):style==="ccd"?Math.min(120,Math.max(44,Math.round(width*.38))):style==="cmyk-dots"||style==="news-dots"?Math.min(140,Math.max(48,Math.round(width*.45))):style==="pop-dots"||style==="memphis"?Math.min(120,Math.max(40,Math.round(width*.4))):style==="kid-crayon"?Math.min(160,Math.max(48,Math.round(width*.5))):Math.min(92,Math.max(32,Math.round(width*.4)));
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

  return {styles,storageKey,normalize,filmStyleOptions,readFilmStyles,saveFilmStyle,markArt,artSnapshot,applyArt,stylize,paint};
});
