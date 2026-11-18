# WP09 K08唯一代码总评审包（2026-10-26）

当前用户明确继续K06及既定后续；仅本机专用合成环境/原两账号/当前Study/本人本轮对象。整片K01–K07代码与实际证据进入本次唯一fresh只读代码总评审，原spec文档评审不是代码评审。所有旧行/源/服务只读，不派实施代理或第二个评审。

## 边界与当前验证

- ResearchHub Git分支codex/ui-ue-validation，base=head=190f509d127b833a9380dfdf52916f20038b6f9c；当前未提交脏目录经用户批准，不工作树/commit/push/cleanup。review-package脚本正确拒绝empty commit range；本包改用下列完整文件路径和当前SHA，而不是伪造空diff或评审全仓无关改动。
- 规格docs/product/asset-applicability-spec-2026-10-26.md；计划和U01–U04清单同目录implementation-plan.md/authorization-scope.md。K01–K07实际完工见实施台账；机器账本在.superpowers/sdd/implementation-plan-asset-applicability-2026-10-26/progress.md，Ruling必须逐条核对。
- 运行适配只在scripts/local-asset-applicability.mjs与local-knowledge-ai.mjs新purpose窄分支；旧五类任务/原Agent/权限/科学数字政策保持。前序Source/asset/target/report/terminal run不写。
- 新API/新目的会话、双端当前授权/真实父/head/hash、规则/意见依据、来源、CAS/幂等/容量/在途提交均需评审；不因K05单元绿色免审本轮整片。
- 原两账号+第三未预运行通用合成例真实成功，revoke-final实际Provider在途撤U03无assistant，见implementation-k05-continuation-checkpoint.json和实测；本轮UI仅读已有成功结果。88笔known/累计¥1.899558，10job/9HTTP，上限10/12/¥5，paid=false且job满额，0新Provider。不可运行AI/activate/旧stateful harness或读取/输出凭证。
- 免费门禁1e58307d：399纯＋1054既有编译内核、构建/保全/空白均0；691源码/115表41128前序行/三旧scope/旧8进程保全。Node localstorage/chunk告警保留，不冒称0所有告警。
- Chrome主读取d72086b8两账号26组；flow-dc2290c7两账号22组含真实PG/CAS/丢响应/细分撤销/AI依据切换分批；auth-03bf0b6a两账号12组含非首项/历史/迟到200/切账号/退出；visual-b6fa3363两账号原生200%/键盘/字号。PNG/WebM均在外层docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/。失败不删除，状态型脚本不能盲重跑。
- AC10用户专业验收待签；本次只评本机技术交接，不允许自动放宽一期、权限、费用、旧内核或生产门槛。完整联网/全AI/正式治理等未承诺在此片交付，不改变原一期范围。

## Review Focus（计划原文）

1. 资产来源KB与目标KB不同、原ensure会话会写旧行；固定配置引用不得伪装模型已读原全文——K01/K02/K05独立purpose/旧行保全及实际工具来源测试。
2. 目标没有结构化入排字段、prepared config已stale、同名中文却不同key、null/0/false/options混合——K01/K03手核golden，禁止猜测临床等效。
3. 意见连续追加推进record版却误令同一AI失效；成功丢响应后同键被容量或当前读覆盖——K04/K07两连接/CAS/原回执和意见链反例。
4. U02单独撤销历史、U03只撤AI、非列表首项、在途原消息接口与迟到200旁路——K02/K05/K06/K07精确目标探针与双端投影反例。
5. 第六意图混入旧五类、Provider工具回合/JSON/英文或Unicode数量、复制旧确认冒称新AI或新专业确认——K01/K02/K05/K07互斥矩阵和真实轨迹/夹具出处核对。

## 评审输出

只读检查下列完整源码、测试和必要既有依赖；可读证据JSON/日志，不运行有状态测试、浏览器/数据库/Provider/授权改变，不改文件/索引/分支，不派子Agent。按真实用户影响列Critical/Important/Minor、绝对file:line、成因与最小修正；列Declined to judge（没有则空）及Ready to merge Yes/No/With fixes。生产不在本片放行含义中。主实施只对重要/严重项一轮RED→GREEN修补，原评审结论永久保留，不二次独立签认。

## 当前文件SHA256

```json
[
  {
    "path": "scripts/asset-applicability-activate.mjs",
    "sha256": "2476c6b796e3d92ac57986357bbb6ce7eb2c072f51268589bcfd0d7493743f6f"
  },
  {
    "path": "scripts/asset-applicability-ai-contract.mjs",
    "sha256": "66ba8a0fd4612afd9034e9a9df7f0a03c4d6ac424ee87bc8363500af4b7624d5"
  },
  {
    "path": "scripts/asset-applicability-ai-contract.test.mjs",
    "sha256": "957add747d1a46291b83f8eef2eebaee7cfcf5518ae852e91ce66cefa278c8af"
  },
  {
    "path": "scripts/asset-applicability-ai-live.mjs",
    "sha256": "2b8650dfd2895d27c2ff9a4002e770b06975ad0914493edad0b38ea63c79edc7"
  },
  {
    "path": "scripts/asset-applicability-ai-preflight.mjs",
    "sha256": "47f7df3dcc206c9465cc3293839dc931b7d5de86902b64c1d5d7544edb3658ff"
  },
  {
    "path": "scripts/asset-applicability-api.mjs",
    "sha256": "73ac215dd34b35d1927bbe2fb561a447c71b36c6ec7408a63ab5a6f173d6a877"
  },
  {
    "path": "scripts/asset-applicability-atomic.mjs",
    "sha256": "59bf25c80c7a8a8f50fce8145b71c89a183058ebbc71ff5b152b7f6e9e834731"
  },
  {
    "path": "scripts/asset-applicability-boundaries.mjs",
    "sha256": "a4cdaa744a4fe261701ac6725cfc8824cdad12cafe88cdfed599c5d28b110cc7"
  },
  {
    "path": "scripts/asset-applicability-capacity.mjs",
    "sha256": "87583f4a84db197dd8314150a1ba0124b72f39ed22beb7c15c0303ad4fbfe731"
  },
  {
    "path": "scripts/asset-applicability-contract.mjs",
    "sha256": "c4752ce59dc41f47d52e3005738b9e9020b925f91b7d2394941dfe0c66f660e5"
  },
  {
    "path": "scripts/asset-applicability-contract.test.mjs",
    "sha256": "ee11b0fada9b88085bdea04916c25801ddc8166356216274e0d3cd3a49988a2c"
  },
  {
    "path": "scripts/asset-applicability-create-read.mjs",
    "sha256": "2ac7d70075c8209824fbb553460b36a4b594138d9dc5c8862e9f86d4bd9fcd9f"
  },
  {
    "path": "scripts/asset-applicability-fee.mjs",
    "sha256": "afece4bb7dbc59ba33659918926d7506ba13729658a5b001b47bf5bc9b97c4cf"
  },
  {
    "path": "scripts/asset-applicability-fee.test.mjs",
    "sha256": "4d77ac5877c241bbb4012edbd14d178e523a1f064d9edf3be7e4824f707a5719"
  },
  {
    "path": "scripts/asset-applicability-free-gates.mjs",
    "sha256": "82e8a2db8e6828718cac911e3dceb26871b8be7a939d09cf540457cc34f3611b"
  },
  {
    "path": "scripts/asset-applicability-http.mjs",
    "sha256": "d966c12c3c28795cb51d8077be1ec97672f5662c8bdbd372e685cf03af47bfa8"
  },
  {
    "path": "scripts/asset-applicability-messages-preflight.mjs",
    "sha256": "f709351711600ace2aa8a2476ec2f3c7b3662b59d8108a63fc35f61811dca782"
  },
  {
    "path": "scripts/asset-applicability-opinions-pg.mjs",
    "sha256": "9e397d39af54f9a09606dba3c1973442170f23ff720a7d550ebaceb6ebe07945"
  },
  {
    "path": "scripts/asset-applicability-opinions.test.mjs",
    "sha256": "a5e9490398c8eb7f77b6fb7bd784391473e9312ce1a773b2fdcb1104f09cf563"
  },
  {
    "path": "scripts/asset-applicability-preservation.mjs",
    "sha256": "0fa20684964d013fdc246dadd0210f3a4adcf0ff8fea3a9dda5a06573a2db2fa"
  },
  {
    "path": "scripts/asset-applicability-preservation.test.mjs",
    "sha256": "c253bcd9a24cdab0591f52be169f5b28a13baaa2750b7c1ecbbcdd04e031a55a"
  },
  {
    "path": "scripts/asset-applicability-provider-preflight.mjs",
    "sha256": "4aa0fc5c3f26281d15c7fe655276d3ece6d9f57326ee4c66ae538c979de1fec7"
  },
  {
    "path": "scripts/asset-applicability-queue-preflight.mjs",
    "sha256": "c72e2112a1a96218d440ecc35fb86624e4bbbe12cd8a86d493760496d5d3cd11"
  },
  {
    "path": "scripts/asset-applicability-resolve-free-probes.mjs",
    "sha256": "fa44a3cc3b586a2f7799a8637c1e7546160ff5503d371e971c2b23f345e9de44"
  },
  {
    "path": "scripts/asset-applicability-runtime-preflight.mjs",
    "sha256": "49fd2cd83287189b6253c03829e6d0ecb8f8f8d459b2429000541fde10b954cd"
  },
  {
    "path": "scripts/asset-applicability-runtime-reload.mjs",
    "sha256": "2be964d68afd82fa26216ed70089bf6cb9151846a47bb988570d48689510de81"
  },
  {
    "path": "scripts/asset-applicability-scope.mjs",
    "sha256": "f146c4c55b4cc3b8217df32ed0df45ec32366a3bae74800558a6d3a600dfe883"
  },
  {
    "path": "scripts/asset-applicability-scope.test.mjs",
    "sha256": "4f01ed69125f636518c625af89d15b5c6843f29576c4d88c0fa71ae9c9dd3d99"
  },
  {
    "path": "scripts/asset-applicability-source-head.mjs",
    "sha256": "5a542766b1de8ee6147e11d439a18722d1415f3ddfa2b5ce28a8a0565fcad7f8"
  },
  {
    "path": "tests/fixtures/asset-applicability-input-golden.mjs",
    "sha256": "8569114943c85b8fdf057187d096a9ed67c90e8e10749d930e904783da0db130"
  },
  {
    "path": "tests/fixtures/asset-applicability-live.mjs",
    "sha256": "88466b829e3a0149945cd974bad71d7fa7cb0e0c5bbee67463a7784eef47942e"
  },
  {
    "path": "tests/fixtures/asset-applicability-rules-golden.mjs",
    "sha256": "df75e7ec997a638244c463b7a930c1e97e38ac5be96791faadf98a2274d96ca8"
  },
  {
    "path": "tests/fixtures/asset-applicability-runtime.mjs",
    "sha256": "95a22d06c68733972eb645b55529c63d7bdf7854be4c90663bc17ebab0c9d6ad"
  },
  {
    "path": "tests/fixtures/asset-applicability-services-runtime.mjs",
    "sha256": "39545e49a032c6519685914dfa3c37c62afd190c2fc2e896049ab42f02b002aa"
  },
  {
    "path": "tests/fixtures/asset-applicability.mjs",
    "sha256": "a6b1b72fb49128dcc1d5544cb987e03ae3a8440c72a09d3ac5c682238517b796"
  },
  {
    "path": "scripts/local-asset-applicability.mjs",
    "sha256": "42a454987226adc2b5e2722bd6830b452612f0e8e1ffc8642f5093e0b72f17b9"
  },
  {
    "path": "scripts/local-knowledge-ai.mjs",
    "sha256": "ced00c65af1c04815a78dcf3decabbdb127b936d1880000968fa2b23097dfd84"
  },
  {
    "path": "scripts/local-knowledge.mjs",
    "sha256": "1b8e4adc63ae182976b42b1a5887822cacbfd65afd66cb1859b44a59f4351f74"
  },
  {
    "path": "scripts/local-crf-method-assets.mjs",
    "sha256": "0024f85d1a8b9d31568605b3243bb9b3d005b0acf34fcb497a847cb0e23d736f"
  },
  {
    "path": "scripts/asset-applicability-output-replay.mjs",
    "sha256": "6b0fe44bf746a140fdfa6c534b47e95a5fd5dd38591055128bdd0a6ca848df4d"
  },
  {
    "path": "scripts/asset-applicability-reconcile-contract.mjs",
    "sha256": "abe27d4b8bbdd055af7464461ac8f60d81dd532dae814bfe3247d1285eaaf1b6"
  },
  {
    "path": "scripts/asset-applicability-reconcile-contract.test.mjs",
    "sha256": "be16f0c694d545223b9de23d8ee4d833162b32c857e7326124315e70f9a3a171"
  },
  {
    "path": "scripts/asset-applicability-reconcile.mjs",
    "sha256": "d683aea6da381d184df91cb7dae05cdcea52942933c82be48a680f9516c774d6"
  },
  {
    "path": "scripts/asset-applicability-shell-browser.mjs",
    "sha256": "2091b32478c72360c8061b2202434293f82734e150682c3dfbbfe4542fa6b37b"
  },
  {
    "path": "src/asset-applicability-session.js",
    "sha256": "56ba41ee2aa7c4223366994dabdce349d8fc3daa1e77ac108f487960d4b51390"
  },
  {
    "path": "src/knowledge-session.js",
    "sha256": "957f65b60539f06499fb4a82f75a3e227d7966565be2034d6662988d21b8fff1"
  },
  {
    "path": "src/research-design-session.js",
    "sha256": "c8ee1c458e16f48ad73773f0940415f573f88dc910d1bf85824d3755b78312cf"
  },
  {
    "path": "src/platform-shell.js",
    "sha256": "56f2115fc5b7e531ced03ca299b5480e8caeb7b281fef4252e0a89892e05a7d9"
  },
  {
    "path": "src/platform-frontend.js",
    "sha256": "1d197e7084f2576a54a62ee3727cd62af33ba17e6e402fe0c37299f0a992ad0b"
  },
  {
    "path": "pages/shared/missing-main.jsx",
    "sha256": "ce6a2360eacd36af453858d8a1d613dbfe46d9dd22eb15a9df6cd461448bcb30"
  },
  {
    "path": "pages/shared/CrfMethodAssetDetail.jsx",
    "sha256": "2e3fa222f89d1d4350cc06a21de1b74df53c8dc316d8d17a1f9171f6db7d9107"
  },
  {
    "path": "pages/shared/AssetApplicabilityWorkspace.jsx",
    "sha256": "48f4141f908891acf130115dbe0f7c7f45ba5957116948e365c4106c6d51c99a"
  },
  {
    "path": "pages/shared/AssetApplicabilityDetail.jsx",
    "sha256": "08371e1c2a5e924c3a9b241ff740ef295c1fa788f93900567b598e9c34fdb9fc"
  },
  {
    "path": "pages/shared/asset-applicability.css",
    "sha256": "1cbd94019a866bd9969113b4a896e3414ad253efc9ea99e180a1e91bf5db646f"
  },
  {
    "path": "scripts/asset-applicability-session.test.mjs",
    "sha256": "fd1f132603a5e00a41a35720345db8d007899b20c0743eca68af242e7ab09e1d"
  },
  {
    "path": "scripts/asset-applicability-browser.mjs",
    "sha256": "2544289e5eaab9edac3e9214e2b31703fc2fd06f20c68a452a35fe0296453bad"
  },
  {
    "path": "scripts/asset-applicability-browser-flows.mjs",
    "sha256": "f338ed40ed7a66a0bc40d5238a3093acd4ca8a2a81dd2acf219d22a4525398d8"
  },
  {
    "path": "scripts/asset-applicability-browser-auth.mjs",
    "sha256": "fa498e3fccca0a6b1eaa79fefcab2f08dfd2b7dbf378467a0a4bc1ec7f021373"
  },
  {
    "path": "scripts/asset-applicability-browser-visual.mjs",
    "sha256": "e2faa4996904046b0ceb2ea3734c541ba8501740fb17ab66d590ba698b4f5191"
  }
]
```
