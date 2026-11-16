# Keystone 物流エージェント

*Claude による翻訳で、ネイティブによる確認は未実施です。英語の [README](README.md) が正本です。*

運賃・配送コストのための 30 の小さな MCP エージェントです。それぞれが **一つの業務** だけを担当します。運賃請求書の監査、月末の運賃未払計上、運送会社への支払精算、輸入申告の確認などで、その外では動けません。TMS、ERP、WMS、運送会社のポータル、EDI プロバイダーからすでにエクスポートしているファイルを読み、お客様のコンピューター上にレポートを書き出し、お金の移動、メッセージの送信、本番システムの変更の前には指名された担当者を待ちます。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 依存パッケージなし

## 試す

```bash
npx -y polaris-of-bills demo        # 架空データでの運賃請求監査
npx -y procyon-of-accruals demo     # 架空データでの運賃未払計上
```

各エージェントには架空のファイルで動く `demo`、自身のテストケースで確認する `eval`、Claude Desktop、Claude Code、Cursor などの MCP ホスト向けの MCP サーバー (`npx -y <agent> mcp --root <フォルダー>`) があります。現時点では、列名とレポートは英語です。

## エージェント一覧

**運送会社の請求:** `polaris-of-bills` (貸切・混載の請求と契約の照合)、`sirius-of-parcels` (宅配便)、`vega-of-detention` (待機料金)、`spica-of-fuel` (燃料サーチャージ)、`betelgeuse-of-accessorials` (付帯料金の発生源)、`bellatrix-of-reweighs` (再計量と等級変更)、`algol-of-duplicates` (二重払い)、`adhara-of-ocean` (海上輸送)、`canopus-of-air` (航空輸送)、`alcor-of-pods` (配達証明)、`fomalhaut-of-demurrage` (コンテナのフリータイムとデマレージ)、`antares-of-entries` (輸入申告と商業インボイスの照合、関税分類の助言なし)。

**計画・調達・運用:** `altair-of-bids` (入札)、`regulus-of-tariffs` (各契約での過去実績の再計算)、`nunki-of-quotes` (スポット見積)、`mizar-of-lanes` (レーン別支出と混載)、`rigel-of-scorecards` (運送会社スコアカード)、`aldebaran-of-carriers` (不正の兆候)、`mira-of-tracking` (遅延貨物)、`hadar-of-docks` (荷受けバースの予約)、`deneb-of-cartons` (箱のサイズ)、`arcturus-of-edi` (X12 ファイルの読み取りと照合)。

**決算とコスト:** `procyon-of-accruals` (運賃未払計上)、`castor-of-allocations` (受注・コストセンター別の運賃配賦)、`pollux-of-costing` (品目原価の運賃標準)、`elnath-of-margins` (顧客別の請求運賃と実運賃)、`alnilam-of-settlements` (ブローカー向け運送会社支払)、`capella-of-claims` (貨物事故の請求)、`achernar-of-returns` (返品から返金まで)、`shaula-of-emissions` (お客様が選んだ係数による排出量の見積)。

## 安全のしくみ

- **エージェントごとの許可リスト。** 各エージェントは自分のツールしか呼べません。
- **拒否するツール。** 支払、メール送信、TMS の変更、総勘定元帳への計上、税関への申告は名前を挙げて禁止しています。
- **指名された担当者の 1 クリック。** 支払、送信、本番変更、仕訳の承認は、Auto モードでも指名された担当者を待ちます。承認は確認した下書きの sha256 に結び付きます。
- **監査ログ** は `.keystone/` にハッシュ連鎖で記録され、Ed25519 鍵を設定すれば署名されます。
- **緊急停止:** `<agent> kill` で `<agent> unkill` まですべてのツールを止めます。

## 制限

- 各エージェントは渡されたファイルだけで動き、運送会社、TMS、ERP、銀行、行政のシステムにはログインしません。
- 法律・税務・通関・会計の助言ではありません。判断と実行は人が行います。
