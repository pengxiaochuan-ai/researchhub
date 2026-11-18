# 三城市近似参考点 · 2026-11-10

仅用于T01全国总览，不是团队/机构/试验中心地址，也不是根据行政区多边形计算的质心。用户批准的范围只有北京、上海、大连，不自动采全国GIS或增加商业服务。运行时只读取本地文件，不联网。

## 原件与具名绑定

`download-receipt.json`记录实际获取时间、固定版本URL、SHA256、声明ID、坐标及precision；`manifest.json`显式绑定既有MCA-2024-12-31代码，不按名称模糊匹配或截统计代码。`wikidata/`保留结构化JSON原件。

| 业务城市/省级代码 | Wikidata/固定revision | P625经度、纬度 | 原precision（度） | 原references数 |
| --- | --- | --- | --- | --- |
| 北京市110000 / 110000 | Q956 / 2565775546 | 116.407526,39.90403 | 0.00001 | 1 |
| 上海市310000 / 310000 | Q8686 / 2554225580 | 121.46916666666667,31.2325 | 1/3600 | 1 |
| 大连市210200 / 辽宁省210000 | Q74881 / 2548806680 | 121.6,38.9 | 1/60 | 0 |

原JSON三条`labels.zh-cn`与业务中文名一致，大连`labels.zh`为繁体“大連市”。Q74881的P131包含辽宁Q43934，三条P17均包含中国Q148；含历史归属，不把全部P131/P17声明当现行政区映射。简体名/代码/父级以固定MCA表和本轮三条明确绑定为准。

precision是记录精度，**不是实测误差半径**；小数位多不能证明米级精度。大连无附参考文献、精度较粗，完整保留，不补造出处或细化数值。

## 许可、坐标基准与交叉核验

- [Wikidata Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright)：结构化数据CC0。本目录仅保存结构化JSON，不把普通页面文字、图片或政府网页视为CC0。CC0不是质量/正确性背书。
- [P625官方说明](https://www.wikidata.org/wiki/Property:P625)：地球坐标约定WGS84；[Wikibase JSON](https://doc.wikimedia.org/Wikibase/master/php/docs_topics_json.html)解释globe Q2与precision。这里按**来源声明**使用WGS84，未做实地精度验证。
- [北京官方历史地理介绍](https://yjglj.beijing.gov.cn/art/2012/7/24/art_6162_457440.html)范围115°20′–117°30′E、39°28′–41°05′N；[上海官方2025地理介绍](https://english.shanghai.gov.cn/en-Overview/20231209/705180b43f794c1ca43f4d1ddaa049a2.html)范围120°51′–122°12′E、30°40′–31°53′N。两点在相应宽范围内，只作地理合理性核对，不构成官方坐标背书。
- 大连[MIIT原介绍链接](https://wap.miit.gov.cn/ztzl/lszt/gjgyyxzdlxcs/csmd/art/2020/art_ae22168e60ab4a5894b00fe88efb756c.html)本次主检索读取到范围120°58′–123°31′E、38°43′–40°10′N，但独立评审直连404，仅能取得搜索缓存。记录为**直连复核未完成**，不用它声称政府精确核验；本轮依据仍是固定Wikidata原件和MCA具名映射。
- 原`pages/h01/src/china.json`无CRS元数据；现有总览投影不变，未做WGS84/GCJ02转换，也不声称测绘级配准。地图响应继续给底图SHA256；若未来要精确地址/测距/导航，必须另核底图许可和坐标基准，不在本轮范围。

## 可复核与失败边界

人工更新必须重核原件/许可/绑定、修改版本并跑测试，不由运行时自动刷新。`city-points.mjs`检查三条限定绑定、代码父链、版本、SHA256、原声明、Earth Q2、坐标范围和精度；缺失/不符时地图明确503，不悄悄接受新版。已有显式来源点优先；未知但合法城市仍省级兜底；无效位置仍未定位，不回写资料。

来源获取命令（已执行；已有原件只校验不覆盖）：`node scripts/city-reference-download.mjs --capture-three-approved-cities`。这只是来源捕获，不会写数据库、审核事实或启用新服务。
