# Consulta TIX — Tintomax

Página web interna para consultar a **fórmula de colorantes** de uma tinta personalizada (TIX) a partir do **estabelecimento** e do **ID da nota**.

Ela existe porque o ERP (**VIASOFT Construshow**) não permite pesquisar cores pigmentadas diretamente. Com a Consulta TIX, o colaborador informa a nota e vê na hora quais colorantes e quantidades foram usados em cada lata.

---

## Sumário

- [Como usar](#como-usar)
- [Como ler o resultado](#como-ler-o-resultado)
- [Arquitetura](#arquitetura)
- [Estrutura dos arquivos](#estrutura-dos-arquivos)
- [Dados retornados pelo webhook](#dados-retornados-pelo-webhook)
- [Regras de negócio do front-end](#regras-de-negócio-do-front-end)
- [Modo diagnóstico (`?debug=1`)](#modo-diagnóstico-debug1)
- [Publicação no cPanel](#publicação-no-cpanel)
- [Histórico de problemas e lições aprendidas](#histórico-de-problemas-e-lições-aprendidas)
- [Checklist para futuras alterações](#checklist-para-futuras-alterações)

---

## Como usar

1. Abra a página da Consulta TIX.
2. Preencha **Estabelecimento (Estab)**, por exemplo `1002`, e **ID da Nota**, por exemplo `87860`.
3. Clique em **Pesquisar TIX** ou aperte **Enter** em qualquer campo.

Observações:

- Os campos aceitam **apenas números**. Letras e espaços são removidos automaticamente, e a página avisa quando isso acontece.
- É possível buscar só pelo estabelecimento, mas o resultado pode trazer muitas fórmulas. Para um resultado exato, informe **os dois campos**.
- O botão de lua/sol no topo alterna o **modo escuro**. A preferência fica salva no navegador (`localStorage`, chave `tintomax-theme`).

---

## Como ler o resultado

Cada **card** representa **um item da nota** (uma dosagem física), e não a nota inteira. Exemplo (ESTAB `1002`, nota `87860`): o card tem o título `LKS0661 DUNHILL TIX.1002.36690 · Item 1`, os badges `TIX.1002.36690`, `A2` e `3x Galao - 3,2`, e uma tabela com a linha `(Tinta Base)` seguida dos colorantes `CLS111` (51.33 un / 7.91 ML), `CLS114` (7.49 un / 1.15 ML) e `CLS116` (79.40 un / 12.23 ML).

| Elemento | Significado |
|---|---|
| **Título** | Nome da cor (ex.: `LKS0661 DUNHILL TIX.1002.36690`) |
| **Subtítulo** | Produto e número do item na nota (`· Item 1`) |
| **Badge laranja** | Código TIX da fórmula |
| **Badge da base** | Base da tinta (A, B, C...), com cor diferente para cada base |
| **Badge `3x Galao - 3,2`** | **Quantidade de unidades desse produto na nota** + embalagem |
| **Linha `(Tinta Base)`** | Representa a base; não tem valores de colorante |
| **Unidade de Tinta** / **Quantidade (ML)** | Dosagem de cada colorante |

### Importante: a quantidade (`3x`) não multiplica a fórmula

O número antes da embalagem (ex.: **3x** Galao) mostra apenas **quantas unidades do produto constam na nota**. Ele é **só informativo**: os valores de *Unidade de Tinta* e *Quantidade (ML)* da tabela **não são multiplicados** por esse número.

Muitos colaboradores entendiam o contrário. Por isso, desde a versão `1.6`, **passar o mouse, clicar ou tocar** no badge mostra um balão com essa explicação (o ícone ⓘ indica que o balão existe). Para fechar, clique fora ou aperte **Esc**.

---

## Arquitetura

```
┌──────────────┐   GET ?estab=&id_nota=   ┌─────────────────┐   SQL   ┌──────────────────────────┐
│  Navegador   │ ───────────────────────▶ │  Webhook n8n    │ ──────▶ │  Oracle – VIASOFTMCP     │
│ (index.html) │ ◀─────────────────────── │ (n8n.tintomax)  │ ◀────── │  NOTACONSUMO / CORANTE / │
└──────────────┘        JSON (linhas)     └─────────────────┘         │  NOTAITEMCP              │
                                                                       └──────────────────────────┘
```

- **Front-end:** HTML, CSS e JavaScript puros, **sem build e sem dependências** instaladas. Os únicos recursos externos são a fonte Poppins (Google Fonts), os ícones Font Awesome 6.5 (cdnjs) e o logo da Tintomax.
- **Back-end:** um **workflow no n8n** recebe a chamada e executa uma consulta SQL no banco **Oracle** do VIASOFT (schema `VIASOFTMCP`, tabela `NOTACONSUMO` com joins em `CORANTE` e `NOTAITEMCP`).
- **Endpoint** (definido em `script.js`):
  ```
  https://n8n.tintomax.com.br/webhook/16937276-8a3e-4150-aa4c-f26299a772e1?estab=<ESTAB>&id_nota=<ID_NOTA>
  ```

> ⚠️ **A consulta SQL não está neste repositório.** Ela existe apenas dentro do workflow do n8n. Qualquer problema de *dados* (valores divergentes do VIASOFT, itens misturados, etc.) precisa ser analisado **junto com o texto atual da query no n8n**. Não parta do princípio de que o front-end está errado.

---

## Estrutura dos arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura da página: cabeçalho, filtros de busca, área de carregamento e área de resultados. Carrega `style.css` e `script.js` com **parâmetro de versão** (`?v=1.6`) para evitar cache. |
| `script.js` | Toda a lógica: validação dos campos, chamada ao webhook, agrupamento dos dados, montagem dos cards, tooltip da quantidade e modo escuro. |
| `style.css` | Identidade visual Tintomax (laranja `#F26522` / azul `#003DA5`), modo escuro (`.dark-mode`), responsividade e estilos do tooltip. |
| `README.md` | Esta documentação. |

---

## Dados retornados pelo webhook

O webhook devolve um **array JSON**, com **uma linha por colorante por item da nota**. Campos usados pelo front-end:

| Campo | Uso |
|---|---|
| `ESTAB`, `IDNOTA` | Exibidos na tabela. A presença de `ESTAB` na 1ª linha indica que houve resultado. |
| `IDFORMULA` | Identifica a fórmula (parte da chave do card). |
| `SEQITEM` | **Sequência do item na nota**, que separa itens diferentes da mesma nota (parte da chave do card). |
| `IDITEM` | **Código do produto** (não é a sequência!). Usado só como alternativa se `SEQITEM` não vier. |
| `IDCORANTE`, `NOME_CORANTE` | Identificação do colorante. `(Tinta Base)` = linha da base. |
| `UNIDADE_TINTA` | Exibido na coluna **Quantidade (ML)**. |
| `VLRML` | Exibido na coluna **Unidade de Tinta**. |
| `QTD_LATAS` | Quantidade de unidades do produto na nota (o `3x` do badge). Padrão `1`. |
| `NOMECOR` / `NOME_COR` / `COR` | Nome da cor (título do card). |
| `PRODUTO` | Descrição do produto (subtítulo). |
| `CODCATALOGO` | Código TIX. |
| `BASE` | Base da tinta. |
| `EMBTINTA` / `EMBALAGEM` | Embalagem (ex.: `Galao - 3,2`). |
| `COMPLEMENTO` | Texto livre do item, usado como alternativa para base, embalagem, TIX e nome da cor. |

> ⚠️ **Atenção aos nomes trocados:** a coluna *Unidade de Tinta* mostra o campo `VLRML`, e a coluna *Quantidade (ML)* mostra o campo `UNIDADE_TINTA`. Os nomes dos campos da SQL não batem com o significado exibido, e **o front-end compensa isso de propósito**. Não "corrija" um lado sem alterar o outro.

---

## Regras de negócio do front-end

As regras abaixo estão documentadas também no cabeçalho de `script.js`.

1. **Um card por item da nota.** Os dados são agrupados pela chave `IDFORMULA + SEQITEM`. Uma nota pode ter **dois itens com o mesmo TIX e quantidades diferentes** (ex.: 9 latas + 3 latas); cada um é uma dosagem física separada e vira seu próprio card.
   - Se `SEQITEM` não vier na resposta, o agrupamento usa `IDITEM`. Nesse caso, dois itens do mesmo produto **voltam a ser misturados**, o que indica que a query do n8n perdeu o `SEQITEM`.
2. **Soma apenas dentro do mesmo item.** Se o mesmo colorante aparecer mais de uma vez **no mesmo card**, os valores são somados (frações reais da mesma dosagem). Nunca se soma entre itens ou notas diferentes.
3. **Leitura tolerante de números.** Aceita `1.234,56`, `1234,56`, `1234.56` e números puros. Os valores são exibidos com 2 casas decimais e ponto como separador.
4. **Busca por informações alternativas** quando o campo principal vem vazio:
   - **Base:** `BASE` → `Base: ...` no `COMPLEMENTO` → `BASE X` no nome do produto.
   - **Embalagem:** `EMBTINTA`/`EMBALAGEM` → `Emb: ...` no `COMPLEMENTO`. A embalagem `810 - 0,81` é exibida como **`Litrinho - 0,8`**.
   - **Código TIX:** `CODCATALOGO` → padrão `TIX.xxxx.xxxxx` no nome da cor, no complemento ou no produto → `PERSONALIZADA`.
   - **Nome da cor:** `NOMECOR` → primeiro trecho do `COMPLEMENTO` → `Tinta Personalizada`.
5. **Segurança.** Os campos aceitam só dígitos, e todo dado vindo do banco passa por `escapeHtml` antes de ir para a tela.

---

## Modo diagnóstico (`?debug=1`)

Adicione `?debug=1` ao endereço da página, por exemplo:

```
https://<endereço-da-consulta-tix>/index.html?debug=1
```

A página passa a exibir, acima dos resultados, uma caixa recolhível com o **JSON cru devolvido pelo webhook** e a quantidade de linhas.

**Use esse modo primeiro** sempre que um valor não bater com o VIASOFT: compare o JSON com a tela do ERP antes de alterar qualquer código.

---

## Publicação no cPanel

O site é publicado **manualmente** no cPanel; não há deploy automático a partir do GitHub.

1. Faça as alterações e o commit no repositório.
2. **Aumente a versão** dos arquivos no `index.html` (ex.: `?v=1.6` → `?v=1.7`) nas duas linhas:
   ```html
   <link rel="stylesheet" href="style.css?v=1.7">
   <script src="script.js?v=1.7"></script>
   ```
   Sem isso, o navegador dos colaboradores pode continuar usando o CSS/JS antigo.
3. No cPanel → **Gerenciador de Arquivos**, atualize `index.html`, `script.js` e `style.css`:
   - **Opção A:** botão direito no arquivo → **Edit** → `Ctrl+A` → colar o conteúdo novo → **Save Changes**.
   - **Opção B:** botão **Upload** e envie os arquivos, substituindo os existentes.
4. Abra a página, aperte **Ctrl+F5** e faça uma consulta de teste.

---

## Histórico de problemas e lições aprendidas

### Divergência de quantidade com 2 itens do mesmo TIX na nota (set/2026)

- **Sintoma:** para algumas notas, as quantidades exibidas não batiam com o VIASOFT. Por exemplo, a tela sempre mostrava `9x LATA` quando a nota tinha um item de 9 latas **e** outro de 3 latas com a mesma fórmula.
- **Causa:** a SQL do n8n calculava `UNIDADE_TINTA`, `VLRML` e `QTD_LATAS` com `PARTITION BY ESTAB, IDNOTA, IDFORMULA`, **sem o item da nota**. Os dois itens eram fundidos em um só, e o `MAX` sempre escolhia a maior quantidade de latas.
  - `IDITEM` **não resolve**: ele é o código do produto e é igual nos dois itens.
  - `SEQITEM` é o que realmente diferencia os itens.
- **Correção:**
  - **SQL (n8n):** `nc.SEQITEM` adicionado ao `SELECT` e às duas cláusulas `PARTITION BY`.
  - **Front-end:** cards agrupados por `IDFORMULA + SEQITEM`, com o rótulo `· Item N`.
- **Validação:** ESTAB `1013` / ID Nota `72584` (9 latas) conferiu exatamente com o VIASOFT:
  `CLS101 257,94 / 39,72`, `CLS103 466,03 / 71,77`, `CLS116 2.350,08 / 361,91`.
- **Lições:**
  - Duas tentativas anteriores de correção só no front-end estavam erradas e foram revertidas. A primeira somava colorantes iguais entre itens diferentes, o que misturava dosagens. A segunda criava uma tabela "por linha" com subtotais, que deixou a tela confusa.
  - **Não crie lógica de soma ou agregação sem antes ver o JSON real** (`?debug=1`) ou um print do ERP. Os dados desse webhook têm formatos com várias linhas por colorante que não dá para deduzir pelos nomes dos campos.
  - Se a reclamação *"as quantidades não batem com o VIASOFT"* voltar, é muito provável que seja uma nota com vários itens desse mesmo tipo.

### Colaboradores achavam que a fórmula era multiplicada pela quantidade (set/2026)

- **Sintoma:** ao ver `3x Galao`, os colaboradores achavam que os colorantes da tabela já estavam multiplicados por 3.
- **Correção:** o badge da quantidade virou um gatilho de tooltip (mouse, clique ou toque) explicando que o número é só a quantidade de unidades na nota e **não altera** *Unidade de Tinta* nem *Quantidade (ML)*. Versão dos arquivos atualizada para `1.6`.

---

## Checklist para futuras alterações

- [ ] Problema de **dados**? Use `?debug=1` e peça o texto atual da query no n8n antes de mexer no código.
- [ ] Confira o resultado com um **print do VIASOFT** da mesma nota.
- [ ] Aumente o `?v=` no `index.html` antes de publicar.
- [ ] Teste no **modo claro e no escuro** e em uma tela de celular.
- [ ] Publique os três arquivos no cPanel e teste com `Ctrl+F5`.
