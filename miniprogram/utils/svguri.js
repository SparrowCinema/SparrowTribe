// SVG 字符串转成 <image> 能直接显示的 data URI（UTF-8 → base64，比百分号编码短得多）
const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00); }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
    else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
  }
  return out;
}
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2], n = a << 16 | (b || 0) << 8 | (c || 0);
    s += B[n >> 18 & 63] + B[n >> 12 & 63] + (b === undefined ? '=' : B[n >> 6 & 63]) + (c === undefined ? '=' : B[n & 63]);
  }
  return s;
}
function svgUri(svg) { return 'data:image/svg+xml;base64,' + b64(utf8(svg)); }
module.exports = { svgUri, utf8, b64 };
