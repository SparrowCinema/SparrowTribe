// 读取排片数据：films / shows / venues / programmes 四个集合
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function all(name) {
  try {
    const out = [];
    for (let skip = 0; ; skip += 100) {
      const r = await db.collection(name).skip(skip).limit(100).get();
      out.push(...r.data);
      if (r.data.length < 100) break;
    }
    return out;
  } catch (e) { return []; } // 集合不存在时返回空，小程序会改用内置数据
}

exports.main = async () => {
  const [films, shows, venues, programmes] = await Promise.all(['films', 'shows', 'venues', 'programmes'].map(all));
  const strip = x => { const o = Object.assign({}, x); delete o._id; delete o._openid; return o; };
  films.sort((a, b) => (a.order || 0) - (b.order || 0));
  shows.sort((a, b) => (a.order || 0) - (b.order || 0));
  programmes.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { films: films.map(strip), shows: shows.map(strip), venues: venues.map(strip), programmes: programmes.map(strip) };
};
