#!/usr/bin/env python3
"""票根片名字体：润植家康熙字典美化体（润植家艺术工作室，免费可商用）按需取字。

整套字体 6MB，票根只用得到片名里的字：从所有影片资料的片名（cn / o / en）和票面固定字里取字，
子集化成 fonts/ticket-title.woff2（网页）和 fonts/ticket-title.woff（小程序 wx.loadFontFace），
并把内容哈希写进 data/ticket-font.json，网页按 ?v=哈希 加载，新片名上线后自动换新字体。
部署时（.github/workflows/pages.yml）会重新生成；本地加了新片也可以手动运行：
  python3 tools/build-title-font.py
依赖：pip install fonttools brotli
"""
import glob, hashlib, json, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools/fonts/runzhijia-kangxi.ttf')
OUT = os.path.join(ROOT, 'fonts/ticket-title')
FIXED = '麻雀观影护照纪念票根典藏收藏册我的'

def titles():
    chars = set(FIXED)
    files = glob.glob(os.path.join(ROOT, 'data/**/*.json'), recursive=True)
    for path in files:
        if os.path.basename(path) == 'ticket-font.json':
            continue
        try:
            text = open(path, encoding='utf-8').read()
        except OSError:
            continue
        for m in re.finditer(r'"(?:cn|title)"\s*:\s*"((?:[^"\\]|\\.)*)"', text):
            try:
                chars |= set(json.loads('"' + m.group(1) + '"'))
            except ValueError:
                pass
    return ''.join(sorted(c for c in chars if c.strip()))

def build():
    text = titles()
    font = TTFont(SRC)
    cmap = font.getBestCmap()
    keep = ''.join(c for c in text if ord(c) in cmap)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    for flavor in ('woff2', 'woff'):
        opts = subset.Options()
        opts.flavor = flavor
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.drop_tables += ['FFTM']
        f = TTFont(SRC)
        s = subset.Subsetter(opts)
        s.populate(text=keep)
        s.subset(f)
        f.flavor = flavor
        f.save(OUT + '.' + flavor)
    digest = hashlib.sha1(open(OUT + '.woff2', 'rb').read()).hexdigest()[:10]
    meta = {'family': 'SparrowKangxi', 'v': digest, 'chars': len(keep)}
    with open(os.path.join(ROOT, 'data/ticket-font.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, ensure_ascii=False)
        fp.write('\n')
    missing = ''.join(c for c in text if ord(c) not in cmap and ord(c) > 0x2e7f)
    print(f'ticket title font: {len(keep)} chars, woff2 {os.path.getsize(OUT + ".woff2")//1024}KB, '
          f'woff {os.path.getsize(OUT + ".woff")//1024}KB, v={digest}' + (f'; not in font (fallback to serif): {missing}' if missing else ''))

if __name__ == '__main__':
    sys.exit(build())
