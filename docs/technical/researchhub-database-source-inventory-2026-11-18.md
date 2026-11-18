# ResearchHub数据库SQL源文件库存

2026-11-18，仅源文件hash清单；不是生产迁移执行顺序。公共表及旧Prisma前置仍需另核。详见[部署边界](repository-and-database-delivery-2026-11-18.md)。

| 文件 | SHA256 | 声明的schema |
| --- | --- | --- |
| `server/academic-content/schema.sql` | `ca42aceee611854c6e040b61d98233c92a259f6a5e523712795083e2a236fe87` | rh_academic |
| `server/admission/schema.sql` | `ee827a2cb0ddcb9661d00abaeef0c6930d7813863e40cb4ca9984a9e33229e1a` | rh_admission |
| `server/ai-agent/research-data-import-schema.sql` | `4419fd2f80b300ca68cb11d1369d019d464b940fd2ce58de5c35668310a66b1f` | 既有schema扩展 |
| `server/ai-agent/research-data-schema.sql` | `63b52261662dab0d42abd45fe328d8d65f9f0950a37785d1bd5d97eab6dc9376` | 既有schema扩展 |
| `server/ai-agent/session-material-schema.sql` | `8c95e1f70d40d55a03836c541a6027bdd72d0d3480d6ebe9f967e89a25a8d704` | rh_ai |
| `server/ai-agent/session-media-content-schema.sql` | `8c2c4b9d1faf0562de96664bb54d7ec3c8993e5006586cb246215712d5358fc2` | 既有schema扩展 |
| `server/ai-agent/session-media-ingest-schema.sql` | `9532abd8804e679db33bd2a914b6381f87537ab5762c257a855346e2427f5508` | 既有schema扩展 |
| `server/ai-agent/session-media-schema.sql` | `18cd605307c6ec70578c298882747deecb2189bca2ccfda6229e96d3191e048c` | 既有schema扩展 |
| `server/ai-agent/subject-profile-import-schema.sql` | `f7cc56b110a332779a6079ad7a70dcc24d95d67a668094151748147295a299fa` | 既有schema扩展 |
| `server/directory/schema.sql` | `38934525852028e84c7315a0d9cbf55694542bb09035c4bc70d6bf49abbe325b` | rh_directory |
| `server/directory/source-lock.sql` | `4c98f62c925dcee7bb07a29a71386816ef01ed5ea6c34f1eafeb5624f3db35e1` | 既有schema扩展 |
| `server/directory/team-draft.sql` | `618faaaf8c1c05926d9eec08762d2e7bb171796488fd62a57131fbcff8400567` | 既有schema扩展 |
| `server/governance-users/account-receipt.sql` | `5daea0e07759fd400eb5b695aa66b0ae2e59da3c05df7f5488e0c15bbc4b28c2` | 既有schema扩展 |
| `server/hub/schema.sql` | `9873e9c5ef36813739829068e6b6e64bccf32a43599bf4676b5e905b46a2de28` | rh_hub |
| `server/hub-sources/external-schema.sql` | `14b36ce837704d389bcc30807e2a77207e8bbe805c2c6a9320594c0d4ef67bc9` | 既有schema扩展 |
| `server/hub-sources/guidance-clause-schema.sql` | `ec0db531deb761b0e7b14916500fa4da94f56b6c4820f8e2dcc02479942820a9` | 既有schema扩展 |
| `server/hub-sources/pmc-article-decision.sql` | `8d555eda2acd935b26a4d87ddba47f3268b57031e8bffd459610c3fe9a544f3b` | 既有schema扩展 |
| `server/hub-sources/pmc-schema.sql` | `f4a2c70dc7934ed753f9c2428cd0d0710f23ba3cc6bcae70aa68e72fd1e140d5` | 既有schema扩展 |
| `server/hub-sources/publication-classification.sql` | `ae4fba2e887f1848c1ae79efdbf64dc66c9456b99f2a78da82fa4a618f3a5f54` | 既有schema扩展 |
| `server/hub-sources/registry-detail-schema.sql` | `73e9003cf525e643605fd0c36260e697aa6065dd9bf0e33852aacb27f0c615cf` | 既有schema扩展 |
| `server/hub-sources/review-receipt-read.sql` | `291a5458ff0026596e75108d51c4def1d90b382cdd8f5d0d852d368eed3c6a89` | 既有schema扩展 |
| `server/hub-sources/schema.sql` | `6231b6a0157d82f0481ea675febe9f53631ef9a641b1ff630c78af63b8a29432` | 既有schema扩展 |
| `server/reference/schema.sql` | `19b1f8a032983f6dd4809efc9747a2c04d2e542cc7f0799664674b81c5e409ab` | rh_reference |
| `server/research-assets/access-guards-v2.sql` | `fe3cf1964020b4960003abdc91ed1bcaf74f3538b70abe916b9735262d805fd2` | 既有schema扩展 |
| `server/research-assets/detail-v1.sql` | `d6ec7056c8e90cff89659e97b90d7efd7c6703d7141ec499e25886adc5419110` | 既有schema扩展 |
| `server/research-assets/report-ai-consent-schema.sql` | `d792904471fc057d799ba72df622b1f98dd4a6f3d55ddfe76027994c7f9503c4` | 既有schema扩展 |
| `server/research-assets/schema.sql` | `cda74ffc112a99e7f82ef9b0bd41f53226a1b9ae1ee7df245296d1709850b298` | rh_asset |
| `server/research-identity/schema.sql` | `e9efa98b55527b5e387b009b300d6b92eab546695887854660adf64e6c830dab` | 既有schema扩展 |
| `server/research-studies/schema.sql` | `a4f2f60bb6b18c61a1095c7bc675f75e8bf01c89b37bac625c8eaaf558bc6fa1` | rh_research |
| `server/study-tasks/schema.sql` | `af72bf4ff8e2f24fc448a5d0291670a1dde4893a2149f82e652b2c9b5690290f` | rh_study_tasks |
