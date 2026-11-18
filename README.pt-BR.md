# Agentes Fairlease para administração de imóveis

Trinta pequenos agentes MCP para administração de imóveis, pensados para administradoras de imóveis comerciais e de carteiras residenciais de porte médio. Cada um tem **uma única tarefa**, como conferir o rent roll com os contratos, conciliar uma conta de terceiros, recalcular as despesas comuns (CAM) ou cobrar os certificados de seguro dos inquilinos, e não pode agir fora dela. Eles leem os arquivos que você já exporta do AppFolio, Yardi, Buildium, Rent Manager e outros sistemas, gravam relatórios na sua máquina, nunca movimentam dinheiro nem alteram um sistema em produção, e esperam uma pessoa identificada antes que qualquer carta ou aviso seja enviado.

Licença MIT · Node 20 ou mais recente · somente arquivos locais · sem credenciais · sem dependências

Outros idiomas: [English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (traduzido pelo Claude; revisão nativa pendente)

## Experimente

A partir de uma cópia deste repositório:

```bash
npm ci
node packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js demo     # rent roll contra resumos de contrato, dados fictícios
node packages/fairlease-trust-reconciliation/bin/fairlease-trust-reconciliation.js demo           # conciliação tripla de conta de terceiros, dados fictícios
```

Quando os pacotes estiverem no npm, o mesmo funciona com `npx -y fairlease-rent-roll-audit demo`. Cada agente tem um `demo` com arquivos fictícios, um `eval` que o verifica com seus próprios casos de teste, um `inspect <arquivo>` que mostra como as colunas foram lidas e um servidor MCP (`<agente> mcp --root <pasta>`) para Claude Desktop, Claude Code, Cursor e outros hosts MCP. Com `--lang pt-BR` os títulos, cabeçalhos e nomes de coluna dos relatórios e a página de aprovações saem em português (nove idiomas disponíveis); as frases dos achados e os resultados das ferramentas continuam em inglês. O README de cada agente lista suas ferramentas.

## Os agentes

**Rent roll, contratos e receitas**

| Agente | O que faz | Nunca faz (bloqueado) |
|---|---|---|
| [`fairlease-rent-roll-audit`](packages/fairlease-rent-roll-audit) | Rent roll contra seus resumos de contrato, unidade por unidade: aluguéis, reajustes escalonados, datas, cauções, áreas, inquilinos, vagas, permanências após o vencimento | Alterar o sistema de administração ou lançar cobranças |
| [`fairlease-lease-abstracts`](packages/fairlease-lease-abstracts) | Contratos comerciais resumidos cláusula por cláusula com a citação de cada termo; resumos existentes conferidos com o texto | Alterar o sistema ou enviar para assinatura |
| [`fairlease-rent-escalations`](packages/fairlease-rent-escalations) | Aluguel cobrado contra o cronograma de reajuste de cada contrato (degraus, percentuais, índice com piso e teto); reajustes a vencer | Lançar cobranças |
| [`fairlease-lease-renewals`](packages/fairlease-lease-renewals) | Contratos a renovar, prazos de proposta, aluguéis propostos dentro do seu próprio teto, cartas de proposta em rascunho | Enviar para assinatura ou por e-mail |
| [`fairlease-occupancy-and-vacancy`](packages/fairlease-occupancy-and-vacancy) | Ocupação, percentual locado, exposição, perda por vacância e perda frente ao mercado a partir de um rent roll | Alterar o sistema ou publicar anúncios |
| [`fairlease-percentage-rent`](packages/fairlease-percentage-rent) | Aluguel percentual sobre vendas a partir dos relatórios dos lojistas, relatórios atrasados ou ausentes, demonstrativo em rascunho | Lançar cobranças ou iniciar auditoria de vendas |
| [`fairlease-estoppel-review`](packages/fairlease-estoppel-review) | Declarações de inquilinos (estoppels) devolvidas, contra seus resumos de contrato antes de venda ou refinanciamento | Enviar para assinatura ou subir em data room |
| [`fairlease-acquisition-diligence`](packages/fairlease-acquisition-diligence) | Rent roll do vendedor contra os últimos doze meses de receita antes de comprar ou financiar | Enviar proposta ou subir em data room |
| [`fairlease-pms-migration`](packages/fairlease-pms-migration) | Rent roll do sistema antigo contra o do novo na virada: unidades, inquilinos, aluguéis, cauções, saldos, datas, totais que não batem | Aprovar a entrada em produção ou apagar dados antigos |

**Inquilinos, locação e cobrança**

| Agente | O que faz | Nunca faz (bloqueado) |
|---|---|---|
| [`fairlease-delinquency-worklist`](packages/fairlease-delinquency-worklist) | Aging ou conta do inquilino transformados em lista de trabalho com as etapas da sua própria política, conferência de multas, lembretes em rascunho | Notificar judicialmente, ajuizar despejos ou negativar em birôs de crédito |
| [`fairlease-security-deposits`](packages/fairlease-security-deposits) | Cauções na saída contra suas próprias regras (prazo, discriminação, desgaste normal, vida útil); demonstrativo em rascunho | Devolver dinheiro ou enviar para cobrança |
| [`fairlease-tenant-insurance`](packages/fairlease-tenant-insurance) | Certificados de seguro dos inquilinos contra limites, segurados adicionais e datas exigidos no contrato | Contratar seguro por conta do inquilino ou notificar inadimplemento |
| [`fairlease-utility-billback`](packages/fairlease-utility-billback) | Rateio de consumo (RUBS) refeito pelo seu próprio método; recuperação a maior, unidades vagas cobradas, picos | Lançar cobranças ou alterar portais de concessionárias |
| [`fairlease-listing-checks`](packages/fairlease-listing-checks) | Anúncios em todos os portais contra o rent roll; redação sinalizada para revisão por uma pessoa | Publicar anúncios, mudar o aluguel pedido ou responder interessados |
| [`fairlease-leasing-funnel`](packages/fairlease-leasing-funnel) | Funil de locação a partir das fichas de interessados: respostas lentas ou ausentes, follow-ups vencidos, conversão e custo por contrato por origem | Decidir propostas, rodar análise cadastral ou mandar mensagens a interessados |
| [`fairlease-affordable-recerts`](packages/fairlease-affordable-recerts) | Datas e avisos de recertificação em habitação subsidiada pelo calendário do seu arquivo de política. Somente datas | Certificar famílias, enviar a um órgão ou mudar aluguéis |
| [`fairlease-short-term-rental-payouts`](packages/fairlease-short-term-rental-payouts) | Repasses de locação por temporada do Airbnb, Vrbo e outros contra reservas e créditos bancários | Reembolsar hóspedes, pagar proprietários ou alterar anúncios do canal |

**Proprietários, contas de terceiros e contabilidade**

| Agente | O que faz | Nunca faz (bloqueado) |
|---|---|---|
| [`fairlease-trust-reconciliation`](packages/fairlease-trust-reconciliation) | Conciliação tripla: extrato bancário, razão do caixa, contas de proprietários e inquilinos | Movimentar recursos, cancelar cheques ou lançar no razão |
| [`fairlease-owner-statements`](packages/fairlease-owner-statements) | Prestações de contas a proprietários conferidas antes do envio: cálculos, saldo anterior, reservas, repasses | Pagar proprietários ou publicar prestações de contas |
| [`fairlease-management-fees`](packages/fairlease-management-fees) | Taxas de administração, locação e acréscimos recalculados a partir de cada contrato de administração | Lançar créditos ou mudar a configuração de taxas |
| [`fairlease-cam-reconciliation`](packages/fairlease-cam-reconciliation) | Conciliação de despesas comuns (CAM): grupos de despesa, frações, ajuste de ocupação, tetos, anos-base, taxa de administração | Lançar cobranças ou alterar o sistema |
| [`fairlease-budget-variance`](packages/fairlease-budget-variance) | Orçado contra realizado, variações que o contrato manda explicar, projeção de fim de ano, memorando ao proprietário em rascunho | Mudar o orçamento ou lançar no razão |
| [`fairlease-1099-filings`](packages/fairlease-1099-filings) | Preparação dos formulários 1099 dos EUA: totais por favorecido contra o limite que você informa, números fiscais e endereços faltantes; números fiscais sempre mascarados | Transmitir 1099, consultar números fiscais ou iniciar retenção na fonte |
| [`fairlease-hoa-accounts`](packages/fairlease-hoa-accounts) | Contas de condôminos (HOA, condomínio) contra sua política de rateio e cobrança; infrações contra suas etapas de notificação | Registrar ônus ou lançar multas |
| [`fairlease-property-taxes`](packages/fairlease-property-taxes) | Lançamentos de imposto predial, parcelas e os prazos de recurso que você cadastra; calendário de vencimentos | Apresentar recursos ou pagar impostos |

**Operação e fornecedores**

| Agente | O que faz | Nunca faz (bloqueado) |
|---|---|---|
| [`fairlease-work-orders`](packages/fairlease-work-orders) | Ordens de serviço abertas envelhecidas contra suas metas, problemas repetidos, emergências registradas como rotina, fornecedores lentos | Acionar fornecedores, aprovar faturas ou encerrar ordens |
| [`fairlease-unit-turns`](packages/fairlease-unit-turns) | Preparação de unidades entre a saída e a entrada: dias, custo por especialidade, itens cobráveis, aluguel perdido | Acionar fornecedores ou lançar cobranças |
| [`fairlease-unit-inspections`](packages/fairlease-unit-inspections) | Vistoria de saída contra a de entrada, item por item, vistorias atrasadas, itens ruins sem ordem de serviço | Lançar cobranças ou acionar fornecedores |
| [`fairlease-capital-projects`](packages/fairlease-capital-projects) | Projetos de investimento contra orçamento, compromissos, cronograma e reservas | Aprovar aditivos ou faturas |
| [`fairlease-vendor-compliance`](packages/fairlease-vendor-compliance) | Seguro, licença e formulário fiscal dos fornecedores contra seus requisitos; pagamentos feitos fora de conformidade | Aprovar faturas ou mudar o status do fornecedor |

## Como eles se mantêm seguros

- **Lista de permissões por agente.** Cada agente só chama suas próprias ferramentas. Todo o resto é bloqueado, inclusive ferramentas inventadas por um modelo.
- **Ferramentas recusadas.** Cada agente nomeia as ações reais próximas da sua tarefa (reembolsos, cobranças, despejos, transmissões, envio de e-mail) e as bloqueia; um modelo que as peça recebe uma recusa clara.
- **Um clique identificado.** Enviar um rascunho, aceitar algo que o agente deve lembrar ou aprovar uma entrada em produção espera uma pessoa identificada, mesmo no modo Auto. A aprovação fica ligada ao sha256 do rascunho revisado; se o rascunho mudar, a aprovação deixa de valer.
- **Log de auditoria.** Cada chamada vai para um log encadeado por hash em `.keystone/`, assinado com Ed25519 quando você configura uma chave.
- **Botão de parada.** `<agente> kill` para todas as ferramentas até `<agente> unkill`.
- **Testados contra entradas hostis.** Fórmulas de planilha, HTML, truques de caminho e texto dirigido ao modelo são plantados nos dados de cada agente (`npm run hostile`).
- **Poucos dados pessoais.** Números fiscais são mascarados em todo relatório. O log de auditoria guarda um hash dos argumentos, não os argumentos, e os agentes não guardam cópia dos seus arquivos.

## Com o Claude Code

Este repositório é um marketplace de plugins do Claude Code. Cada agente é um plugin que inicia seu servidor MCP com `npx`:

```text
/plugin marketplace add <caminho ou URL git deste repositório>
/plugin install fairlease-rent-roll-audit@keystone-property
```

Os plugins iniciam `npx -y <agente>@<versão>`, então precisam dessa versão no npm. Até lá, adicione um agente a partir de uma cópia local:

```bash
claude mcp add fairlease-rent-roll-audit -- node /caminho/para/fairlease-agents/packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js mcp --root .
```

## Desenvolver

```bash
npm ci
npm test                       # testes e evals de cada pacote
npm run hostile                # entradas hostis plantadas em cada agente
npm run bench                  # tempos com 1.000 e 10.000 linhas
npm run plugin:check           # arquivos de plugin conferem com os pacotes
npm run intl                   # cada eval de novo com arquivos de outros oito mercados
npm run mcp:check              # cliente oficial do SDK MCP contra cada agente
npm run release:check:offline  # conteúdo dos pacotes, licenças, documentação e versões
```

O workflow de CI roda em Node 20, 22 e 24, no Linux e no Windows.

## Limites

- Cada agente trabalha com os arquivos que você entrega. Nenhum faz login em sistema de administração, banco, portal de anúncios, canal ou órgão público.
- Os formatos de exportação nomeados foram escritos a partir do conhecimento dessas exportações e não foram conferidos em contas reais. Se um cabeçalho for diferente, `inspect` mostra o que foi associado e `keystone-sources.json` permite nomear colunas à mão.
- Os achados valem o que valem esses arquivos. Cada relatório diz o que presumiu.
- Não é assessoria jurídica, fiscal ou contábil, nem avaliação de se um anúncio é permitido. Limites, prazos e regras de taxas vêm dos seus próprios arquivos de política. Pessoas decidem e agem.
