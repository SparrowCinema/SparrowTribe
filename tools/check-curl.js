// 护照翻页卷曲（shared/curl.js）：折痕、镜像、裁切和限位的几何检查
const assert = require('assert');
const C = require('../shared/curl.js');
const near = (a, b, e = 0.6) => Math.abs(a - b) <= e;
const mat = s => s.slice(7, -1).split(',').map(Number);
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const pts = s => s.slice(8, -1).split(',').map(p => p.trim().split(' ').map(v => parseFloat(v)));
const W = 300, H = 426;
for (const mirror of [false, true]) {
  for (const [cy, px, py] of [[0, 180, 60], [H, 120, 300], [H, -150, H], [0, 260, 10]]) {
    const r = C.fold({ W, H, cx: W, cy, px, py, mirror });
    assert(!r.none);
    const m = mat(r.flapT);
    // 被拖的页角经镜像后落在手指位置（换回元素坐标）
    const cl = mirror ? [0, cy] : [W, cy], pl = mirror ? [W - r.px, r.py] : [r.px, r.py];
    const q = ap(m, cl[0], cl[1]);
    assert(near(q[0], pl[0]) && near(q[1], pl[1]), 'corner maps to finger ' + mirror + ' ' + q + ' vs ' + pl);
    // 镜像两次回到原处
    const z = ap(m, ...ap(m, 37, 91));
    assert(near(z[0], 37) && near(z[1], 91), 'reflection is an involution');
    // 当前页保留部分 + 折起部分 = 整页（面积相加）
    const area = ps => Math.abs(ps.reduce((s, p, i) => { const n = ps[(i + 1) % ps.length]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
    assert(near(area(pts(r.front)) + area(pts(r.flapClip)), W * H, 5), 'clip areas sum to page');
    // 书脊一侧始终留在当前页上
    const spine = mirror ? W : 0;
    assert(pts(r.front).some(p => near(p[0], spine)), 'spine stays on current page');
  }
}
// 限位：纸不能被拉长
const P = C.clamp(W, H, W, H, -900, H);
assert(Math.hypot(P.x, P.y - H) <= W + 0.01);
const Q = C.clamp(W, H, W, 0, 50, 2000);
assert(Math.hypot(Q.x, Q.y - H) <= Math.hypot(W, H) + 0.01 && Math.hypot(Q.x, Q.y) <= W + 0.01);
// 页角没动时不显示折页
assert(C.fold({ W, H, cx: W, cy: 0, px: W, py: 0 }).none);
// 动画轨迹：起点、终点正确，中途抬起
const a = C.path(0, W, H, -W, H, H, 0.16), b = C.path(1, W, H, -W, H, H, 0.16), mid = C.path(0.5, W, H, -W, H, H, 0.16);
assert(near(a.x, W) && near(b.x, -W) && near(b.y, H) && mid.y < H);
// 小程序 WXS 只支持 ES5：不用箭头函数、let/const、模板字符串、正则
const src = require('fs').readFileSync(require('path').join(__dirname, '../shared/curl.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const body = src.slice(0, src.indexOf("if (typeof module"));
assert(!/=>|\blet\b|\bconst\b|`|Math\.hypot/.test(body), 'curl.js must stay ES5 for WXS');

// 展开、旋转时不能重放上一轮翻页指令，或让旧的动画回调推进新书页。
const wxs = { exports: {} };
let clock = 0;
require('vm').runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '../miniprogram/pages/my/curl-ctl.wxs'), 'utf8'), {
  module: wxs, require: () => C, getDate: () => new Date(clock),
});
const ctl = wxs.exports;
const state = {}, frames = [], calls = [];
const ins = {
  getState: () => state,
  selectComponent: () => ({ setStyle() {} }),
  callMethod: (name, args) => { if (name === 'cuDone') calls.push(args); },
  requestAnimationFrame: fn => frames.push(fn),
};
const finishFrames = () => { while (frames.length) { clock += 700; frames.shift()(); } };
const start = { W, H, k: 1, left: 0, top: 0, sp: false, page: 0, cf: true, cb: false, epoch: 1, vol: 1, n: 5 };
const turn = { ...start, serial: 1, dir: 1 };
ctl.cfg(start, null, ins);
ctl.cmd(turn, null, ins);
assert.equal(frames.length, 1, 'next starts an animation');
const reopened = { ...start, epoch: 2 };
ctl.cfg(reopened, start, ins);
ctl.cmd(turn, null, ins);
finishFrames();
assert.equal(calls.length, 0, 'reopen cancels running frames and rejects a replayed command');
ctl.cmd({ ...reopened, serial: 2, dir: 1 }, null, ins);
finishFrames();
assert.equal(calls.length, 1);
assert.equal(calls[0].page, 0);
assert.equal(calls[0].epoch, 2);
const next = { ...reopened, page: 1, W: 0, cb: true };
ctl.cfg(next, reopened, ins);
ctl.cmd({ ...next, serial: 3, dir: -1 }, null, ins);
assert.equal(calls[1].dir, -1, 'buttons also work before page measurement');
console.log('check-curl: ok');
