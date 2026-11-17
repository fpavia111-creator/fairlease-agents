# Keystone 不動産管理エージェント

不動産管理のための小さな MCP エージェント 30 種です。商業不動産と中規模の住宅を管理する会社を想定しています。それぞれが **一つの仕事だけ** を担当します。たとえばレントロールと賃貸借契約の照合、預り金口座の照合、共益費（CAM）の再計算、テナントの保険証明書の催促などです。担当外のことはできません。AppFolio、Yardi、Buildium、Rent Manager などからすでに書き出しているファイルを読み、レポートをお使いのコンピューターに保存し、お金を動かす、メッセージを送る、本番システムを変えるといった操作の前には、名前のある担当者を待ちます。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 依存パッケージなし

他の言語: [English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md)（Claude による翻訳。ネイティブによる確認は未実施）

## 試してみる

このリポジトリを取得した場所で:

```bash
npm ci
node packages/granite-of-rentrolls/bin/granite-of-rentrolls.js demo     # レントロールと契約要約の照合（架空データ）
node packages/obsidian-of-trust/bin/obsidian-of-trust.js demo           # 預り金口座の三者照合（架空データ）
```

npm に公開された後は `npx -y granite-of-rentrolls demo` でも同じことができます。どのエージェントにも、架空ファイルで動く `demo`、自分のテストケースで確認する `eval`、ファイルの列がどう読まれたかを示す `inspect <ファイル>`、Claude Desktop・Claude Code・Cursor などの MCP ホスト向けの MCP サーバー（`<agent> mcp --root <フォルダー>`）があります。`--lang ja` でレポートが日本語になります（9 言語対応）。各エージェントの README にツールの一覧があります。

## エージェント一覧

**レントロール・賃貸借契約・収入**

| エージェント | すること | しないこと（ブロック） |
|---|---|---|
| [`granite-of-rentrolls`](packages/granite-of-rentrolls) | レントロールを契約要約と区画ごとに照合: 賃料、段階賃料、日付、敷金、面積、テナント、空室、契約期間後の継続入居 | 管理システムの変更、請求の計上 |
| [`slate-of-leases`](packages/slate-of-leases) | 商業用賃貸借契約を条項ごとに出典付きで要約。既存の要約を本文と照合 | システムの変更、署名依頼の送信 |
| [`jade-of-escalations`](packages/jade-of-escalations) | 請求済み賃料を各契約の改定スケジュール（段階、率、下限・上限付きの物価指数）と照合。今後の改定一覧 | 請求の計上 |
| [`garnet-of-renewals`](packages/garnet-of-renewals) | 更新が近い契約、提示期限、お客様自身の上限内での賃料案、更新提案書の下書き | 署名依頼やメールの送信 |
| [`shale-of-vacancy`](packages/shale-of-vacancy) | レントロールから稼働率、契約済み率、退去予定、空室損失、相場との差を算出 | システムの変更、募集広告の掲載 |
| [`talc-of-overage`](packages/talc-of-overage) | テナントの売上報告から歩合賃料を計算。遅れている報告や未提出の報告、精算書の下書き | 請求の計上、売上監査の開始 |
| [`feldspar-of-estoppels`](packages/feldspar-of-estoppels) | 売却やリファイナンス前に、返送されたテナント確認書（エストッペル）を契約要約と照合 | 署名依頼の送信、データルームへのアップロード |
| [`zircon-of-diligence`](packages/zircon-of-diligence) | 購入や融資の前に、売主のレントロールを直近 12 か月の収入と照合 | オファーの提出、データルームへのアップロード |
| [`tourmaline-of-migration`](packages/tourmaline-of-migration) | 切り替え時点で旧システムと新システムのレントロールを比較: 区画、テナント、賃料、敷金、残高、日付、合わない合計 | 本番稼働の承認、旧データの削除 |

**入居者・募集・回収**

| エージェント | すること | しないこと（ブロック） |
|---|---|---|
| [`quartz-of-delinquency`](packages/quartz-of-delinquency) | 滞納年齢表やテナント元帳から、お客様の方針に沿った段階付きの作業リストを作成。遅延損害金の確認、督促状の下書き | 通知の送達、明渡し訴訟の提起、信用情報機関への報告 |
| [`jasper-of-deposits`](packages/jasper-of-deposits) | 退去時の敷金精算をお客様のルール（期限、内訳、通常損耗、耐用年数）と照合。精算書の下書き | 返金、債権回収への移管 |
| [`amber-of-insurance`](packages/amber-of-insurance) | テナントの保険証明書を、契約が求める補償額・追加被保険者・期間と照合 | 代理での保険加入、契約違反通知の送達 |
| [`topaz-of-utilities`](packages/topaz-of-utilities) | 光熱費の按分（RUBS）をお客様の方法で再計算。過剰回収、空室への請求、急増 | 請求の計上、公益事業者ポータルの変更 |
| [`cobalt-of-listings`](packages/cobalt-of-listings) | 各サイトの募集広告をレントロールと照合。文言は担当者の確認用に指摘するだけ | 広告の掲載、募集賃料の変更、問い合わせへの返信 |
| [`mica-of-leads`](packages/mica-of-leads) | 問い合わせカードから募集の流れを分析: 返信の遅れや未返信、追客の期限、反響元ごとの成約率と成約単価 | 入居審査の判断、信用調査の実施、見込み客への連絡 |
| [`malachite-of-recerts`](packages/malachite-of-recerts) | 家賃補助住宅の再認定の期日と通知を、お客様の方針ファイルのスケジュールと照合。日付のみ | 世帯の認定、機関への提出、賃料の変更 |
| [`lapis-of-payouts`](packages/lapis-of-payouts) | Airbnb、Vrbo などの短期賃貸の入金を予約と銀行入金に照合 | ゲストへの返金、オーナーへの支払い、掲載内容の変更 |

**オーナー・預り金口座・経理**

| エージェント | すること | しないこと（ブロック） |
|---|---|---|
| [`obsidian-of-trust`](packages/obsidian-of-trust) | 三者照合: 銀行明細、出納帳、オーナー元帳とテナント元帳 | 資金移動、小切手の取消し、総勘定元帳への記帳 |
| [`onyx-of-statements`](packages/onyx-of-statements) | 送付前のオーナー報告書を確認: 計算、繰越、留保金、送金 | オーナーへの支払い、報告書の公開 |
| [`pyrite-of-fees`](packages/pyrite-of-fees) | 管理料・仲介料・上乗せ手数料を各管理委託契約から再計算 | オーナーへの返金計上、手数料設定の変更 |
| [`marble-of-cam`](packages/marble-of-cam) | 共益費（CAM）の精算: 費用区分、按分率、稼働率補正、上限、基準年、管理手数料 | 請求の計上、システムの変更 |
| [`beryl-of-budgets`](packages/beryl-of-budgets) | 予算と実績の比較、契約上説明が必要な差異、年末予測、オーナー向けメモの下書き | 予算の変更、総勘定元帳への記帳 |
| [`pearl-of-filings`](packages/pearl-of-filings) | 米国の 1099 の準備: 指定した基準額に対する受取人ごとの合計、納税者番号や住所の不足。納税者番号は常にマスク | 1099 の提出、番号照合の申請、源泉徴収の開始 |
| [`coral-of-associations`](packages/coral-of-associations) | 管理組合（HOA・マンション）の区分所有者口座を、お客様の管理費・回収方針と照合。規約違反を通知手順と照合 | 先取特権の登記、制裁金の計上 |
| [`chert-of-taxes`](packages/chert-of-taxes) | 固定資産税の評価、納期、お客様が入力した不服申立ての期限。納期のカレンダー | 不服申立ての提出、税金の支払い |

**運営・取引業者**

| エージェント | すること | しないこと（ブロック） |
|---|---|---|
| [`agate-of-workorders`](packages/agate-of-workorders) | 未完了の作業指示を目標日数に対して経過管理。繰り返す不具合、通常扱いの緊急案件、遅い業者 | 業者の手配、請求書の承認、作業指示の完了処理 |
| [`basalt-of-turns`](packages/basalt-of-turns) | 退去から入居までの原状回復: 日数、工種別の費用、テナント負担分、失われた賃料 | 業者の手配、請求の計上 |
| [`flint-of-inspections`](packages/flint-of-inspections) | 退去時と入居時の点検を項目ごとに比較。期限切れの点検、作業指示のない不良項目 | 請求の計上、業者の手配 |
| [`gypsum-of-capex`](packages/gypsum-of-capex) | 大規模修繕・設備投資を予算、発注済み額、工程、積立金と照合 | 変更契約や請求書の承認 |
| [`opal-of-vendors`](packages/opal-of-vendors) | 業者の保険・許可・税務書類をお客様の要件と照合。要件を満たしていない期間の支払い | 請求書の承認、業者ステータスの変更 |

## 安全の仕組み

- **エージェントごとの許可リスト。** 各エージェントは自分のツールしか呼べません。モデルが作り出したツールも含め、それ以外はすべてブロックされます。
- **拒否するツール。** 各エージェントは担当業務に近い実際の操作（返金、請求、明渡し、申告、メール送信）を名指しでブロックし、モデルが求めても明確に断ります。
- **名前付きの一回のクリック。** 下書きの送信、エージェントに覚えさせる内容の承認、本番稼働の承認は、Auto モードでも名前のある担当者を待ちます。承認は確認した下書きの sha256 に結び付けられ、下書きが変われば承認は一致しなくなります。
- **監査ログ。** すべての呼び出しが `.keystone/` 以下のハッシュチェーン付きログに記録され、鍵を設定すれば Ed25519 で署名されます。
- **緊急停止。** `<agent> kill` で `<agent> unkill` まですべてのツールを止めます。
- **悪意ある入力のテスト。** 表計算の数式、HTML、パスの細工、モデル宛ての文章を各エージェントのデータに仕込んで確認しています（`npm run hostile`）。
- **個人情報は最小限。** 納税者番号はどのレポートでもマスクされます。監査ログには引数そのものではなくハッシュを保存し、エージェントはファイルのコピーを持ちません。

## Claude Code で使う

このリポジトリは Claude Code のプラグインマーケットプレイスです。各エージェントは `npx` で MCP サーバーを起動するプラグインです:

```text
/plugin marketplace add <このリポジトリのパスまたは git URL>
/plugin install granite-of-rentrolls@keystone-property
```

プラグインは `npx -y <agent>@<version>` を起動するため、そのバージョンが npm にある必要があります。それまではローカルのコピーから追加してください:

```bash
claude mcp add granite-of-rentrolls -- node /path/to/keystone-agents/packages/granite-of-rentrolls/bin/granite-of-rentrolls.js mcp --root .
```

## 開発

```bash
npm ci
npm test                       # 全パッケージのテストと eval
npm run hostile                # 全エージェントに悪意ある入力を仕込んで確認
npm run bench                  # 1,000 行と 10,000 行での処理時間
npm run plugin:check           # プラグインファイルとパッケージの一致
npm run intl                   # すべての eval を他の 8 市場の形式のファイルで再実行
npm run mcp:check              # 公式 MCP SDK クライアントで全エージェントを確認
npm run release:check:offline  # パッケージ内容、ライセンス、文書、バージョン
```

CI は Node 20・22・24、Linux と Windows で実行します。

## 制限

- 各エージェントは渡されたファイルだけで動きます。管理システム、銀行、ポータルサイト、予約サイト、行政機関にはログインしません。
- 名前付きの出力形式は各システムの出力についての知識をもとに作成したもので、実際のアカウントでは確認していません。見出しが違う場合は `inspect` で対応付けを確認でき、`keystone-sources.json` で列を手動で指定できます。
- 結果の質は渡されたファイルの質を超えません。各レポートは前提を明記します。
- 法律・税務・会計の助言ではなく、広告が適法かどうかの判断もしません。基準額、期限、手数料のルールはお客様の方針ファイルから取ります。判断し実行するのは人です。
