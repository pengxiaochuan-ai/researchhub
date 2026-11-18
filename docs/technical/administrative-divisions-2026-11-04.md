# 共用省市字典、选择组件与团队兼容字段

## 来源与版本

民政部官方《2024年中华人民共和国县以上行政区划代码》：https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html 。本轮直接GET200下载，原件存docs/reference/china-administrative-divisions/mca-2024.html，SHA256 d4669f6c81091287127147720bad0f3c3465e9e2a2dcc7e887893cc787a23431；固定标识MCA-2024-12-31，3213条/34省。快照不称最新；2025国家地名信息库入口403，未绕过或混拼第三方数据。GB/T 2260-2007现行状态已查全国标准信息公共服务平台。

解析只接受固定原件SHA/3213唯一六位码/34省、完整父链；原表星号保留source_name，显示name去末尾星号。完整省地县条目入一张字典，但首期UI只有两级；不构造不存在的110100。四直辖市第二级用自身真实代码；省直辖地区直接挂省；港澳台原件无下级则明确省级，不生成假城市。

## 数据库及权限

一个全平台中性参考表rh_reference.administrative_division，PK(dataset_version,code)，八字段：dataset_version/code/name/source_name/parent_code/level/source_url/source_sha256；父链FK延迟核验。无账号/租户/机构/临床数据。aisci_app仅schema USAGE及表SELECT，无写接口/表或列写权限，无PUBLIC授权；公用字典不取消业务RLS。

仅专用合成库执行：`node scripts/reference-divisions-schema.mjs --mode local-synthetic --approved-reference-divisions`。最初v1完整保留；独立评审发现列ACL遗漏后追加rh-reference-divisions-2024-v2收据，不覆盖v1、不新增授权/不重导数据。v2检查表/Schema/全部列ACL、授权选项、应用有效列SELECT与INSERT/UPDATE/REFERENCES；升级必须原v1精确指纹及只读状态符合。数据逐字段hash与固定原件解析结果核对，缺行/改名/版本/metadata不符即拒绝。当前写权限负例使用真实PG，漂移反例为纯评估器，未临时向任何角色GRANT。

服务启动必须inspectReferenceSchema=existing；数据变更在每次字典读取时拒绝。已运行服务ACL变化需下次启动准入核对，不冒称持续全实例ACL监控。仅本机启用，无生产迁移；停用不自动删表、撤权或改旧服务。

## 接口

GET /api/reference/administrative-divisions（当前登录账号）；无参返回省份，有参只接受唯一parentCode=省级六位码。返回version、source(url/sha256/asOf)、items(code/name/level/parentCode)、provinceOnly。

同源/loopback/Host按本机现有守门；认证401，重复/未知参数或非省父码400，字典不可用503，Cache-Control:no-store。不接tenantId/自选URL/版本覆盖，不运行时联网。无POST/写API；读公用字典不等于团队/Study任何业务授权。

## 组件及兼容

ProvinceCitySelect为受控组件，props：value（可选代码对象）、city/region旧文字、onChange、disabled。新选择输出location(version/provinceCode/cityCode)、region、city；清除输出location:null与空文字。先省后市，省变化立即清市；独立客户端Abort/代次及组件取消标记拒绝迟到。加载、空下级、失败重试可见；旧文字只读提示、不猜测映射、不静默移除。

原entity.team_draft.data可选增加location，不存在时旧序列化结果保持，原profile.city可选增加division。保存/预览检查PG版本、父子及名称，组合审核再次预览并复用原事务；高级append也验证新增division，防止绕过。普通省份仅选省可保存但预览提示补城市；原件无下级可保留省级名称/空cityCode。不新增坐标或推断经纬度；原同名/地区未变坐标保留规则不变。

列表DTO只增savedAt，原reviewed/hasDraft/hasPublished保持；审核状态与展示状态分列，不能因保存草稿让原公开资料消失。
