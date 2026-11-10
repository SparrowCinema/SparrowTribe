/* World-premiere metadata and bilingual credit rows shared by web and mini-program. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SparrowPremiere=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const pending=()=>({status:'pending',date:null,festival:null,festivalEn:null,kind:'unknown'});
  function rows(f,en){
    if(f.ev)return [];
    const p=f.worldPremiere||pending(),t=(zh,eng)=>en?eng:zh;
    let date=p.date?String(p.date).replace(/-/g,'.'):t('待核实','To be verified');
    let festival=(en?p.festivalEn:p.festival)||t('待核实','To be verified');
    if(p.status==='withheld'){date=t('暂不公开','Not disclosed');festival=t('暂不公开','Not disclosed');}
    if(p.status==='unannounced'){date=t('尚未公布','Not announced');festival=t('尚未公布','Not announced');}
    if(p.kind==='theatrical')festival=t('非影展首映','Non-festival premiere');
    if(p.kind==='collection'){date=t('按收录作品分别登记','Varies by included work');festival=t('按收录作品分别登记','Varies by included work');}
    if(p.dateNote)date+=' · '+((en?p.dateNoteEn:p.dateNote)||p.dateNote);
    const out=[[t('全球首映时间','World premiere date'),date],[t('首映影展','Premiere festival'),festival]];
    if(f.releaseArchive&&f.releaseArchive.date)out.push([t('内地公映日存档','Mainland release-date archive'),String(f.releaseArchive.date).replace(/-/g,'.')+t(' · 非影院实际场次，无具体开场时刻',' · Not an actual screening; no verified start time')]);
    const a=f.screeningArchive;
    if(a)out.push([t('用户指定存档场次','User-assigned archive screening'),a.date.replace(/-/g,'.')+' '+a.t+' · '+(a.v==='hz-mixc-imax'?t('杭州万象影城激光IMAX厅','Hangzhou MixC · Laser IMAX'):t('星光嘉映来福士 · 杜比巨幕4K厅','Xingguang Jiaying Raffles · Dolby Giant Screen 4K'))+t(' · 非核实历史排片',' · Historical venue and time not verified')]);
    return out;
  }
  return {pending,rows};
});
