"""部署时把外链海报存成站内文件（只改部署产物，不改仓库）。

影片 poster 填的是外站地址（https://…）时：
- 网页票根、长图、分享海报等画布读不到（外站没有跨域许可，画布被污染或直接加载失败）；
- 小程序画布只能下载合法域名里的图片，外站海报在票根、长图上都是空的；
- 外站也可能随时换图、防盗链或下线。

这一步在 GitHub Actions 里（有外网）逐张下载，校验确实是图片后存成 posters/x-<影片id>.jpg
（最宽 900px，JPEG），再把部署目录里 data/programmes/*.json 对应的 poster 改成这个站内路径。
后面的 build-thumbs 会照常生成缩略图，getData 云函数读到的也是站内地址。
外站下载失败时先从线上已部署的网站取回上次存好的同名文件；两处都失败才保留原地址并打印警告，不影响部署。仓库里已有同名文件时直接用它（可手动提交替换图）。

用法：python tools/localize-posters.py
"""
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROG = ROOT / 'data' / 'programmes'
OUT = ROOT / 'posters'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
MAX_W = 900
LIVE = 'https://sparrowcinema.org/'  # 外站下载失败时，从线上已部署的网站取回上次本地化的同名文件


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def save(data, dest):
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode not in ('RGB', 'L'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        rgba = im.convert('RGBA')
        bg.paste(rgba, mask=rgba.split()[3])
        im = bg
    im = im.convert('RGB')
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    if im.width < 120 or im.height < 160:
        raise ValueError(f'图片太小 {im.width}×{im.height}')
    im.save(dest, 'JPEG', quality=86, optimize=True, progressive=True)


def main():
    done = failed = 0
    for path in sorted(PROG.glob('*.json')):
        text = path.read_text(encoding='utf-8')
        data = json.loads(text)
        changed = False
        for film in data.get('films') or []:
            url, fid = film.get('poster'), film.get('id')
            if not (isinstance(url, str) and url.startswith(('http://', 'https://')) and fid):
                continue
            rel = f'posters/x-{fid}.jpg'
            dest = ROOT / rel
            try:
                if not dest.exists():
                    try:
                        save(fetch(url), dest)
                    except Exception as first:
                        # 外站换图、防盗链或下线时，沿用上一次部署在本站的同一张（2026-11-25）
                        try:
                            save(fetch(LIVE + rel), dest)
                            print(f'::warning::外站海报下载失败，沿用线上已部署的 {rel}（{fid}: {first}）', file=sys.stderr)
                        except Exception:
                            raise first
                encoded = json.dumps(url, ensure_ascii=False)
                if encoded not in text:
                    raise ValueError('在文件里找不到这条地址')
                text = text.replace(encoded, json.dumps(rel))
                changed = True
                done += 1
                print(f'  {fid}: {rel}')
            except Exception as e:  # 下载失败不阻止部署
                failed += 1
                print(f'::warning::外链海报未能本地化 {path.name} {fid}: {e}', file=sys.stderr)
        if changed:
            json.loads(text)  # 确认改完仍是合法 JSON
            path.write_text(text, encoding='utf-8')
    print(f'外链海报本地化：{done} 张成功，{failed} 张失败')


if __name__ == '__main__':
    main()
