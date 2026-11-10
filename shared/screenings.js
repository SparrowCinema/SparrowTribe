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
  return {keyOf,apply};
});
