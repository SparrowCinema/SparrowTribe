/* js/plan-store.js — 个人排片的本机存储（style-kaleidoscope-plan-v1）。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

const PLAN_KEY='style-kaleidoscope-plan-v1',META_KEY='sparrow-profile-meta';
function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')||{};}catch{return {};}}
function touchMeta(k){try{const m=readMeta();m[k]=Date.now();localStorage.setItem(META_KEY,JSON.stringify(m));}catch{}}
let validKeys=new Set();
function readSelection(){try{const a=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');return new Set(Array.isArray(a)?a.filter(k=>validKeys.has(k)):[]);}catch{return new Set();}}
let picked=new Set(),currentExport=[];
