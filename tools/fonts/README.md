# 票根片名字体

`runzhijia-kangxi.ttf`：润植家康熙字典美化体（Regular，ver1.30），润植家艺术工作室出品，http://www.runzhijia.art 。
官方声明可免费个人与商业使用（来源：润植家艺术工作公众号）。

网站和小程序不直接加载这个 6MB 的原字体：`tools/build-title-font.py` 只取片名里用到的字，
生成 `fonts/ticket-title.woff2` / `fonts/ticket-title.woff`（几百 KB），部署时自动重新生成。
