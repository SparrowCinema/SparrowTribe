// 现场认证（2026-11-22）：签到码解析、观影记录合并、票根写回、票面文字与同步字段。
// 服务器签名与时间窗校验在 backend/tickets-checkin-v1.sql（本地 Postgres 测过：伪造窗口 / 换影片 → bad，过期 → expired，重复签到幂等）。
const assert=require('assert'),T=require('../shared/tickets.js'),S=require('../shared/psync.js'),G=require('../shared/growth.js');

// ——— 签到码 ———
const url=T.checkinURL('gh63-f1','s15aaok04',14801234,'0123456789ab');
assert.equal(url,'https://sparrowcinema.org/#checkin=gh63-f1~s15aaok04~14801234~0123456789ab');
assert.deepStrictEqual(T.checkinParse(url),{f:'gh63-f1',h:'s15aaok04',w:14801234,k:'0123456789ab'});
assert.deepStrictEqual(T.checkinParse('checkin=gh63-f1~s15aaok04~14801234~0123456789AB').k,'0123456789ab');
const keyShow=T.checkinURL('f1','11/08-19:30-v1-h1',1,'aaaaaaaaaaaa');
assert.equal(T.checkinParse(keyShow).h,'11/08-19:30-v1-h1','screening key fallback survives encoding');
for (const bad of ['','https://x/#verify=ABC','#checkin=a~b~c','#checkin=f~h~12~zzzzzzzzzzzz','#checkin=f~h~x~0123456789ab','SPARROW-SYNC:SP-1']) assert.equal(T.checkinParse(bad),null,bad);

// ——— 观影记录合并 ———
const now=1763800000000;
let p=T.checkinPlan(undefined,G,'f1','2026-11-08','K1',now);
assert.deepStrictEqual(p.rec,{d:'2026-11-08',r:0,k:'K1',t:now});assert.equal(p.key,'f1|2026-11-08');
// 已有同一天同一场：不改记录
p=T.checkinPlan({d:'2026-11-08',r:8,k:'K1',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec,null);assert.equal(p.key,'f1|2026-11-08');
// 同一天但没记场次：补上场次，保留评分
p=T.checkinPlan({d:'2026-11-08',r:8,k:'',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec.k,'K1');assert.equal(p.rec.r,8);assert.equal(p.key,'f1|2026-11-08');
// 以前看过别的日期：新增一次观影
p=T.checkinPlan({d:'2026-10-01',r:6,k:'K0',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(G.views(p.rec).length,2);assert.equal(p.key,'f1|2026-11-08');assert.equal(G.views(p.rec).find(v=>v.d==='2026-11-08').k,'K1');
// 同一天看两场：第二场的键带 |2
const two=T.checkinPlan({d:'2026-11-08',r:6,k:'K0',t:5},G,'f1','2026-11-08','K2',now);
assert.equal(two.key,'f1|2026-11-08|2');
// 已删除的记录：重新盖章
p=T.checkinPlan({del:1,t:900},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec.d,'2026-11-08');assert(p.rec.t>900);

// ——— 票根写回 ———
let e=T.applyCheckin(undefined,'f1|2026-11-08',null);
assert(T.serialValid(e.n),'serial frozen before request');
const n=e.n;
e=T.applyCheckin(e,'f1|2026-11-08',{ok:true,no:7,h:'s15aaok04',sno:3,ci:'2026-11-08T11:42:00+00:00'});
assert.equal(e.n,n);assert.equal(e.q,7);assert.equal(e.sh,'s15aaok04');assert.equal(e.sq,3);assert.equal(e.ci,Date.parse('2026-11-08T11:42:00Z'));
const kept=T.applyCheckin({...e,q:5},'f1|2026-11-08',{ok:true,no:9,h:'x',sno:8,ci:'2026-11-09T00:00:00Z'});
assert.equal(kept.q,5);assert.equal(kept.sh,'s15aaok04');assert.equal(kept.ci,e.ci,'first values win');
assert.equal(T.applyCheckin(e,'f1|2026-11-08',{ok:false,reason:'expired'}).ci,e.ci);

// ——— 票面与同步 ———
const base=(filmId,view,date)=>({filmId,title:'测试片',subtitle:'',programmeId:'gh',programme:'2026 第63届金马影展',section:'',date,time:'19:30',venue:'信义威秀',hall:'1厅',city:'台北',showId:'s15aaok04',format:'4K',art:'',arts:[]});
const store=S.cleanTix({'f1|2026-11-08':e});
assert.equal(store['f1|2026-11-08'].ci,e.ci,'psync keeps ci');
const row=T.build([{key:'f1|2026-11-08',filmId:'f1',view:{d:'2026-11-08',r:0,k:'K1'}}],store,base).tickets[0];
assert(row.checkedIn>0);
assert.equal(T.editionLines(row).line2,'现场认证 · 本场第 3 张');
assert(T.badgesOf(row).includes('现场认证'));
assert.equal(T.entryFrom({...row,seat:'1排1座'},base('f1',{},'2026-11-08')).ci,e.ci,'editing keeps ci');
const merged=S.mergeTix(store,S.cleanTix({'f1|2026-11-08':{t:e.t+9,n,st:'2排'}}));
assert.equal(merged['f1|2026-11-08'].ci,e.ci,'merge fills ci back');

// ——— 小程序码 scene（wxacode.getUnlimited ≤32 字符） ———
const sc=T.checkinScene('s15aaok04',14949570,'0123456789AB');
assert(sc.length>0 && sc.length<=32,'scene fits 32-char wxacode limit: '+sc);
assert(/^[0-9A-Za-z!#$&'()*+,/:;=?@\-._~]+$/.test(sc),'scene uses wxacode-safe chars');
assert.deepStrictEqual(T.checkinSceneParse(sc),{h:'s15aaok04',w:14949570,k:'0123456789ab'});
assert.deepStrictEqual(T.checkinSceneParse(encodeURIComponent(sc)),{h:'s15aaok04',w:14949570,k:'0123456789ab'});
assert.deepStrictEqual(T.checkinSceneParse('pages/checkin/checkin?scene='+encodeURIComponent(sc)),{h:'s15aaok04',w:14949570,k:'0123456789ab'});
assert.equal(T.checkinScene('too_long_sid_12345',14949570,'0123456789ab'),'','rejects sid > 12 chars');
assert.equal(T.checkinScene('s15aaok04',0,'0123456789ab'),'','rejects non-positive window');
assert.equal(T.checkinScene('s15aaok04',14949570,'nothex123456'),'','rejects non-hex token');
for (const bad of ['','c~s1~0~0123456789ab','c~s1~8wex2~zzzzzzzzzzzz','x~s1~8wex2~0123456789ab','#checkin=f~h~1~0123456789ab']) {
  assert.equal(T.checkinSceneParse(bad),null,'rejects invalid scene: '+bad);
}

// ——— 小程序页面与云函数接线检查 ———
const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..');
const appJson=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json'),'utf8'));
assert(appJson.pages.includes('pages/checkin/checkin'),'pages/checkin/checkin registered in main package');
assert(appJson.subPackages.some(sp=>sp.root==='packages/collect' && sp.pages.includes('checkin-host/checkin-host')),'checkin-host registered in collect subpackage');
for (const rel of ['cloudfunctions/psync/index.js','cloudfunctions/wxacode/index.js']) {
  const src=fs.readFileSync(path.join(root,rel),'utf8');
  new vm.Script(src,{filename:rel});
}
const psyncSrc=fs.readFileSync(path.join(root,'cloudfunctions/psync/index.js'),'utf8');
assert(psyncSrc.includes("action === 'checkinCode'"),'psync handles checkinCode');
assert(psyncSrc.includes("action === 'autographList'"),'psync handles autographList');
assert(psyncSrc.includes("action === 'autographPut'"),'psync handles autographPut');
assert(fs.readFileSync(path.join(root,'cloudfunctions/wxacode/index.js'),'utf8').includes("'pages/checkin/checkin'"),'wxacode allows pages/checkin/checkin');
const hostWxml=fs.readFileSync(path.join(root,'miniprogram/packages/collect/checkin-host/checkin-host.wxml'),'utf8');
assert(!/password\s*=\s*"true"/.test(hostWxml),'host PIN input must not hardcode password="true" (blocks WeChat paste)');
assert(hostWxml.includes('bindtap="pastePin"'),'host page exposes one-tap clipboard paste');
assert(hostWxml.includes('id="ch-ag-pad"') && hostWxml.includes('bindtap="agPickPhoto"'),'host page exposes guest autograph pad & photo trace');

// ——— 小程序页面运行时回归（捕获 U.showYmd / HT.dismiss 等导出名错误与剪贴板粘贴、主创签名） ———
if (!process.argv.includes('--runtime')) {
  require('child_process').execFileSync(process.execPath, [__filename, '--runtime'], { stdio: 'inherit' });
  console.log('PASS: on-site check-in — code parse, wxacode scene, passport merge, ticket write-back, ticket marks, sync, mini-program wiring, host autographs & page runtime.');
} else (async () => {
  const fullData = require('./full-data.js');
  const sampleShow = fullData.shows.find(s => s.sid && fullData.films.some(f => f.id === s.id));
  assert(sampleShow, 'full-data has a show with sid');
  const storage = new Map();
  let clipboard = '  HOST-PIN-2026  ';
  let lastToast = '';
  let agStore = [{ i: 0, name: '旧嘉宾', role: '导演', st: [[100, 200, 400, 220]] }];
  const makeFakeCanvas = () => ({
    width: 300,
    height: 150,
    getContext: () => ({
      clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, stroke: () => {}, fillRect: () => {}, drawImage: () => {},
      scale: () => {}, setTransform: () => {}
    }),
    toDataURL: () => 'data:image/png;base64,SIG'
  });

  global.wx = {
    env: { USER_DATA_PATH: '/tmp' },
    getStorageSync: k => (storage.has(k) ? storage.get(k) : ''),
    setStorageSync: (k, v) => { storage.set(k, v); },
    removeStorageSync: k => { storage.delete(k); },
    getSystemInfoSync: () => ({ language: 'zh_CN', pixelRatio: 2 }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
    setNavigationBarTitle: () => {},
    setKeepScreenOn: () => {},
    showToast: o => { lastToast = (o && o.title) || ''; },
    showModal: o => { o && o.success && o.success({ confirm: true }); },
    getClipboardData: o => { o && o.success && o.success({ data: clipboard }); },
    createSelectorQuery: () => ({
      in() { return this; },
      select() { return this; },
      fields() { return this; },
      exec(cb) { cb([{ node: makeFakeCanvas(), width: 300, height: 150, left: 0, top: 0 }]); }
    }),
    getFileSystemManager: () => ({
      writeFileSync: () => {},
      unlinkSync: () => {}
    }),
    cloud: {
      callFunction: async ({ name, data }) => {
        if (name === 'psync' && data.action === 'checkinCode') {
          return { result: { ok: true, w: 14949570, k: '0123456789ab', n: 5 } };
        }
        if (name === 'psync' && data.action === 'autographList') {
          return { result: { ok: true, items: agStore.slice() } };
        }
        if (name === 'psync' && data.action === 'autographPut') {
          if (data.st === null) {
            agStore = agStore.filter(g => g.i !== data.i);
          } else {
            agStore = agStore.filter(g => g.i !== data.i).concat([{ i: data.i, name: data.nm, role: data.rl, st: data.st }]).sort((a, b) => a.i - b.i);
          }
          return { result: { ok: true, items: agStore.slice() } };
        }
        if (name === 'wxacode') {
          return { result: { ok: true, dataUrl: 'data:image/png;base64,AAAA' } };
        }
        if (name === 'psync' && data.action === 'checkin') {
          return { result: { ok: true, no: 11, h: data.item.h, sno: 4, ci: '2026-11-28T05:00:00Z' } };
        }
        return { result: { ok: true } };
      }
    }
  };
  global.getApp = () => ({
    globalData: { data: fullData, source: 'cloud', full: true },
    onData: () => () => {},
    loadRemote: () => {}
  });
  function loadPage(rel) {
    let def = null;
    global.Page = o => { def = o; };
    const abs = path.join(root, rel);
    delete require.cache[require.resolve(abs)];
    require(abs);
    assert(def, 'Page() registered for ' + rel);
    const inst = Object.assign({}, def, {
      data: JSON.parse(JSON.stringify(def.data || {})),
      setData(patch, cb) { Object.assign(this.data, patch); if (typeof cb === 'function') cb(); }
    });
    return inst;
  }

  // 1) 主办方动态小程序码页：场次列表、自动回落「全部待映」、粘贴密钥、出码、主创签名手写/描摹/保存/删除
  const U = require('../miniprogram/utils/util.js');
  const idx = U.index(fullData);
  const sampleMs = U.showDate(sampleShow, idx).getTime();
  const realNow = Date.now;
  try {
    // 场景 A：不在任何场次前后 14 小时内 → 自动切到 showAll，不空列表
    Date.now = () => sampleMs - 72 * 36e5;
    const host = loadPage('miniprogram/packages/collect/checkin-host/checkin-host.js');
    host.onLoad();
    assert(host.data.labels.length > 0, 'checkin-host renders upcoming screenings');
    assert.equal(host.data.showAll, true, 'auto-enables showAll when no show within 14h');
    assert(/^\d{4}\/\d{2}\/\d{2}/.test(host._shows[0].time), 'showMeta time formatted via U.ymd: ' + host._shows[0].time);
    assert.equal(host.data.hidePin, false, 'PIN input starts unmasked so native paste works');

    // 粘贴密钥 + 显隐切换
    host.pastePin();
    assert.equal(host.data.pin, 'HOST-PIN-2026', 'pastePin trims and sets pin');
    assert.equal(storage.get('sk-host-key'), 'HOST-PIN-2026', 'pastePin persists pin');
    assert.equal(lastToast, '已粘贴主办密钥');
    host.toggleHidePin();
    assert.equal(host.data.hidePin, true, 'toggleHidePin masks pin');

    // 选择场次并生成小程序码 + 自动加载主创签名列表
    host.pickShow({ detail: { value: 0 } });
    await new Promise(r => setTimeout(r, 30));
    assert.equal(host.data.err, '', 'host refresh succeeds without error');
    assert.equal(host.data.count, 5, 'host count updated');
    assert(host.data.qr, 'host qr image populated');
    assert.equal(host.data.agReady, true, 'autograph panel loaded');
    assert.equal(host.data.agList.length, 1, 'existing autograph rendered');
    assert.equal(host.data.agFree, 1, 'next free slot computed');
    assert.equal(host.data.agList[0].img, 'data:image/png;base64,SIG', 'autograph preview generated');

    // 手写签名 + 撤销 + 保存
    host.agStart({ touches: [{ x: 30, y: 40 }] });
    host.agMove({ touches: [{ x: 90, y: 70 }] });
    host.agMove({ touches: [{ x: 160, y: 60 }] });
    host.agEnd();
    assert.equal(host._agStrokes.length, 1, 'hand-drawn stroke recorded');
    assert.equal(host.data.agHasInk, true, 'pad detects ink');
    host.agUndo();
    assert.equal(host._agStrokes.length, 0, 'agUndo removes last stroke');
    // 照片描摹：白底黑线合成图 → 识别出笔画
    const pw = 120, ph = 60, px = new Uint8ClampedArray(pw * ph * 4).fill(255);
    for (let x = 20; x < 100; x++) for (let dy = -1; dy <= 1; dy++) {
      const k = ((30 + dy) * pw + x) * 4;
      px[k] = px[k + 1] = px[k + 2] = 15;
    }
    host._agPhoto = { width: pw, height: ph, data: px };
    host.agRetrace(0);
    assert(host._agStrokes.length >= 1, 'photo trace extracts strokes');
    host.onAgName({ detail: { value: '张艺谋' } });
    host.onAgRole({ detail: { value: '导演' } });
    await host.agSave();
    assert.equal(lastToast, '签名已保存');
    assert.equal(host.data.agList.length, 2, 'saved guest appended to list');
    assert.equal(host.data.agName, '', 'name reset after save');

    // 删除旧签名
    host.agDelete({ currentTarget: { dataset: { idx: 0 } } });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(host.data.agList.length, 1, 'deleted guest removed from list');
    assert.equal(host.data.agList[0].name, '张艺谋');
    // 旧版 psync 云函数返回 unknown action 时，明确提示重新部署 psync 云函数
    const origCall = wx.cloud.callFunction;
    wx.cloud.callFunction = async ({ name, data }) => name === 'psync' && data.action === 'autographList' ? { result: { ok: false, msg: 'unknown action' } } : origCall({ name, data });
    await host.loadAutographs(true);
    wx.cloud.callFunction = origCall;
    assert.equal(host.data.agReady, false);
    assert.equal(host.data.agErr, '请重新部署 psync 云函数以在小程序使用主创签名', 'unknown action shows redeploy psync hint');
    host.onUnload();

    // 2) 观众扫码现场认证页：onLoad(scene)、showMeta、签到写回、关闭首页提示
    const scene = T.checkinScene(sampleShow.sid, 14949570, '0123456789ab');
    const page = loadPage('miniprogram/pages/checkin/checkin.js');
    page.onLoad({ scene });
    await new Promise(r => setTimeout(r, 30));
    assert.equal(page.data.state, 'ok', 'audience checkin completes');
    assert(page.data.film && /^\d{4}\/\d{2}\/\d{2}/.test(page.data.film.time), 'audience film.time formatted via U.ymd');
    assert(page.data.ed && page.data.ed.line2.includes('现场认证'), 'edition line shows 现场认证');
    page.dismissHomeTip();
    assert.equal(page.data.homeTip, false, 'dismissHomeTip calls HT.close cleanly');
    page.onUnload();
  } finally {
    Date.now = realNow;
  }

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
