// 一次性导入：把 data.json 写入云数据库（会覆盖四个集合的现有内容）
// 在开发者工具里右键 seed → 「云端测试」，参数填 {"confirm":"overwrite"} 运行
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const DATA = require('./data.json');

async function reset(name, docs, idOf) {
  try { await db.createCollection(name); } catch (e) {}
  await db.collection(name).where({ _id: _.exists(true) }).remove();
  for (let i = 0; i < docs.length; i++) {
    const d = Object.assign({ order: i }, docs[i]);
    const id = idOf ? idOf(docs[i], i) : undefined;
    await db.collection(name).add({ data: id ? Object.assign({ _id: id }, d) : d });
  }
  return docs.length;
}

exports.main = async (event) => {
  if (!event || event.confirm !== 'overwrite') return { ok: false, msg: '请传入 {"confirm":"overwrite"} 确认覆盖导入' };
  const r = {};
  r.films = await reset('films', DATA.films, f => f.id);
  r.shows = await reset('shows', DATA.shows, s => `${s.d}-${s.t}-${s.v}-${s.h}`.replace(/[\/:]/g, '_'));
  r.venues = await reset('venues', DATA.venues, v => v.id);
  r.programmes = await reset('programmes', DATA.programmes, p => p.id);
  try { await db.createCollection('plans'); } catch (e) {}
  return { ok: true, imported: r };
};
