/* 麻雀观影护照 · 纯私密个人笔记端到端加密（网站、小程序、Node 共用，零外部依赖）。
   算法：PBKDF2-HMAC-SHA256 (10000 轮) 派生 64 字节密钥（前 32 字节 AES-256-CTR 加密，后 32 字节 HMAC-SHA256 认证，Encrypt-then-MAC）。
   密文格式：v1.<saltB64>.<ivB64>.<ctB64>.<macB64>
   口令永远只留在本机，云端（Supabase）只存密文。 */
(function (root) {
  'use strict';

  function utf8Enc(str) {
    var s = String(str || ''), out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function utf8Dec(bytes) {
    var s = '', i = 0, n = bytes.length;
    while (i < n) {
      var b = bytes[i++];
      if (b < 0x80) s += String.fromCharCode(b);
      else if ((b & 0xe0) === 0xc0) s += String.fromCharCode(((b & 31) << 6) | (bytes[i++] & 63));
      else if ((b & 0xf0) === 0xe0) s += String.fromCharCode(((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
      else {
        var cp = (((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63)) - 0x10000;
        s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
      }
    }
    return s;
  }

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function toB64(u8) {
    var out = '', i = 0, n = u8.length;
    for (; i + 2 < n; i += 3) {
      var v = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
      out += B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + B64[(v >> 6) & 63] + B64[v & 63];
    }
    if (i < n) {
      var v2 = (u8[i] << 16) | (i + 1 < n ? u8[i + 1] << 8 : 0);
      out += B64[(v2 >> 18) & 63] + B64[(v2 >> 12) & 63] + (i + 1 < n ? B64[(v2 >> 6) & 63] : '=') + '=';
    }
    return out;
  }
  function fromB64(str) {
    var s = String(str || '').replace(/[^A-Za-z0-9+/]/g, '');
    var n = s.length, pad = (String(str || '').match(/=+$/) || [''])[0].length;
    var out = new Uint8Array(Math.floor(n * 3 / 4) - (n % 4 === 0 ? pad : 0));
    var p = 0;
    for (var i = 0; i < n; i += 4) {
      var a = B64.indexOf(s[i]), b = B64.indexOf(s[i + 1]), c = i + 2 < n ? B64.indexOf(s[i + 2]) : 0, d = i + 3 < n ? B64.indexOf(s[i + 3]) : 0;
      var v = (a << 18) | (b << 12) | (c << 6) | d;
      if (p < out.length) out[p++] = (v >> 16) & 255;
      if (p < out.length) out[p++] = (v >> 8) & 255;
      if (p < out.length) out[p++] = v & 255;
    }
    return out;
  }

  // SHA-256 (FIPS 180-4)
  var K256 = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  function sha256(msg) {
    var len = msg.length, bitLen = len * 8;
    var padLen = ((len + 9 + 63) & ~63);
    var buf = new Uint8Array(padLen);
    buf.set(msg);
    buf[len] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
    dv.setUint32(padLen - 4, bitLen >>> 0, false);
    var h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    var w = new Uint32Array(64);
    for (var off = 0; off < padLen; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (var i = 16; i < 64; i++) {
        var s0 = ((w[i-15]>>>7)|(w[i-15]<<25)) ^ ((w[i-15]>>>18)|(w[i-15]<<14)) ^ (w[i-15]>>>3);
        var s1 = ((w[i-2]>>>17)|(w[i-2]<<15)) ^ ((w[i-2]>>>19)|(w[i-2]<<13)) ^ (w[i-2]>>>10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      var a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (var i = 0; i < 64; i++) {
        var S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
        var S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
      }
      h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
      h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
    }
    var out = new Uint8Array(32), odv = new DataView(out.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, idx) { odv.setUint32(idx * 4, v, false); });
    return out;
  }

  function hmacSha256(key, msg) {
    if (key.length > 64) key = sha256(key);
    var ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(96);
    for (var i = 0; i < 64; i++) {
      var kb = i < key.length ? key[i] : 0;
      ipad[i] = kb ^ 0x36;
      opad[i] = kb ^ 0x5c;
    }
    ipad.set(msg, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
  }

  function pbkdf2(passBytes, salt, iters, dkLen) {
    var blocks = Math.ceil(dkLen / 32), out = new Uint8Array(blocks * 32);
    var sb = new Uint8Array(salt.length + 4);
    sb.set(salt);
    for (var b = 1; b <= blocks; b++) {
      sb[salt.length] = (b >>> 24) & 255; sb[salt.length + 1] = (b >>> 16) & 255;
      sb[salt.length + 2] = (b >>> 8) & 255; sb[salt.length + 3] = b & 255;
      var u = hmacSha256(passBytes, sb), t = new Uint8Array(u);
      for (var i = 1; i < iters; i++) {
        u = hmacSha256(passBytes, u);
        for (var j = 0; j < 32; j++) t[j] ^= u[j];
      }
      out.set(t, (b - 1) * 32);
    }
    return out.subarray(0, dkLen);
  }

  // AES-256 block cipher (FIPS 197)
  var SBOX = new Uint8Array([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ]);
  var RCON = [0,1,2,4,8,16,32,64,128,27,54];
  function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }

  function aes256Expand(key) {
    var w = new Uint8Array(240);
    w.set(key);
    for (var i = 32, r = 1; i < 240; i += 4) {
      var t0 = w[i-4], t1 = w[i-3], t2 = w[i-2], t3 = w[i-1];
      if (i % 32 === 0) {
        var tmp = t0;
        t0 = SBOX[t1] ^ RCON[r++]; t1 = SBOX[t2]; t2 = SBOX[t3]; t3 = SBOX[tmp];
      } else if (i % 32 === 16) {
        t0 = SBOX[t0]; t1 = SBOX[t1]; t2 = SBOX[t2]; t3 = SBOX[t3];
      }
      w[i] = w[i-32] ^ t0; w[i+1] = w[i-31] ^ t1; w[i+2] = w[i-30] ^ t2; w[i+3] = w[i-29] ^ t3;
    }
    return w;
  }

  function aes256Block(rk, inp) {
    var s = new Uint8Array(inp);
    for (var i = 0; i < 16; i++) s[i] ^= rk[i];
    for (var round = 1; round <= 14; round++) {
      for (var i = 0; i < 16; i++) s[i] = SBOX[s[i]];
      // ShiftRows
      var t;
      t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
      t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
      // MixColumns (except final round)
      if (round < 14) {
        for (var c = 0; c < 16; c += 4) {
          var a0=s[c],a1=s[c+1],a2=s[c+2],a3=s[c+3], u=a0^a1^a2^a3;
          s[c]   = a0 ^ u ^ xtime(a0 ^ a1);
          s[c+1] = a1 ^ u ^ xtime(a1 ^ a2);
          s[c+2] = a2 ^ u ^ xtime(a2 ^ a3);
          s[c+3] = a3 ^ u ^ xtime(a3 ^ a0);
        }
      }
      var off = round * 16;
      for (var i = 0; i < 16; i++) s[i] ^= rk[off + i];
    }
    return s;
  }

  function aesCtr(key, iv, data) {
    var rk = aes256Expand(key), ctr = new Uint8Array(iv), out = new Uint8Array(data.length);
    for (var off = 0; off < data.length; off += 16) {
      var ks = aes256Block(rk, ctr);
      var lim = Math.min(16, data.length - off);
      for (var j = 0; j < lim; j++) out[off + j] = data[off + j] ^ ks[j];
      for (var k = 15; k >= 0; k--) { ctr[k] = (ctr[k] + 1) & 255; if (ctr[k] !== 0) break; }
    }
    return out;
  }

  function randBytes(n) {
    var out = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(out);
      return out;
    }
    if (typeof require === 'function') {
      try {
        var nc = require('crypto');
        if (nc && nc.randomBytes) return new Uint8Array(nc.randomBytes(n));
      } catch (e) {}
    }
    for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  function constEq(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  var ITERS = 10000;
  function derive(passphrase, salt) {
    var dk = pbkdf2(utf8Enc(passphrase), salt, ITERS, 64);
    return { encKey: dk.subarray(0, 32), macKey: dk.subarray(32, 64) };
  }

  function encrypt(plaintext, passphrase) {
    var pass = String(passphrase || '');
    if (pass.length < 4) throw new Error('Passphrase too short');
    var salt = randBytes(16), iv = randBytes(16);
    var keys = derive(pass, salt);
    var ct = aesCtr(keys.encKey, iv, utf8Enc(plaintext));
    var authInput = new Uint8Array(2 + 16 + 16 + ct.length);
    authInput[0] = 0x76; authInput[1] = 0x31; // "v1"
    authInput.set(salt, 2); authInput.set(iv, 18); authInput.set(ct, 34);
    var mac = hmacSha256(keys.macKey, authInput);
    return 'v1.' + toB64(salt) + '.' + toB64(iv) + '.' + toB64(ct) + '.' + toB64(mac);
  }

  function decrypt(token, passphrase) {
    var parts = String(token || '').split('.');
    if (parts.length !== 5 || parts[0] !== 'v1') throw new Error('Invalid ciphertext');
    var salt = fromB64(parts[1]), iv = fromB64(parts[2]), ct = fromB64(parts[3]), mac = fromB64(parts[4]);
    if (salt.length !== 16 || iv.length !== 16 || mac.length !== 32) throw new Error('Malformed ciphertext');
    var keys = derive(String(passphrase || ''), salt);
    var authInput = new Uint8Array(2 + 16 + 16 + ct.length);
    authInput[0] = 0x76; authInput[1] = 0x31;
    authInput.set(salt, 2); authInput.set(iv, 18); authInput.set(ct, 34);
    var expected = hmacSha256(keys.macKey, authInput);
    if (!constEq(mac, expected)) throw new Error('Wrong passphrase');
    return utf8Dec(aesCtr(keys.encKey, iv, ct));
  }

  function isCipher(s) {
    return typeof s === 'string' && /^v1\.[A-Za-z0-9+/=]{20,28}\.[A-Za-z0-9+/=]{20,28}\.[A-Za-z0-9+/=]{0,6000}\.[A-Za-z0-9+/=]{40,48}$/.test(s);
  }

  var api = { encrypt: encrypt, decrypt: decrypt, isCipher: isCipher };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SparrowNotesCrypto = api;
})(typeof window !== 'undefined' ? window : this);
