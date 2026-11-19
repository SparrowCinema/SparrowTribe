#!/usr/bin/env python3
"""海报缩略图（2026-11-18）：部署时由 .github/workflows/pages.yml 运行，产物不提交（已在 .gitignore）。

posters/<名>.jpg → posters/w360/<名>.webp   列表、网格、海报墙（约 120 CSS px 宽 × 3 倍屏）
                 → posters/w360/<名>.jpg    小程序列表（iOS 旧基础库不保证支持 WebP）
                 → posters/w720/<名>.webp   影片详情页大图
原图不动，长图导出、分享海报等画布仍用原图。宽度本来就小于目标宽度的海报不放大，直接按原尺寸转码。

用法：python3 tools/build-thumbs.py        （需要 Pillow：pip install pillow）
"""
import os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'posters')
OUT = [('w360', 360, 'webp'), ('w360', 360, 'jpg'), ('w720', 720, 'webp')]


def one(name):
    src = os.path.join(SRC, name)
    stem = os.path.splitext(name)[0]
    done = []
    with Image.open(src) as im:
        im = im.convert('RGB')
        for d, w, ext in OUT:
            dst = os.path.join(SRC, d, stem + '.' + ext)
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            t = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            if ext == 'webp':
                t.save(dst, 'WEBP', quality=78, method=5)
            else:
                t.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
            done.append(os.path.getsize(dst))
    return name, os.path.getsize(src), done


def main():
    for d in {d for d, _, _ in OUT}:
        os.makedirs(os.path.join(SRC, d), exist_ok=True)
    names = sorted(n for n in os.listdir(SRC) if n.lower().endswith(('.jpg', '.jpeg', '.png')) and os.path.isfile(os.path.join(SRC, n)))
    if not names:
        sys.exit('posters/ 里没有海报')
    with ProcessPoolExecutor() as ex:
        res = list(ex.map(one, names))
    src = sum(r[1] for r in res)
    made = sum(len(r[2]) for r in res)
    w360 = sum(os.path.getsize(os.path.join(SRC, 'w360', os.path.splitext(n)[0] + '.webp')) for n in names)
    print(f'海报 {len(names)} 张，原图共 {src // 1024} KB；新生成 {made} 个文件；w360 WebP 共 {w360 // 1024} KB（平均 {w360 // len(names) // 1024} KB）')


def covers():
    """专题头图 programmes/<名>.jpg → programmes/w930/<名>.jpg（小程序联网时用，getData 云函数返回此地址，换图无需重新上传小程序）。"""
    src = os.path.join(ROOT, 'programmes'); out = os.path.join(src, 'w930'); os.makedirs(out, exist_ok=True); n = 0
    for name in sorted(os.listdir(src)):
        f = os.path.join(src, name)
        if not (os.path.isfile(f) and name.lower().endswith(('.jpg', '.jpeg', '.png'))):
            continue
        dst = os.path.join(out, os.path.splitext(name)[0] + '.jpg')
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(f):
            continue
        with Image.open(f) as im:
            im = im.convert('RGB')
            t = im if im.width <= 930 else im.resize((930, round(im.height * 930 / im.width)), Image.LANCZOS)
            t.save(dst, 'JPEG', quality=82, optimize=True, progressive=True); n += 1
    print(f'专题头图缩略图新生成 {n} 张')


if __name__ == '__main__':
    main()
    covers()
