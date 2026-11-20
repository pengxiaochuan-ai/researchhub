# 已审核论文原件同步清单（用户已批准，执行准备中）

PMC13456779生产article-context503，两账号均可复现，对照PMC13691533返回200。44756062338只读核对当前可AI使用的15份既有JATS元数据：1份已存在、14份原件HEAD返回NotFound。不是新增论文或用途授权，属于数据库与对象文件未完整交付。所有14份本机原件的长度和SHA已复核一致。

## 推荐准确范围

仅在现有Hub OSS补传以下14份既有原件，总计2284075字节；已存在的PMC13691533不动。数据库、审核、用途、角色、成员、Token及其他来源均不改，不新建云资源、不充值、不调用模型。每份写前重新核当前已审核/AI用途、原件元数据、目标独立researchhub及Hub bucket；已有相同只读跳过，已有不同或未知故障立即停，不覆盖。写后逐份读回SHA/长度，正式文章接口与两账号原页面免费验证；不追加付费调用。

旧授权仅涵盖PMC13691533，本批14份须获用户确认后才能生产写入。若只批准当前报错篇，则本次只补PMC13456779，其余13份仍保留待确认。

## 固定对象清单

目标key统一为`rh-kb-local-b0e2af9d-tenant/hub-pmc/objects/<SHA256>`，bucket和密钥沿用现有Hub私有配置，不公开。

| 记录 | 固定版本 | 当前审核 | 字节 | SHA-256 |
|---|---|---|---:|---|
| pmc-PMC13687034 | PMC13687034.1 | article:71 | 127499 | 83fbb9c89354e16dea8b65eb16e17b20ad334d2fc430f0f26556babbd399bbdb |
| pmc-PMC13678665 | PMC13678665.1 | article:75 | 217974 | 86faff94e724ab49f8e38aa2267fb5f151593e4f19a80703ac80f29e3045d975 |
| pmc-PMC13672493 | PMC13672493.1 | article:76 | 79536 | 8c3cfc913c19cea2405fbd056b969be6b8bdb2112b3ae53d2f1f35b5a5e34c4a |
| pmc-PMC13661500 | PMC13661500.1 | article:72 | 176608 | c5ff2456ba47792c350f89d97e30e88134f39d03d9ab4f316d8168ba81b1025a |
| pmc-PMC13635788 | PMC13635788.1 | article:73 | 172031 | f7d8d7e6174ee9d9e2508128a30dba0d4a7a563fff5ffea56c017f9b79b6a060 |
| pmc-PMC13637160 | PMC13637160.1 | article:77 | 94822 | f152440d024f3122d371d79ccf7f6dee6f90ccd9d96df442432b9d2ce15ef0af |
| pmc-PMC13565737 | PMC13565737.1 | article:78 | 208423 | 04957862246d2cf1605a731dc1dbac4e458ba9c5594f69f81b236728b505394f |
| pmc-PMC13557252 | PMC13557252.1 | article:79 | 155373 | 564d4dd5e1bcd999970eaf0f0fa40c5bca1cb6fb026348bf38a9dc246565c22c |
| pmc-PMC13550960 | PMC13550960.1 | article:80 | 86489 | 8dfa3021a526f1256a8f9748230182309060d1982fee55f04480662afb343c5e |
| pmc-PMC13539995 | PMC13539995.1 | article:81 | 142982 | 4e119f7571cb050ec9fc6bd0d910672cdf6d8e375ab25aa86d33fc62ca7ec246 |
| pmc-PMC13527223 | PMC13527223.1 | article:82 | 191772 | 9db6e49f4fb0298d73aefef099f568fb8e2cc3fe3c1c20b8eadff4772671fedb |
| pmc-PMC13522945 | PMC13522945.1 | article:83 | 362357 | 5abe81e8c0e0105047b8c1fde28cfa6b7618432abd2a9672ca9b4161ba0f2fa5 |
| pmc-PMC13485508 | PMC13485508.1 | article:432 | 119480 | e802214e3e868b3f2800e3d1bd10c2987fcfc21c50672236ab341a5450ab7353 |
| pmc-PMC13456779 | PMC13456779.1 | article:433 | 148729 | dbca96470e62a4cb0fc68a933c6360a4be1ade74c4079614d34606a928fd1638 |

当前报错篇：Effectiveness of acupuncture and related therapies for post-stroke insomnia: A systematic review and Bayesian network analysis。

## 免费修补

仅将固定原件读取的NoSuchKey/ENOENT映射为ARTICLE_ORIGINAL_MISSING/422，在原区域提示管理员补齐；网络/权限故障不伪装缺失，hash/bytes冲突409，不回退或忽略JATS。保持原布局，不把缺原件的论文假装成可解读。

证据：.tmp/article-13456779-incident-20261120/source-audit.json、approved-originals-manifest.json、两账号浏览器截图/录屏。

用户已批准补齐清单14份。免费验证：本机同一19501环境15篇文章context均200，0模型；批量助手锁定14份、总字节和每份SHA，71条有界命令（仅临时分块可并发，最终OSS写串行），不建新服务。错误分类的6项回归通过，保持真实存储故障和权限错误不被掩盖。
