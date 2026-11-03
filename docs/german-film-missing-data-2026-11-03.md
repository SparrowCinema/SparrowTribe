# 德国电影展空缺资料补全核验

核验日期：2026-11-03（Asia/Shanghai）。只补空缺，既有文本、非空评分、既有外链、海报、片长、年份和排片原样保留。资料来源仅保留于仓库核验记录，不进入公开页面。

## 评分

顺序为豆瓣 / IMDb / Rotten Tomatoes Tomatometer / Metacritic Metascore / Letterboxd。下表只列本次新增值，—表示未新增，不表示原有值为空。Letterboxd 公开加权分数按页面精度四舍五入到一位小数；IMDb 使用当天下载的[官方公开评分数据](https://datasets.imdbws.com/title.ratings.tsv.gz)，没有用个人短评分或自行计算影评分数。

| 影片 | 豆瓣 / IMDb / RT / MTC / Letterboxd 新增值 | 平台条目 |
|---|---|---|
| 阿姆鲁姆 | 7.1 / — / — / 76 / 3.5 | [豆瓣](https://movie.douban.com/subject/36116464/) · [IMDb](https://www.imdb.com/title/tt22507216/) · [Letterboxd](https://letterboxd.com/film/amrum/) |
| 落叶球 | 7.1 / 6.6 / — / 67 / — | [豆瓣](https://movie.douban.com/subject/35699905/) · [IMDb](https://www.imdb.com/title/tt37537636/) · [Letterboxd](https://letterboxd.com/film/dry-leaf/) |
| 我理解您的不满 | — / 7.1 / — / — / 3.6 | [豆瓣](https://movie.douban.com/subject/38197587/) · [IMDb](https://www.imdb.com/title/tt39368062/) · [Letterboxd](https://letterboxd.com/film/i-understand-your-displeasure/) |
| 卡拉的审判 | — / — / — / — / 3.6 | [豆瓣](https://movie.douban.com/subject/35337596/) · [IMDb](https://www.imdb.com/title/tt37021896/) · [Letterboxd](https://letterboxd.com/film/karla-2025/) |
| 镜的第三乐章 | 7.3 / — / — / — / — | [豆瓣](https://movie.douban.com/subject/36877209/) · [IMDb](https://www.imdb.com/title/tt32247943/) · [Letterboxd](https://letterboxd.com/film/miroirs-no-3/) |
| 她们的狂想曲 | 7.1 / 6.2 / — / — / — | [豆瓣](https://movie.douban.com/subject/37045627/) · [IMDb](https://www.imdb.com/title/tt43258259/) · [Letterboxd](https://letterboxd.com/film/the-miserable-mother/) |
| 心隙 | — / — / — / — / 3.6 | [豆瓣](https://movie.douban.com/subject/37202597/) · [IMDb](https://www.imdb.com/title/tt33888334/) · [Letterboxd](https://letterboxd.com/film/oh-this-unspeakable-void/) |
| 残存的感性 | — / 7.4 / — / — / 3.7 | [豆瓣](https://movie.douban.com/subject/38208584/) · [IMDb](https://www.imdb.com/title/tt39383613/) · [Letterboxd](https://letterboxd.com/film/sometimes-i-imagine-them-all-at-a-party/) |
| 当猪会飞 | — / — / — / — / — | [豆瓣](https://movie.douban.com/subject/38352241/) · [IMDb](https://www.imdb.com/title/tt40672774/) · [Letterboxd](https://letterboxd.com/film/when-pigs-fly-2026/) |
| 羞耻与金钱 | — / — / — / — / 3.5 | [豆瓣](https://movie.douban.com/subject/36948178/) · [IMDb](https://www.imdb.com/title/tt39140264/) · [Letterboxd](https://letterboxd.com/film/shame-and-money/) |

豆瓣同时通过对应的公开移动端条目 `https://m.douban.com/rexxar/api/v2/movie/<subject-id>` 验证片名、年份和评分。分值为 0 且 count 为 0 的条目表示未公开评分，不能记为 0 分。

## 仍保留空缺的评分

- 豆瓣：我理解您的不满、卡拉的审判、心隙、残存的感性、当猪会飞、羞耻与金钱均未公开评分。
- IMDb：当猪会飞（Denise Riedmayr，tt40672774）在官方评分数据中无记录，页面也无公开评分。
- Letterboxd：她们的狂想曲、当猪会飞的影片页无 aggregateRating，保留空值。
- 烂番茄：我理解您的不满有6篇评论，但影片页和结构化数据未发布百分比分数；卡拉的审判的[正确2025年条目](https://www.rottentomatoes.com/m/karla_2025)有3篇评论而无Tomatometer；心隙0篇评论。其余缺分影片未找到可核实的对应影片聚合分。`/m/karla` 和 `/m/when_pigs_fly` 是同名旧片，已排除，不能取其评分。
- Metacritic：新增[Amrum 76](https://www.metacritic.com/movie/amrum/)与[Dry Leaf 67](https://www.metacritic.com/movie/dry-leaf/)；其余缺分影片未找到可核实的对应聚合分，不把搜索无结果写成平台确认无评分。

## 导演与演职员

- Kilian Armando Friedrich：[filmportal / 柏林电影节目录传记](https://www.filmportal.de/en/person/kilian-armando-friedrich_83ea469b491e4207b1b2efa73c5e9455)。编剧与演员依照[电影节官方目录](https://www.filmkunstfest.de/fileadmin/user_upload/Dateien/02_FILMKUNSTFEST_MV/35_FILMKUNSTFEST/KATALOG_2026_web_kompr_neu_20.04..pdf)和[Letterboxd演职员页](https://letterboxd.com/film/i-understand-your-displeasure/cast/)。
- Daniela Magnani Hüller：[filmportal / 柏林电影节目录传记及编剧署名](https://www.filmportal.de/en/person/daniela-magnani-huller_37fe921df4be4256ae6a16fd16233a17)，[DOK.fest介绍](https://www.dokfest-muenchen.de/people/891)。
- Denise Riedmayr：[DOK.fest官方影片页及传记](https://www.dokfest-muenchen.de/events/view/7023?lang=en)，[HFF学校影片记录](https://www.hff-muenchen.de/de_DE/studenten/denise-riedmayr.136133)，[Crew United编剧署名](https://www.crew-united.com/de/When-Pigs-Fly__340058.html)。
- 纪录片没有可核实的演员表时保留原来的空数组，不把导演、受访者或摄影师虚构为演员。

## 海报及同步

- 10张既有海报均存在，Pillow解码与图片内容核对通过；全部保留原文件与路径。
- 中英文电影资料与小程序离线兜底通过现有 build-fallback.js 同步。
- 已执行保留规则断言：所有既有非空字段、评分槽位、外链与排片逐项保持不变。
- 已执行 tools/check-content.js、tools/check-library.js。
