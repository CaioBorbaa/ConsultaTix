# Consulta TIX — Tintomax

Ferramenta web interna da **Tintomax** para consultar, de forma rápida, a **fórmula de colorantes** usada em uma tinta personalizada (TIX) a partir de uma nota fiscal.

---

## Para que serve

Quando um cliente compra uma tinta com cor personalizada, a cor é produzida misturando uma **base** com **colorantes** em quantidades específicas. Essa receita é chamada de fórmula **TIX**.

Muitas vezes o colaborador precisa saber exatamente qual fórmula foi usada em uma venda, por exemplo para:

- **Repetir a mesma cor** quando o cliente volta para comprar mais tinta;
- **Conferir uma produção** em caso de dúvida ou reclamação sobre a cor;
- **Tirar dúvidas no balcão** sem depender de outra pessoa ou setor.

O sistema de gestão usado pela empresa não oferece uma forma simples de pesquisar essas fórmulas diretamente. A Consulta TIX resolve isso: basta informar o **estabelecimento** e o **número da nota**.

## Por que ajuda

- **Rapidez:** a fórmula aparece em segundos, sem navegar por várias telas.
- **Precisão:** cada item da nota é mostrado separadamente, então duas tintas diferentes da mesma nota não se misturam.
- **Autonomia:** qualquer colaborador consegue consultar, sem treinamento técnico.
- **Acesso fácil:** funciona no navegador, no computador ou no celular, e tem modo escuro.

---

## Como usar

1. Abra a página da Consulta TIX.
2. Preencha o **Estabelecimento (Estab)** e o **ID da Nota**.
3. Clique em **Pesquisar TIX** ou aperte **Enter**.

Os campos aceitam apenas números. É possível buscar só pelo estabelecimento, mas o resultado pode trazer muitas fórmulas; para um resultado exato, informe os dois campos.

## Como ler o resultado

Cada **card** representa **um item da nota**, ou seja, uma tinta produzida.

| Elemento | Significado |
|---|---|
| **Título** | Nome da cor |
| **Subtítulo** | Produto e número do item na nota |
| **Badge laranja** | Código TIX da fórmula |
| **Badge da base** | Base usada na tinta (A, B, C...) |
| **Badge de quantidade** (ex.: `3x Galao - 3,2`) | Quantas unidades desse produto constam na nota e qual a embalagem |
| **Linha `(Tinta Base)`** | Representa a base da tinta |
| **Unidade de Tinta** / **Quantidade (ML)** | Dosagem de cada colorante da fórmula |

### A quantidade (`3x`) não multiplica a fórmula

O número antes da embalagem (ex.: **3x** Galao) indica apenas **quantas unidades do produto estão na nota**. Os valores de *Unidade de Tinta* e *Quantidade (ML)* **não são multiplicados** por esse número.

Para evitar dúvidas, ao **passar o mouse, clicar ou tocar** nesse badge aparece um balão com essa explicação.

---

## Tecnologia

- Página estática em **HTML, CSS e JavaScript**, sem necessidade de instalação ou build.
- Os dados são obtidos em tempo real de um serviço interno da empresa.
- Visual responsivo, com modo claro e escuro.

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura da página |
| `script.js` | Busca dos dados e montagem dos resultados |
| `style.css` | Visual e identidade da Tintomax |

---

© 2026 Tintomax. Uso interno.
