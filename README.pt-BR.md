# Agentes de frete Keystone

*Traduzido pelo Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é a referência.*

Trinta pequenos agentes MCP para custos de frete e envio. Cada um cuida de **uma única tarefa**, como auditar uma fatura de frete, montar a provisão de frete do fechamento do mês, liquidar pagamentos a transportadoras ou conferir uma declaração aduaneira, e não consegue agir fora dela. Eles leem os arquivos que você já exporta do TMS, ERP, WMS, portais de transportadoras e provedor de EDI, gravam relatórios no seu computador e esperam uma pessoa nomeada antes de qualquer coisa que movimente dinheiro, envie uma mensagem ou altere um sistema em produção.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · sem dependências

## Experimente

```bash
npx -y polaris-of-bills demo        # auditoria de faturas de frete com dados fictícios
npx -y procyon-of-accruals demo     # provisão de frete com dados fictícios
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos de teste e um servidor MCP (`npx -y <agent> mcp --root <pasta>`) para Claude Desktop, Claude Code, Cursor e outros hosts MCP. Por enquanto, nomes de colunas e relatórios estão em inglês.

## Os agentes

**O que as transportadoras cobram:** `polaris-of-bills` (lotação e fracionado contra contratos), `sirius-of-parcels` (encomendas), `vega-of-detention` (estadias e espera), `spica-of-fuel` (sobretaxas de combustível), `betelgeuse-of-accessorials` (origem dos serviços adicionais), `bellatrix-of-reweighs` (repesagens e mudanças de classe), `algol-of-duplicates` (pagamentos em dobro), `adhara-of-ocean` (marítimo), `canopus-of-air` (aéreo), `alcor-of-pods` (comprovantes de entrega), `fomalhaut-of-demurrage` (free time de contêineres e demurrage), `antares-of-entries` (declarações aduaneiras contra faturas comerciais, sem orientação de classificação).

**Planejar, comprar e operar o frete:** `altair-of-bids` (concorrências), `regulus-of-tariffs` (histórico recalculado em cada contrato), `nunki-of-quotes` (cotações spot), `mizar-of-lanes` (gasto por rota e consolidação), `rigel-of-scorecards` (scorecards de transportadoras), `aldebaran-of-carriers` (sinais de fraude), `mira-of-tracking` (cargas atrasadas), `hadar-of-docks` (agendamento de docas), `deneb-of-cartons` (tamanhos de caixa), `arcturus-of-edi` (leitura e conciliação de arquivos X12).

**Fechamento e custos:** `procyon-of-accruals` (provisão de frete), `castor-of-allocations` (rateio do frete por pedido e centro de custo), `pollux-of-costing` (padrões de frete no custo dos itens), `elnath-of-margins` (frete cobrado contra frete real por cliente), `alnilam-of-settlements` (pagamento a transportadoras para corretores), `capella-of-claims` (reclamações por avaria), `achernar-of-returns` (devoluções até o crédito), `shaula-of-emissions` (estimativas de emissões com os fatores que você escolher).

## Como eles se mantêm seguros

- **Lista permitida por agente.** Cada agente só pode chamar suas próprias ferramentas.
- **Ferramentas recusadas.** Pagar, enviar e-mails, alterar o TMS, lançar no razão ou registrar na aduana são nomeadas e bloqueadas.
- **Um clique nomeado.** Pagamentos, envios, mudanças em produção e aprovações de lançamentos esperam uma pessoa nomeada, mesmo no modo Auto, vinculados ao sha256 do rascunho revisado.
- **Log de auditoria** em `.keystone/`, encadeado por hash, assinado se você configurar uma chave Ed25519.
- **Parada de emergência:** `<agent> kill` para todas as ferramentas até `<agent> unkill`.

## Limites

- Cada agente trabalha apenas com os arquivos que você fornece e não faz login em nenhum sistema de transportadora, TMS, ERP, banco ou órgão público.
- Não é assessoria jurídica, tributária, aduaneira ou contábil. Pessoas decidem e agem.
