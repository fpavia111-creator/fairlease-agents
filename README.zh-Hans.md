# Keystone 货运智能体

*由 Claude 翻译，尚待母语人士审校。以英文 [README](README.md) 为准。*

三十个面向货运和发货成本的小型 MCP 智能体。每个只负责 **一件事**，例如审核运费账单、编制月末运费预提、结算承运商付款或核对报关单，并且无法越界。它们读取您已经从 TMS、ERP、WMS、承运商门户和 EDI 服务商导出的文件，在您的电脑上写出报告，并在任何动用资金、发送消息或更改生产系统的操作之前等待一位具名人员确认。

MIT 许可证 · Node 20 或更高版本 · 仅本地文件 · 无需凭据 · 无依赖

## 试用

```bash
npx -y polaris-of-bills demo        # 用虚构数据审核运费账单
npx -y procyon-of-accruals demo     # 用虚构数据编制运费预提
```

每个智能体都有基于虚构文件的 `demo`、用自身测试用例检查的 `eval`，以及供 Claude Desktop、Claude Code、Cursor 等 MCP 主机使用的 MCP 服务器（`npx -y <agent> mcp --root <文件夹>`）。目前列名和报告为英文。

## 智能体

**承运商收费：** `polaris-of-bills`（整车和零担账单与合同核对）、`sirius-of-parcels`（快递）、`vega-of-detention`（压车和等待费）、`spica-of-fuel`（燃油附加费）、`betelgeuse-of-accessorials`（附加服务费的来源）、`bellatrix-of-reweighs`（复磅和等级变更）、`algol-of-duplicates`（重复付款）、`adhara-of-ocean`（海运）、`canopus-of-air`（空运）、`alcor-of-pods`（签收证明）、`fomalhaut-of-demurrage`（集装箱免费期和滞期费）、`antares-of-entries`（报关单与商业发票核对，不提供归类建议）。

**规划、采购和运营：** `altair-of-bids`（招标）、`regulus-of-tariffs`（用每份合同重算历史）、`nunki-of-quotes`（即期报价）、`mizar-of-lanes`（线路支出和拼载）、`rigel-of-scorecards`（承运商记分卡）、`aldebaran-of-carriers`（欺诈警示信号）、`mira-of-tracking`（延误货物）、`hadar-of-docks`（月台预约）、`deneb-of-cartons`（纸箱尺寸）、`arcturus-of-edi`（读取并核对 X12 文件）。

**结账与成本：** `procyon-of-accruals`（运费预提）、`castor-of-allocations`（按订单和成本中心分摊运费）、`pollux-of-costing`（物料成本中的运费标准）、`elnath-of-margins`（按客户比较收取运费与实际运费）、`alnilam-of-settlements`（经纪商承运商付款）、`capella-of-claims`（货损索赔）、`achernar-of-returns`（退货到退款）、`shaula-of-emissions`（按您选择的系数估算排放）。

## 如何保持安全

- **每个智能体的允许清单。** 每个智能体只能调用自己的工具。
- **拒绝的工具。** 付款、发送邮件、更改 TMS、过账到总账或向海关申报都被点名并禁止。
- **一次具名点击。** 付款、发送、生产变更和凭证批准，即使在 Auto 模式下也等待具名人员，并与已审阅草稿的 sha256 绑定。
- **审计日志** 保存在 `.keystone/`，以哈希链连接；配置 Ed25519 密钥后会签名。
- **紧急停止：** `<agent> kill` 会停止所有工具，直到 `<agent> unkill`。

## 限制

- 每个智能体只使用您提供的文件，不会登录任何承运商、TMS、ERP、银行或政府系统。
- 不构成法律、税务、海关或会计建议。由人来决定和执行。
