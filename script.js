// =====================================================================
//  CONSULTA TIX - Tintomax
//  Regras de segurança / acertividade:
//   1. Cada card representa UM item/dosagem da nota (SEQITEM), não a nota inteira -
//      evita misturar 2 latagens diferentes que usam a mesma fórmula/TIX
//   2. Soma silenciosa só entre linhas do MESMO item (fração real de dosagem)
//   3. Parsing numérico tolerante a vírgula/ponto
//   4. Modo diagnóstico ?debug=1 -> mostra o JSON cru do webhook
//   5. Sanitização das entradas (estab / id_nota apenas dígitos)
//   6. escapeHtml em todo dado vindo do banco (vai para innerHTML)
// =====================================================================

// ---------- UTILIDADES ----------

// Escapa HTML para impedir quebra de layout / injeção ao usar innerHTML
function escapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Converte texto/numero do banco em Number, tolerando "1.234,56", "1234,56",
// "1234.56", 1234.56, null, "-", "". Retorna null quando nao ha numero.
function parseNum(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return isFinite(valor) ? valor : null;

    let s = String(valor).trim();
    if (s === '' || s === '-') return null;

    if (s.indexOf(',') > -1) {
        // formato pt-BR: ponto = separador de milhar, virgula = decimal
        s = s.replace(/\./g, '').replace(',', '.');
    }
    s = s.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
}

// Formata numero para exibicao - mesmo padrao (ponto decimal, sem milhar) que a SQL ja manda
function fmtNum(n) {
    if (n === null || n === undefined || !isFinite(n)) return '-';
    return n.toFixed(2);
}

// Mantem apenas digitos (estab e id_nota sao sempre numericos no VIASOFT)
function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
}

// Extrai a letra da base ("BASE C 3 EM 1" -> "C", "C" -> "C")
function extrairLetraBase(base) {
    if (!base || base === '-') return null;
    const s = String(base).toUpperCase().trim();
    let m = s.match(/BASE\s+([A-D])\b/);
    if (m) return m[1];
    m = s.match(/^([A-D])$/);
    if (m) return m[1];
    return null;
}

const DEBUG_ATIVO = new URLSearchParams(window.location.search).has('debug');


// ---------- BUSCA ----------

async function buscarTix() {
    const inputEstab = document.getElementById('estab');
    const inputNota = document.getElementById('id_nota');
    const divResultado = document.getElementById('resultado');
    const loading = document.getElementById('loading');

    const estabRaw = inputEstab.value.trim();
    const idNotaRaw = inputNota.value.trim();
    const estab = somenteDigitos(estabRaw);
    const id_nota = somenteDigitos(idNotaRaw);

    // devolve o valor higienizado para o campo (remove letras/espacos digitados por engano)
    inputEstab.value = estab;
    inputNota.value = id_nota;

    if (!estab && !id_nota) {
        divResultado.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h4>Informe ao menos um campo</h4>
                <p>Preencha o estabelecimento ou o ID da nota para pesquisar.</p>
            </div>`;
        divResultado.classList.add('active');
        return;
    }

    let avisoBusca = '';
    if ((estabRaw && estabRaw !== estab) || (idNotaRaw && idNotaRaw !== id_nota)) {
        avisoBusca = 'Os campos aceitam apenas numeros - os caracteres invalidos foram removidos automaticamente.';
    } else if (estab && !id_nota) {
        avisoBusca = 'Busca somente por estabelecimento pode trazer muitas formulas. Informe tambem o ID da Nota para um resultado exato.';
    }

    const urlParams = [];
    if (estab) urlParams.push(`estab=${encodeURIComponent(estab)}`);
    if (id_nota) urlParams.push(`id_nota=${encodeURIComponent(id_nota)}`);

    const webhookBaseUrl = 'https://n8n.tintomax.com.br/webhook/16937276-8a3e-4150-aa4c-f26299a772e1';
    const webhookUrl = `${webhookBaseUrl}?${urlParams.join('&')}`;

    divResultado.classList.remove('active');
    divResultado.innerHTML = '';
    loading.classList.add('active');

    try {
        const resposta = await fetch(webhookUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!resposta.ok) throw new Error('Erro na comunicacao com o servidor n8n.');

        const textoResposta = await resposta.text();
        if (!textoResposta) {
            throw new Error('O servidor nao devolveu nenhum dado (resposta vazia).');
        }

        const dados = JSON.parse(textoResposta);
        loading.classList.remove('active');

        const debugHtml = DEBUG_ATIVO
            ? `<details class="debug-box">
                   <summary><i class="fas fa-bug"></i> JSON cru do webhook (${Array.isArray(dados) ? dados.length : 0} linha(s))</summary>
                   <pre>${escapeHtml(JSON.stringify(dados, null, 2))}</pre>
               </details>`
            : '';

        if (Array.isArray(dados) && dados.length > 0 && dados[0].ESTAB !== undefined) {

            // ===== AGRUPAR POR ITEM DA NOTA (SEQITEM) + FORMULA =====
            // Uma nota pode ter 2 linhas com o MESMO produto/TIX e quantidades
            // diferentes (ex.: 9 latas + 3 latas). Cada uma e uma dosagem fisica
            // separada, entao cada uma vira o seu proprio card.
            const grupos = new Map();

            dados.forEach(item => {
                const idFormula = item.IDFORMULA || 'SEM_FORMULA';

                // SEQITEM identifica o item/linha da nota. Se a query ainda nao
                // devolver esse campo, cai para IDITEM (pode nao separar 2 linhas
                // do mesmo produto - nesse caso avise no n8n para expor SEQITEM).
                const seqItem = (item.SEQITEM !== null && item.SEQITEM !== undefined) ? item.SEQITEM
                    : (item.IDITEM !== null && item.IDITEM !== undefined ? item.IDITEM : '');

                const chave = `${idFormula}::${seqItem}`;

                const idCorante = (item.IDCORANTE !== null && item.IDCORANTE !== undefined) ? item.IDCORANTE : '-';
                const nomeCorante = item.NOME_CORANTE || '';
                const nomeCor = item.NOMECOR || item.NOME_COR || item.COR || '-';
                const produto = item.PRODUTO || '-';
                const complemento = item.COMPLEMENTO || '';

                // === CACADOR DE BASE ===
                let base = item.BASE || '-';
                if ((base === '-' || base === '') && complemento !== '') {
                    const matchBase = complemento.match(/Base:\s*([^|]+)/i);
                    if (matchBase) base = matchBase[1].trim();
                }
                // fallback: extrai "BASE X" do nome do produto
                if (base === '-' || base === '') {
                    const matchProdBase = String(produto).match(/\bBASE\s+([A-D])\b/i);
                    if (matchProdBase) base = 'BASE ' + matchProdBase[1].toUpperCase();
                }

                // === CACADOR DE EMBALAGEM ===
                let embalagem = item.EMBTINTA || item.EMBALAGEM || '-';
                if ((embalagem === '-' || embalagem === '') && complemento !== '') {
                    const matchEmb = complemento.match(/Emb:\s*([^|]+)/i);
                    if (matchEmb) embalagem = matchEmb[1].trim();
                }
                if (typeof embalagem === 'string' && embalagem.includes('810 - 0,81')) {
                    embalagem = 'Litrinho - 0,8';
                }

                // === CACADOR DE CODIGO TIX ===
                let codCatalogo = '';
                if (item.CODCATALOGO && String(item.CODCATALOGO).trim() !== '') {
                    codCatalogo = String(item.CODCATALOGO).trim();
                } else {
                    const regexTix = /TIX\.[0-9.]+/i;
                    const matchCor = String(nomeCor).match(regexTix);
                    const matchProduto = String(produto).match(regexTix);
                    const matchComplemento = String(complemento).match(regexTix);
                    if (matchCor) codCatalogo = matchCor[0].toUpperCase();
                    else if (matchComplemento) codCatalogo = matchComplemento[0].toUpperCase();
                    else if (matchProduto) codCatalogo = matchProduto[0].toUpperCase();
                    else codCatalogo = 'PERSONALIZADA';
                }

                // === NOME DA COR ===
                let displayNomeCor = nomeCor !== '-' ? nomeCor : 'Tinta Personalizada';
                if (displayNomeCor === 'Tinta Personalizada' && complemento !== '') {
                    const partes = complemento.split('|');
                    if (partes.length > 0) displayNomeCor = partes[0].trim();
                }

                const qtdLatas = item.QTD_LATAS || 1;

                if (!grupos.has(chave)) {
                    grupos.set(chave, {
                        idFormula: idFormula,
                        seqItem: seqItem,
                        codCatalogo: codCatalogo,
                        nomeCor: displayNomeCor,
                        produto: produto,
                        base: base,
                        embalagem: embalagem,
                        qtdLatas: qtdLatas,
                        registros: []
                    });
                }

                const grupo = grupos.get(chave);

                const ut = parseNum(item.UNIDADE_TINTA);
                const vm = parseNum(item.VLRML);

                // soma silenciosa apenas entre linhas do MESMO corante dentro do MESMO item/dosagem
                const existente = grupo.registros.find(r => r.idCorante === idCorante && r.nomeCorante === nomeCorante);
                if (existente) {
                    if (ut !== null) existente.unidadeTinta = (existente.unidadeTinta || 0) + ut;
                    if (vm !== null) existente.vlrML = (existente.vlrML || 0) + vm;
                } else {
                    grupo.registros.push({
                        idCorante,
                        estab: item.ESTAB || '-',
                        idNota: item.IDNOTA || '-',
                        nomeCorante: nomeCorante,
                        unidadeTinta: ut,
                        vlrML: vm
                    });
                }
            });

            let html = `
                <div class="results-header">
                    <h3><i class="fas fa-layer-group" style="color: var(--laranja);"></i> Resultados Encontrados</h3>
                </div>`;

            html += debugHtml;

            if (avisoBusca) {
                html += `<div class="aviso-box"><i class="fas fa-info-circle"></i> ${escapeHtml(avisoBusca)}</div>`;
            }

            let groupIndex = 0;
            grupos.forEach((grupo) => {
                if (groupIndex > 0) {
                    html += `
                        <div class="tinta-separator">
                            <div class="sep-line"></div>
                            <i class="fas fa-paint-roller sep-icon"></i>
                            <div class="sep-line"></div>
                        </div>`;
                }

                const letraBase = extrairLetraBase(grupo.base);
                let baseHtml;
                if (letraBase) {
                    const cls = letraBase === 'A' ? 'base-a' : letraBase === 'B' ? 'base-b' : 'base-c';
                    baseHtml = `<span class="base-badge ${cls}">${escapeHtml(grupo.base)}</span>`;
                } else if (grupo.base === '-' || grupo.base === '') {
                    baseHtml = `<span class="base-badge">Sem base</span>`;
                } else {
                    baseHtml = `<span class="base-badge">${escapeHtml(grupo.base)}</span>`;
                }

                const subtitulo = grupo.produto !== '-' ? escapeHtml(grupo.produto) : '';
                const itemLabel = grupo.seqItem !== '' && grupo.seqItem !== undefined && grupo.seqItem !== null
                    ? ` &middot; Item ${escapeHtml(String(grupo.seqItem))}`
                    : '';

                html += `
                    <div class="tinta-group">
                        <div class="tinta-group-header">
                            <div class="tinta-group-title">
                                <div class="tix-icon">
                                    <i class="fas fa-palette"></i>
                                </div>
                                <div>
                                    <h4>${escapeHtml(grupo.nomeCor)}</h4>
                                    <span class="tinta-subtitle">${subtitulo}${itemLabel}</span>
                                </div>
                            </div>
                            <div class="tinta-group-meta">
                                <span class="tix-badge">${escapeHtml(grupo.codCatalogo)}</span>
                                <span class="cor-badge">${baseHtml}</span>
                                <span class="produto-badge"><i class="fas fa-box" style="margin-right:4px;"></i>${escapeHtml(String(grupo.qtdLatas))}x ${escapeHtml(grupo.embalagem)}</span>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>TIX</th>
                                        <th>Estab</th>
                                        <th>ID Nota</th>
                                        <th>Nome Corante</th>
                                        <th>Unidade de Tinta</th>
                                        <th>Quantidade (ML)</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                grupo.registros.forEach(reg => {
                    const unidadeBadge = reg.vlrML !== null
                        ? `<span class="qty-badge qty-unidade">${fmtNum(reg.vlrML)} un</span>`
                        : '<span style="color: #A0AEC0;">-</span>';

                    const mlBadge = (reg.nomeCorante !== '(Tinta Base)' && reg.unidadeTinta !== null)
                        ? `<span class="qty-badge qty-ml">${fmtNum(reg.unidadeTinta)} ML</span>`
                        : '<span style="color: #A0AEC0;">-</span>';

                    const nomeSeguro = escapeHtml(reg.nomeCorante);
                    const coranteDisplay = reg.nomeCorante && reg.nomeCorante.trim() !== ''
                        ? (reg.nomeCorante === '(Tinta Base)' ? `<strong>${nomeSeguro}</strong>` : nomeSeguro)
                        : '<em style="color: #A0AEC0; font-size: 0.8rem;">-</em>';

                    html += `
                        <tr>
                            <td class="tix-cell">${escapeHtml(grupo.codCatalogo)}</td>
                            <td>${escapeHtml(String(reg.estab))}</td>
                            <td>${escapeHtml(String(reg.idNota))}</td>
                            <td>${coranteDisplay}</td>
                            <td>${unidadeBadge}</td>
                            <td>${mlBadge}</td>
                        </tr>`;
                });

                html += `</tbody></table></div></div>`;
                groupIndex++;
            });

            divResultado.innerHTML = html;
            divResultado.classList.add('active');
        } else {
            divResultado.innerHTML = debugHtml + `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>Nenhum resultado encontrado</h4>
                    <p>Nenhuma formula ou corante foi encontrado para os dados informados.</p>
                </div>`;
            divResultado.classList.add('active');
        }

    } catch (erro) {
        loading.classList.remove('active');
        divResultado.innerHTML = `
            <div class="error-state">
                <i class="fas fa-times-circle"></i>
                <p>Erro: ${escapeHtml(erro.message)}</p>
            </div>`;
        divResultado.classList.add('active');
    }
}

// ===== DARK MODE =====
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('tintomax-theme');
    const body = document.body;
    const icon = document.getElementById('themeIcon');

    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if (icon) icon.className = 'fas fa-sun';
    }

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            const isDark = body.classList.toggle('dark-mode');
            if (isDark) {
                icon.className = 'fas fa-sun';
                localStorage.setItem('tintomax-theme', 'dark');
            } else {
                icon.className = 'fas fa-moon';
                localStorage.setItem('tintomax-theme', 'light');
            }
        });
    }

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') buscarTix();
        });
    });
});
