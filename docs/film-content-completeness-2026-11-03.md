# 影片资料查漏（2026-11-03）

全站当前 274 个非活动片目均已具备剧情简介、观影看点及导演介绍。此次重点核对金马影展 156 个片目（147部独立影片、9组短片合辑），依据金马官方177个影片及短片页面整理，逐条来源见同目录 golden-horse-content-audit 与 metadata-audit。

德国电影专题三部导演简介已由 PR #126 补齐。本次整合保留该 PR 的评分、外链、导演介绍及主创资料：

- 《我理解您的不满》：[HFF导演档案](https://hff-muenchen.de/de_DE/studenten/kilian-armando-friedrich.159980)、[HFF影片资料](https://www.hff-muenchen.de/en_en/film-detail/ich-verstehe-ihren-unmut-punkte-at.5025)、[ZDF演职员表](https://presseportal.zdf.de/pressemappe/berlinale2026)。保留用户原排片片长91分钟；外部发行资料为93分钟，未擅自替换场次版本。
- 《残存的感性》：[LICHTER影展](https://lichter-filmfest.de/en/films/sometimes-i-imagine-them-all-at-a-party/2057)、[导演个人影片页](https://www.magnanima.de/sometimes-i-imagine-them-all-at-a-party)。
- 《当猪会飞》：[Ji.hlava影展](https://vp.eventival.com/jidff/2026/film/1226626)、[德国电影资料库](https://www.filmportal.de/en/movie/when-pigs-fly_74ece126cc7d4685b7be15f2097213d7)。保留本网站80分钟版本。

文字使用简短事实转述；观影看点为基于简介和官方创作资料的编辑建议，不声称已完整审片。既有用户提供的完整简介、片长、主创与场次保留。

评分仅录入能核对身份且已有公开分数的平台结果；暂无公开分数、未能验证或合辑不适用时保留空值，不以同名片或短片平均分填满。

## Integration and checks

Based on main 56451f8; preserves PR126-138, including selectors, crop, icons, sharing and slim mini-program fallback. 156 Golden Horse entries have posters. 147 individual films: Douban direct links 147, IMDb 141, Letterboxd 143. Available scores: Douban 65, IMDb 127, RT 57, MTC 45, Letterboxd 121. Nine anthologies have no aggregate scores.

Content, library, companion and Golden Rooster checks passed. Protected film IDs, screening keys, supplied synopses, runtimes, directors, editions and existing credits compared against main. Desktop 1360px and mobile 390px film views and searchable selectors checked. Mini-program page updates still require a developer-tools upload and review.
