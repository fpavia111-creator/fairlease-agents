# Fairlease 物业管理智能体

三十个用于物业管理的小型 MCP 智能体，面向商业物业和中等规模住宅的管理方。每个智能体 **只负责一项工作**，例如把租金清单（rent roll）与租约核对、对账托管账户、重算公共区域费用（CAM）或催收租户的保险证明，且不能越出这项工作。它们读取您已经从 AppFolio、Yardi、Buildium、Rent Manager 等系统导出的文件，在您的电脑上生成报告。它们从不动用资金、从不修改线上系统，任何信函或通知发出之前都会等待一位具名的人员。

MIT 许可证 · Node 20 或更高版本 · 只用本地文件 · 无需凭据 · 无依赖

其他语言：[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md)（由 Claude 翻译，尚待母语者审校）

## 试用

在本仓库的副本中：

```bash
npm ci
node packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js demo     # 租金清单与租约摘要核对，虚构数据
node packages/fairlease-trust-reconciliation/bin/fairlease-trust-reconciliation.js demo           # 托管账户三方对账，虚构数据
```

包发布到 npm 后，也可以用 `npx -y fairlease-rent-roll-audit demo`。每个智能体都有在虚构文件上运行的 `demo`、用自身测试用例检查的 `eval`、显示文件各列如何被读取的 `inspect <文件>`，以及供 Claude Desktop、Claude Code、Cursor 等 MCP 主机使用的 MCP 服务器（`<agent> mcp --root <文件夹>`）。加上 `--lang zh-Hans` 后，报告的标题、小标题、列名以及审批页面为中文（支持九种语言）；发现事项的句子和工具结果仍为英文。每个智能体的 README 列出了它的工具。

## 智能体

**租金清单、租约与收入**

| 智能体 | 做什么 | 绝不做（已阻止） |
|---|---|---|
| [`fairlease-rent-roll-audit`](packages/fairlease-rent-roll-audit) | 按单元把租金清单与您的租约摘要核对：租金、递增、日期、押金、面积、租户、空置、到期后续住 | 修改物业管理系统或记入费用 |
| [`fairlease-lease-abstracts`](packages/fairlease-lease-abstracts) | 逐条摘要商业租约文本并注明出处；把已有摘要与原文核对 | 修改系统或发送签署 |
| [`fairlease-rent-escalations`](packages/fairlease-rent-escalations) | 已开租金与每份租约的递增计划（固定档、百分比、带上下限的物价指数）核对；即将到来的涨租 | 记入费用 |
| [`fairlease-lease-renewals`](packages/fairlease-lease-renewals) | 即将续约的租约、报价截止日、在您自定上限内的建议租金、续约报价信草稿 | 发送签署或电子邮件 |
| [`fairlease-occupancy-and-vacancy`](packages/fairlease-occupancy-and-vacancy) | 从租金清单得出出租率、已签约比例、敞口、空置损失和低于市场租金的损失 | 修改系统或发布房源 |
| [`fairlease-percentage-rent`](packages/fairlease-percentage-rent) | 根据租户销售报告计算营业额分成租金，迟交和缺交的报告，结算单草稿 | 记入费用或启动销售审计 |
| [`fairlease-estoppel-review`](packages/fairlease-estoppel-review) | 出售或再融资前，把收回的租户确认书（estoppel）与租约摘要核对 | 发送签署或上传数据室 |
| [`fairlease-acquisition-diligence`](packages/fairlease-acquisition-diligence) | 购买或放贷前，把卖方的租金清单与过去十二个月的收入核对 | 提交报价或上传数据室 |
| [`fairlease-pms-migration`](packages/fairlease-pms-migration) | 切换时把旧系统与新系统的租金清单比对：单元、租户、租金、押金、余额、日期、对不上的合计 | 批准上线或删除旧数据 |

**租户、招租与收款**

| 智能体 | 做什么 | 绝不做（已阻止） |
|---|---|---|
| [`fairlease-delinquency-worklist`](packages/fairlease-delinquency-worklist) | 把账龄表或租户分户账变成按您自己政策分阶段的工作清单，核对滞纳金，催缴提醒草稿 | 送达法律通知、提起驱逐或报送征信机构 |
| [`fairlease-security-deposits`](packages/fairlease-security-deposits) | 按您自己的规则（期限、明细、正常损耗、使用年限）核对退租押金；结算单草稿 | 退款或转交催收 |
| [`fairlease-tenant-insurance`](packages/fairlease-tenant-insurance) | 把租户保险证明与租约要求的保额、附加被保险人和日期核对 | 代为投保或送达违约通知 |
| [`fairlease-utility-billback`](packages/fairlease-utility-billback) | 按您自己的方法重算公用事业费分摊（RUBS）；多收、对空置单元收费、费用激增 | 记入费用或修改公用事业门户 |
| [`fairlease-listing-checks`](packages/fairlease-listing-checks) | 把各网站上的房源与租金清单核对；措辞只标出供人审阅 | 发布房源、修改挂牌租金或回复潜在租户 |
| [`fairlease-leasing-funnel`](packages/fairlease-leasing-funnel) | 根据来访登记分析招租漏斗：回复慢或未回复、到期跟进、按来源的成交率和每份租约成本 | 决定申请、做背景调查或给潜在租户发短信 |
| [`fairlease-affordable-recerts`](packages/fairlease-affordable-recerts) | 按您政策文件中的时间表跟踪保障性住房的资格复核日期和通知。只看日期 | 认证家庭、向机构提交或修改租金 |
| [`fairlease-short-term-rental-payouts`](packages/fairlease-short-term-rental-payouts) | 把 Airbnb、Vrbo 等短租渠道的打款与预订和银行入账核对 | 给房客退款、向业主付款或修改渠道房源 |

**业主、托管账户与账务**

| 智能体 | 做什么 | 绝不做（已阻止） |
|---|---|---|
| [`fairlease-trust-reconciliation`](packages/fairlease-trust-reconciliation) | 三方对账：银行对账单、账簿登记、业主和租户分户账 | 划转资金、作废支票或过账到总账 |
| [`fairlease-owner-statements`](packages/fairlease-owner-statements) | 业主报表发出前检查：计算、结转、留存准备金、分配 | 向业主付款或发布报表 |
| [`fairlease-management-fees`](packages/fairlease-management-fees) | 按每份委托管理合同重算管理费、招租费和加价 | 记入业主贷项或修改费用设置 |
| [`fairlease-cam-reconciliation`](packages/fairlease-cam-reconciliation) | 公共区域费用（CAM）结算：费用池、分摊比例、出租率调整、上限、基准年、管理费 | 记入费用或修改系统 |
| [`fairlease-budget-variance`](packages/fairlease-budget-variance) | 预算与实际对比，合同要求说明的差异，年末预测，给业主的说明草稿 | 修改预算或过账到总账 |
| [`fairlease-tax-forms`](packages/fairlease-tax-forms) | 美国 1099 表准备：按您给出的门槛汇总每位收款人，缺失或格式错误的税号与地址；税号始终打码 | 申报 1099、提交税号比对或开始预扣 |
| [`fairlease-hoa-accounts`](packages/fairlease-hoa-accounts) | 业主协会（HOA、共管公寓）业主账户与您的收费和催收政策核对；违规事项与您的通知步骤核对 | 登记留置权或记入罚款 |
| [`fairlease-property-taxes`](packages/fairlease-property-taxes) | 房产税评估、分期缴款和您录入的申诉截止日；到期日历 | 提起申诉或缴税 |

**运营与供应商**

| 智能体 | 做什么 | 绝不做（已阻止） |
|---|---|---|
| [`fairlease-work-orders`](packages/fairlease-work-orders) | 按您的目标时限统计未完成工单的账龄，重复问题、被当作例行的紧急情况、响应慢的供应商 | 派单、批准发票或关闭工单 |
| [`fairlease-unit-turns`](packages/fairlease-unit-turns) | 从退租到入住的翻新：天数、分工种成本、可向租户收取的项目、损失的租金 | 派单或记入费用 |
| [`fairlease-unit-inspections`](packages/fairlease-unit-inspections) | 逐项对比退租与入住检查，逾期的检查，状况差却没有工单的项目 | 记入费用或派单 |
| [`fairlease-capital-projects`](packages/fairlease-capital-projects) | 资本项目与预算、已承诺金额、进度和储备金核对 | 批准变更单或发票 |
| [`fairlease-vendor-compliance`](packages/fairlease-vendor-compliance) | 供应商的保险、执照和税表与您的要求核对；不合规期间支付的款项 | 批准发票或修改供应商状态 |

## 如何保证安全

- **每个智能体一份允许清单。** 每个智能体只能调用自己的工具，其余一律阻止，包括模型臆造的工具。
- **拒绝的工具。** 每个智能体点名阻止与其工作相近的真实操作（退款、记费、驱逐、申报、发送邮件），模型请求时会得到明确拒绝。
- **具名的一次点击。** 发送草稿、接受智能体要记住的内容、批准上线，都要等待一位具名人员，即使在 Auto 模式下也一样。批准与所审草稿的 sha256 绑定；草稿一改，批准即不再匹配。
- **审计日志。** 每次调用都写入 `.keystone/` 下的哈希链日志；配置密钥后用 Ed25519 签名。
- **紧急停止。** `<agent> kill` 会停止所有工具，直到 `<agent> unkill`。
- **恶意输入测试。** 在每个智能体的数据中植入电子表格公式、HTML、路径技巧和针对模型的文字（`npm run hostile`）。
- **尽量少的个人数据。** 税号在每份报告中都打码。审计日志保存参数的哈希而不是参数本身，智能体不保留您文件的副本。

## 在 Claude Code 中使用

本仓库是一个 Claude Code 插件市场。每个智能体都是一个用 `npx` 启动其 MCP 服务器的插件：

```text
/plugin marketplace add <本仓库的路径或 git URL>
/plugin install fairlease-rent-roll-audit@keystone-property
```

插件会启动 `npx -y <agent>@<version>`，因此需要该版本已在 npm 上。在此之前，可从本地副本添加：

```bash
claude mcp add fairlease-rent-roll-audit -- node /path/to/fairlease-agents/packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js mcp --root .
```

## 开发

```bash
npm ci
npm test                       # 所有包的测试和 eval
npm run hostile                # 在每个智能体中植入恶意输入
npm run bench                  # 1,000 行和 10,000 行的耗时
npm run plugin:check           # 插件文件与包一致
npm run intl                   # 用其他八个市场格式的文件重跑每个 eval
npm run mcp:check              # 用官方 MCP SDK 客户端检查每个智能体
npm run release:check:offline  # 包内容、许可证、文档和版本
```

CI 在 Node 20、22、24 以及 Linux 和 Windows 上运行。

## 局限

- 每个智能体只处理您提供的文件，不登录任何物业管理系统、银行、房源网站、渠道或政府系统。
- 具名的导出格式是根据对这些导出的了解编写的，未在真实账户上核实。若表头不同，`inspect` 会显示匹配情况，`keystone-sources.json` 可手动指定列名。
- 结果的质量取决于这些文件。每份报告都会说明它的假设。
- 不构成法律、税务或会计建议，也不判断广告是否合法。门槛、期限和收费规则来自您自己的政策文件。由人来决定和执行。
