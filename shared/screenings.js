/* Screening identity and explicitly dated, user-assigned archive records. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SparrowScreenings=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const keyOf=s=>`${s.d}-${s.t}-${s.v}-${s.h}`+(s.archive===true?`-archive-${s.id}`:'');
  function apply(data){
    const films=Object.fromEntries((data.films||[]).map(f=>[f.id,f]));
    data.shows=(data.shows||[]).map(s=>{
      const a=films[s.id]&&films[s.id].screeningArchive;
      // Older getData deployments omit extra show fields. Restore only an exact metadata match.
      if(a&&a.kind==='user-assigned'&&a.actualVerified===false&&['d','t','v','h'].every(k=>s[k]===a[k]))return Object.assign({},s,{year:a.year,archive:true});
      return s;
    });
    return data;
  }
  const IND_RE=/产业放映|不对外展映|不对外售票|Industry screening/i;
  const PRESS_RE=/媒体场|媒体试映|Press screening/i;
  const FREE_RE=/免费放映|Free admission/i;
  function audienceType(s,f){
    if(s&&s.audience&&['public','industry','press','free'].includes(s.audience))return s.audience;
    const note=String((f&&f.screeningNotes&&f.screeningNotes[keyOf(s)])||'');
    if(IND_RE.test(note))return 'industry';
    if(PRESS_RE.test(note))return 'press';
    if(FREE_RE.test(note))return 'free';
    return 'public';
  }
  function audienceLabel(type,en){
    if(type==='industry')return en?'Industry':'产业场';
    if(type==='press')return en?'Press':'媒体场';
    if(type==='free')return en?'Free':'免费';
    return '';
  }
  function isRestricted(s,f){const t=audienceType(s,f);return t==='industry'||t==='press';}
  function accessList(s,f,venue){
    const out=[],seen={};
    const push=arr=>{if(!Array.isArray(arr))return;for(let i=0;i<arr.length;i++){const x=String(arr[i]||'').trim();if(x&&!seen[x]){seen[x]=1;out.push(x);}}};
    push(f&&f.access);
    push(s&&s.access);
    if(venue){
      const hall=(venue.halls||[]).find(h=>h&&h.id===(s&&s.h));
      push(hall&&hall.access);
      push(venue.access);
    }
    return out;
  }
  function hasAccess(s,f,venue){return accessList(s,f,venue).length>0;}
  return {keyOf,apply,audienceType,audienceLabel,isRestricted,accessList,hasAccess};
});
