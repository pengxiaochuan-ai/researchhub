# T18 报告执行器 UI 冻结守门独立窄审

2026-11-12。仅源码与离线反例，未导入/执行两报告执行器，未访问 API/PG 或更改产品。执行器 fail-closed sentinel 保持。

初版对项目内路径只核 workspace 字符串前缀，不能阻止 Hub 兄弟目录 traversal 或 symlink；`syntheticOnly`/`businessWriteWindowClosed` 还接受 truthy 字符串。独立3项 RED 保存在 `researchhub/.tmp/t18-ui-freeze-independent-red.tap`，反例源码在 `docs/testing/evidence/research-t18-2026-11-12/ui-freeze-independent-review/guard-independent.test.mjs`。

修复版本 guard SHA256 `4e736eafcc91ed7f96ce32ed8bb91a38e22f1106cf90ea333f55d18c9decac84`；检查 Hub 内 lexical 与 realpath、真实 manifest/source 路径不变、内容逐项原SHA、strict true 两标志及真实路径去重。独立3项与作者7项合跑10/10，证据 `researchhub/.tmp/t18-ui-freeze-independent-green.tap`。主报告执行器 SHA `d5ac7b971facccce3ef9052abeb790d16d521576009e807776587885cf8d9f73`，更正报告 `ad810df55daebcfc3ffb9b17c228a5b13ac755405b8c72f16b9019ab622a0f39`；每次业务POST armed前、原键持久化后/实际 dispatch前及最终交付检查均调用源守门。若 dispatch前第二次检查失败，原pending保留，不继续POST。manifest确切内容与项数由主循环逐项核验并在私有批准proof中绑定其SHA，guard不自动采用变更后的SHA。

启动顺序先检查源再读取pending：若重启时源已漂移，本脚本会停在原回执GET之前；主循环须按保留journal另行只读核对原键，不能把停线描述成自动查询成功。此审查不确认最终UI快照、运行实例、真实业务结果或临床/生产。
