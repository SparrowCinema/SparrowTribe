/* 麻雀观影护照 · 换域名时把网页版本机记录带到新网址（docs/domain-move.md）。
   浏览器的 localStorage 按「源」隔离：sparrowcinema.github.io 里的观影记录、票根、排片，换到 sparrowcinema.org 后读不到。
   而且 GitHub Pages 绑定自定义域名后会把 sparrowcinema.github.io/SparrowTribe/* 直接 301 到新域名，旧页面没机会运行。
   所以在旧源上一个不会被跳转的位置放一张「搬家页」（MOVE.bridge，由 tools/build-bridge.js 生成）：
     新网址第一次打开 → 整页跳到搬家页（顶层跳转，不用 iframe：Safari / Chrome / Firefox 都会把 iframe 里的存储按顶层网站分区，读不到真数据）
     → 搬家页读出旧源的记录，压缩后放进网址 #spmig= 片段带回新网址（片段不会发给服务器；太大时分几段来回）
     → 新网址写入本机，去掉片段，恢复原来的 #路由，照常启动。
   只认白名单前缀的键；搬家页只把数据交给 MOVE.targets 里的源。网站、搬家页和测试共用这一份文件（只用 ES5 + Promise）。 */
(function (root) {
  'use strict';
  var MOVE = {
    from: 'https://sparrowcinema.github.io',
    to: 'https://sparrowcinema.org',
    targets: ['https://sparrowcinema.org', 'https://www.sparrowcinema.org'],
    bridge: 'https://sparrowcinema.github.io/move.html',
    ready: '/move-ready.json',           // 新网址上线后才有的文件：旧网址据此判断新域名已经生效
    flag: 'sparrow-moved-in-v1',          // 新源：已经搬过（或确认没有可搬的）
    outFlag: 'sparrow-moved-out-v1',      // 旧源：记录被读出过的时间（只做记录，旧数据不删除，留作备份）
    chunk: 900000                         // 每段网址片段的字符数；各浏览器的网址上限都在 2MB 左右或以上
  };
  var PREFIX = ['sparrow', 'sk-', 'style-kaleidoscope'];
  var SKIP = { 'sparrow-stat-vid': 1, 'sparrow-host-key': 1, 'sparrow-moved-in-v1': 1, 'sparrow-moved-out-v1': 1 };
  /* 新源上只要有这些键之一，就说明用户已经在新网址用过，不再自动搬（避免旧数据盖掉新数据） */
  var USER = ['sparrow-watched-v1', 'style-kaleidoscope-plan-v1', 'sparrow-tickets-v2', 'sparrow-tickets-v1', 'sparrow-want-v1', 'sparrow-sync', 'sparrow-holder'];

  function keep(k) {
    if (typeof k !== 'string' || SKIP[k]) return false;
    for (var i = 0; i < PREFIX.length; i++) if (k.indexOf(PREFIX[i]) === 0) return true;
    return false;
  }
  function collect(ls) {
    var out = {}, n = 0;
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (keep(k)) { var v = ls.getItem(k); if (v !== null) { out[k] = v; n++; } } }
    return n ? out : null;
  }
  function hasUserData(ls) {
    for (var i = 0; i < USER.length; i++) { var v = ls.getItem(USER[i]); if (v && v !== '{}' && v !== '[]' && v !== 'null') return true; }
    return false;
  }
  /* FNV-1a，校验各段拼回来的是同一份数据 */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + s.length.toString(36);
  }
  function b64u(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  function unutf8(b) { return new TextDecoder().decode(b); }
  function pipe(bytes, Stream, kind) {
    var stream = new Blob([bytes]).stream().pipeThrough(new Stream(kind));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }
  /* 编码：g=gzip（有 CompressionStream 时），u=不压缩 */
  function encode(obj) {
    var raw = utf8(JSON.stringify({ v: 1, d: obj }));
    if (typeof CompressionStream === 'function') {
      return pipe(raw, CompressionStream, 'gzip').then(function (z) { return 'g' + b64u(z); }, function () { return 'u' + b64u(raw); });
    }
    return Promise.resolve('u' + b64u(raw));
  }
  function decode(str) {
    var kind = str.charAt(0), bytes = unb64u(str.slice(1));
    var p = kind === 'g' ? pipe(bytes, DecompressionStream, 'gzip') : kind === 'u' ? Promise.resolve(bytes) : Promise.reject(new Error('bad kind'));
    return p.then(function (b) {
      var o = JSON.parse(unutf8(b));
      if (!o || o.v !== 1 || !o.d || typeof o.d !== 'object') throw new Error('bad payload');
      return o.d;
    });
  }
  /* 片段格式：#spmig=1.<id>.<第几段>.<共几段>.<数据>；没有可搬的数据时 #spmig=1.0.0.0. */
  function pieces(str, size) {
    size = size || MOVE.chunk;
    var id = hash(str), n = Math.max(1, Math.ceil(str.length / size)), out = [];
    for (var i = 0; i < n; i++) out.push('1.' + id + '.' + i + '.' + n + '.' + str.slice(i * size, (i + 1) * size));
    return out;
  }
  function parse(fragment) {
    var m = /^#?spmig=1\.([0-9a-z]+)\.(\d+)\.(\d+)\.([A-Za-z0-9_-]*)$/.exec(fragment || '');
    if (!m) return null;
    var i = +m[2], n = +m[3];
    if (m[1] === '0') return { empty: true };
    if (!(n >= 1 && n <= 64 && i < n)) return null;
    return { id: m[1], i: i, n: n, data: m[4] };
  }
  function assemble(parts) {
    if (!parts || !parts.length) return null;
    var id = parts[0].id, n = parts[0].n, s = '';
    for (var i = 0; i < n; i++) { var p = parts[i]; if (!p || p.id !== id || p.i !== i || p.n !== n) return null; s += p.data; }
    return hash(s) === id ? s : null;
  }
  /* 写入新源。只在新源还没有用户数据时调用，所以按旧源覆盖（新源里最多只有启动时写下的默认设置） */
  function apply(ls, obj) {
    var n = 0;
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keep(k) && typeof obj[k] === 'string') { try { ls.setItem(k, obj[k]); n++; } catch (e) {} }
    return n;
  }
  function targetOK(url) {
    try {
      var u = new URL(url);
      return MOVE.targets.indexOf(u.origin) >= 0 && u.username === '' && u.password === '';
    } catch (e) { return false; }
  }
  function bridgeURL(to, part) {
    return MOVE.bridge + '?to=' + encodeURIComponent(to) + '&part=' + (part || 0);
  }

  /* ——— 搬家页（旧源）———
     env: {ls, location:{search, replace}}；返回 Promise<目标网址|null> 并跳转 */
  function runBridge(env) {
    var q = /[?&]to=([^&#]*)/.exec(env.location.search), pm = /[?&]part=(\d+)/.exec(env.location.search);
    var to = q ? decodeURIComponent(q[1]) : '', part = pm ? +pm[1] : 0;
    if (!targetOK(to)) to = MOVE.to + '/';
    to = to.split('#')[0];
    var data = null;
    try { data = collect(env.ls); } catch (e) {}
    if (!data) { env.location.replace(to + '#spmig=1.0.0.0.'); return Promise.resolve(to); }
    return encode(data).then(function (str) {
      var list = pieces(str), p = list[Math.min(part, list.length - 1)];
      try { env.ls.setItem(MOVE.outFlag, String(Date.now())); } catch (e) {}
      var url = to + '#spmig=' + p;
      env.location.replace(url);
      return url;
    });
  }

  /* ——— 新网址（新源）———
     在页面最前面调用，返回 Promise：'leave' 表示页面正在跳走（启动直接跳过），否则 null，照常启动。
     写入记录后整页重新载入一次（各脚本有的在载入时就把本机记录读进内存），之后网址里不再带 #spmig。
     env: {ls, ss, location:{origin, pathname, search, hash, replace}, history, probe:()=>Promise<bool>} */
  function runArrive(env) {
    var ls = env.ls, ss = env.ss, loc = env.location, R = function (v) { return Promise.resolve(v); };
    if (MOVE.targets.indexOf(loc.origin) < 0 && !env.force) return R(null);
    try { ls.getItem(MOVE.flag); ss.getItem('x'); } catch (e) { return R(null); } // 无痕模式等存储不可用：不搬
    var again = /[?&]move=again\b/.test(loc.search);
    var base = loc.origin + loc.pathname + loc.search.replace(/([?&])move=again\b&?/, '$1').replace(/[?&]$/, '');
    if (again) { ls.removeItem(MOVE.flag); ss.removeItem('sp-mig-tried'); }
    var got = parse(loc.hash);
    if (got) {
      var ret = function () { var r = ss.getItem('sp-mig-ret') || ''; ss.removeItem('sp-mig-ret'); ss.removeItem('sp-mig-parts'); return r; };
      var clean = function () { try { env.history.replaceState(null, '', base + ret()); } catch (e) {} return R(null); };
      if (got.empty) { ls.setItem(MOVE.flag, JSON.stringify({ t: Date.now(), n: 0 })); return clean(); }
      var parts = [];
      try { parts = JSON.parse(ss.getItem('sp-mig-parts') || '[]'); } catch (e) {}
      if (got.i === 0) parts = [];
      parts[got.i] = got;
      if (got.i + 1 < got.n) {
        try { ss.setItem('sp-mig-parts', JSON.stringify(parts)); } catch (e) { return clean(); }
        loc.replace(bridgeURL(base, got.i + 1));
        return R('leave');
      }
      var str = assemble(parts);
      if (!str) return clean(); // 各段对不上：不设标记，下次会话再试
      return decode(str).then(function (obj) {
        var n = hasUserData(ls) ? 0 : apply(ls, obj);
        ls.setItem(MOVE.flag, JSON.stringify({ t: Date.now(), n: n }));
        if (n) ss.setItem('sp-mig-done', String(n));
        /* 目标网址和当前只差 # 片段时 replace 不会重新载入，所以先改网址再整页 reload */
        var target = base + ret();
        try { env.history.replaceState(null, '', target); } catch (e) {}
        if (typeof loc.reload === 'function') loc.reload(); else loc.replace(target);
        return 'leave';
      }, clean);
    }
    if (ls.getItem(MOVE.flag)) return R(null);
    if (hasUserData(ls)) { ls.setItem(MOVE.flag, JSON.stringify({ t: Date.now(), n: 0, skip: 'has-data' })); return R(null); }
    if (ss.getItem('sp-mig-tried')) return R(null); // 本次会话已经试过（搬家页打不开等），不再来回跳
    ss.setItem('sp-mig-tried', '1');
    /* 先确认搬家页打得开，打不开（还没部署、网络不通）就照常启动，下次会话再试，不让用户停在 404 页 */
    return (env.probe ? env.probe() : R(true)).then(function (ok) {
      if (!ok) return null;
      ss.setItem('sp-mig-ret', loc.hash || '');
      loc.replace(bridgeURL(base, 0));
      return 'leave';
    }, function () { return null; });
  }

  /* 旧网址上运行的页面（新域名生效前的旧版本、被 service worker 缓存的旧页面）：
     新域名已上线（MOVE.ready 读得到）时转到新网址；添加到主屏幕的 App 模式不自动跳（iOS 主屏幕 App 的存储和浏览器分开，跳过去也带不走），返回 'banner' 提示用户。 */
  function runDepart(env) {
    var loc = env.location;
    if (loc.origin !== MOVE.from) return Promise.resolve(null);
    try { if (env.ss.getItem('sp-depart-checked')) return Promise.resolve(null); env.ss.setItem('sp-depart-checked', '1'); } catch (e) {}
    return env.fetch(MOVE.to + MOVE.ready + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r || !r.ok) return null;
      if (env.standalone) return 'banner';
      loc.replace(MOVE.to + '/' + loc.search + loc.hash);
      return 'leave';
    }, function () { return null; });
  }

  var api = {
    MOVE: MOVE, keep: keep, collect: collect, hasUserData: hasUserData, hash: hash, encode: encode, decode: decode,
    pieces: pieces, parse: parse, assemble: assemble, apply: apply, targetOK: targetOK, bridgeURL: bridgeURL,
    runBridge: runBridge, runArrive: runArrive, runDepart: runDepart
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SparrowMove = api;
})(typeof self !== 'undefined' ? self : this);
