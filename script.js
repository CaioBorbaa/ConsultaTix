async function buscarTix() {
    const estab = document.getElementById('estab').value.trim();
    const id_nota = document.getElementById('id_nota').value.trim();
    const divResultado = document.getElementById('resultado');
    const loading = document.getElementById('loading');

    if (!estab && !id_nota) {
        divResultado.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h4>Informe ao menos um campo</h4>
                <p>Preencha o estabelecimento ou ID da nota para pesquisar.</p>
            </div>`;
        divResultado.classList.add('active');
        return;
    }

    let urlParams = [];
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

        if (!resposta.ok) throw new Error('Erro na comunicação com o servidor n8n.');
        
        const textoResposta = await resposta.text();
        
        if (!textoResposta) {
            throw new Error('O servidor não devolveu nenhum dado (resposta vazia).');
        }

        const dados = JSON.parse(textoResposta);
        loading.classList.remove('active');

        if (Array.isArray(dados) && dados.length > 0 && dados[0].ESTAB !== undefined) {

            const grupos = new Map();

            dados.forEach(item => {
                const idFormula = item.IDFORMULA || 'SEM_FORMULA';
                const chave = idFormula;

                const unidadeTinta = (item.UNIDADE_TINTA !== null && item.UNIDADE_TINTA !== undefined) ? item.UNIDADE_TINTA : '-';
                const vlrML = (item.VLRML !== null && item.VLRML !== undefined) ? item.VLRML : '-';
                
                const idCorante = item.IDCORANTE !== null && item.IDCORANTE !== undefined ? item.IDCORANTE : '-';
                const nomeCorante = item.NOME_CORANTE || '';
                const nomeCor = item.NOMECOR || item.NOME_COR || item.COR || '-';
                const produto = item.PRODUTO || '-';
                const base = item.BASE || '-';
                const embalagem = item.EMBTINTA || item.EMBALAGEM || '-';
                
                // NOVO: Lê a coluna CODCATALOGO do banco. Se for nula, usa o fallback TIX.ID
                const codCatalogo = (item.CODCATALOGO && item.CODCATALOGO.trim() !== '') ? item.CODCATALOGO : `TIX.${idFormula}`;

                const chaveUnica = `${item.ESTAB}-${item.IDNOTA}-${item.IDITEM}-${chave}-${idCorante}`;

                if (!grupos.has(chave)) {
                    grupos.set(chave, {
                        idFormula: idFormula,
                        codCatalogo: codCatalogo, // Salva o código correto do banco
                        nomeCor: nomeCor,
                        produto: produto,
                        base: base,
                        embalagem: embalagem,
                        registros: []
                    });
                }

                const grupo = grupos.get(chave);

                if (!grupo.registros.some(r => r.chaveUnica === chaveUnica)) {
                    grupo.registros.push({
                        chaveUnica,
                        estab: item.ESTAB || '-',
                        idNota: item.IDNOTA || '-',
                        nomeCorante: nomeCorante,
                        unidadeTinta: unidadeTinta,
                        vlrML: vlrML
                    });
                }
            });

            let html = `
                <div class="results-header">
                    <h3><i class="fas fa-layer-group" style="color: var(--laranja);"></i> Resultados Encontrados</h3>
                    <span class="results-count">${dados.length} registro(s) em ${grupos.size} tinta(s)</span>
                </div>`;

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

                let baseHtml = grupo.base;
                if (grupo.base && grupo.base.toUpperCase().includes('A')) {
                    baseHtml = `<span class="base-badge base-a">${grupo.base}</span>`;
                } else if (grupo.base && grupo.base.toUpperCase().includes('B')) {
                    baseHtml = `<span class="base-badge base-b">${grupo.base}</span>`;
                } else if (grupo.base && grupo.base.toUpperCase().includes('C')) {
                    baseHtml = `<span class="base-badge base-c">${grupo.base}</span>`;
                }

                html += `
                    <div class="tinta-group">
                        <div class="tinta-group-header">
                            <div class="tinta-group-title">
                                <div class="tix-icon">
                                    <i class="fas fa-palette"></i>
                                </div>
                                <div>
                                    <h4>${grupo.nomeCor !== '-' ? grupo.nomeCor : 'Tinta Personalizada'}</h4>
                                    <span class="tinta-subtitle">${grupo.produto !== '-' ? grupo.produto : ''}</span>
                                </div>
                            </div>
                            <div class="tinta-group-meta">
                                <!-- NOVO: Renderiza o código do catálogo na badge superior -->
                                <span class="tix-badge">${grupo.codCatalogo}</span>
                                <span class="cor-badge">${baseHtml}</span>
                                <span class="produto-badge"><i class="fas fa-box" style="margin-right:4px;"></i>${grupo.embalagem}</span>
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
                    const unidadeBadge = reg.vlrML !== '-' 
                        ? `<span class="qty-badge qty-unidade">${reg.vlrML} un</span>` 
                        : '<span style="color: #A0AEC0;">-</span>';

                    const mlBadge = reg.unidadeTinta !== '-' 
                        ? `<span class="qty-badge qty-ml">${reg.unidadeTinta} ML</span>` 
                        : '<span style="color: #A0AEC0;">-</span>';

                    const coranteDisplay = reg.nomeCorante && reg.nomeCorante.trim() !== '' 
                        ? (reg.nomeCorante === '(Tinta Base)' ? `<strong>${reg.nomeCorante}</strong>` : reg.nomeCorante)
                        : '<em style="color: #A0AEC0; font-size: 0.8rem;">-</em>';

                    html += `
                        <tr>
                            <!-- NOVO: Renderiza o código do catálogo em cada linha da tabela -->
                            <td class="tix-cell">${grupo.codCatalogo}</td>
                            <td>${reg.estab}</td>
                            <td>${reg.idNota}</td>
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
            divResultado.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>Nenhum resultado encontrado</h4>
                    <p>Nenhuma fórmula ou corante foi encontrado para os dados informados.</p>
                </div>`;
            divResultado.classList.add('active');
        }

    } catch (erro) {
        loading.classList.remove('active');
        divResultado.innerHTML = `
            <div class="error-state">
                <i class="fas fa-times-circle"></i>
                <p>Erro: ${erro.message}</p>
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