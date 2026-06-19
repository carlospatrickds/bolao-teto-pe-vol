/**
 * BOLÃO TETO-PE - Script Principal
 * Lógica de processamento de dados e renderização da interface
 */

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTqRYCxqqTeJLzCpTWOy9CAN_Dh8pWyQquoWLDeCtT8ThDgt4kqi40F5tEXnbAwEVqnzC01MZbOHqT/pub?gid=1254969741&single=true&output=csv';

let appData = {
    headers: [],
    rows: []
};

let charts = {};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function extrairResultadoReal(nomeColuna) {
    const regex = /(\d+x\d+)/;
    const match = nomeColuna.match(regex);
    return match ? match[1] : null;
}

function normalizarPalpite(palpite) {
    if (!palpite || palpite === '-') return null;
    const regex = /(\d+x\d+)/;
    const match = palpite.match(regex);
    return match ? match[1] : null;
}

// ✅ NOVA FUNÇÃO: Extrai times e placar de um palpite
// Ex: "Uruguai 3x0 Arábia Saudita" → {timeCasa: "Uruguai", golsCasa: 3, golsFora: 0, timeFora: "Arábia Saudita"}
function parsePalpite(palpite) {
    if (!palpite || palpite === '-') return null;
    
    // Tenta extrair: TimeA XxY TimeB
    const regex = /(.+?)\s+(\d+)x(\d+)\s+(.+)/i;
    const match = palpite.match(regex);
    
    if (match) {
        return {
            timeCasa: match[1].trim(),
            golsCasa: parseInt(match[2]),
            golsFora: parseInt(match[3]),
            timeFora: match[4].trim()
        };
    }
    return null;
}

// ✅ NOVA FUNÇÃO: Determina o resultado (casa/empate/fora)
function determinarResultado(golsCasa, golsFora) {
    if (golsCasa > golsFora) return 'casa';
    if (golsCasa < golsFora) return 'fora';
    return 'empate';
}

// ✅ NOVA FUNÇÃO: Calcula pontos de um único palpite
function calcularPontosPalpite(palpiteUsuario, resultadoReal) {
    const palpiteParseado = parsePalpite(palpiteUsuario);
    const realParseado = parsePalpite(resultadoReal);
    
    if (!palpiteParseado || !realParseado) return 0;
    
    let pontos = 0;
    let detalhes = [];
    
    // Verifica se acertou o placar exato
    if (palpiteParseado.golsCasa === realParseado.golsCasa && 
        palpiteParseado.golsFora === realParseado.golsFora) {
        pontos += 3;
        detalhes.push('🎯 Placar exato (+3 pts)');
    } else {
        // Verifica se acertou o resultado (casa/empate/fora)
        const resultadoPalpite = determinarResultado(palpiteParseado.golsCasa, palpiteParseado.golsFora);
        const resultadoRealFinal = determinarResultado(realParseado.golsCasa, realParseado.golsFora);
        
        if (resultadoPalpite === resultadoRealFinal) {
            pontos += 1;
            detalhes.push('✅ Acertou o vencedor (+1 pt)');
        } else {
            detalhes.push('❌ Errou o resultado');
        }
    }
    
    return { pontos, detalhes };
}

// ✅ NOVA FUNÇÃO: Calcula total de pontos e exatos de um usuário
function calcularPontuacaoCompleta(usuario) {
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    const gamesHeaders = appData.headers.slice(ptsIndex + 1);
    
    let totalPontos = 0;
    let totalExatos = 0;
    let jogosDisputados = 0;
    const detalhesPorJogo = {};
    
    gamesHeaders.forEach(header => {
        const palpite = usuario[header];
        if (palpite && palpite !== '-' && palpite.trim() !== '') {
            jogosDisputados++;
            
            const resultadoReal = extrairResultadoReal(header);
            // Reconstrói o cabeçalho completo para comparação
            const resultadoCompleto = header; 
            
            const { pontos, detalhes } = calcularPontosPalpite(palpite, resultadoCompleto);
            
            totalPontos += pontos;
            detalhesPorJogo[header] = { palpite, pontos, detalhes };
            
            if (pontos >= 3) totalExatos++;
        }
    });
    
    return {
        totalPontos,
        totalExatos,
        jogosDisputados,
        detalhesPorJogo
    };
}

function calcularPlacaresExatos(usuario) {
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    const gamesHeaders = appData.headers.slice(ptsIndex + 1);
    let exatos = 0;
    
    gamesHeaders.forEach(header => {
        const resultadoReal = extrairResultadoReal(header);
        const palpiteUsuario = normalizarPalpite(usuario[header]);
        
        if (resultadoReal && palpiteUsuario && resultadoReal === palpiteUsuario) {
            exatos++;
        }
    });
    
    return exatos;
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupTabs();
    setupEventListeners();
    fetchData();
});

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    const icon = toggleBtn.querySelector('i');
    toggleBtn.addEventListener('click', () => {
        const body = document.documentElement;
        if (body.getAttribute('data-theme') === 'light') {
            body.setAttribute('data-theme', 'dark');
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            body.setAttribute('data-theme', 'light');
            icon.classList.replace('fa-sun', 'fa-moon');
        }
        renderCharts(); 
    });
}

function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'estatisticas') renderCharts();
        });
    });
}

async function fetchData() {
    try {
        const separator = SHEET_URL.includes('?') ? '&' : '?';
        const finalUrl = `${SHEET_URL}${separator}nocache=${new Date().getTime()}`;
        const response = await fetch(finalUrl);
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

        const csvText = await response.text();
        parseCSV(csvText);
        
        renderClassification();
        renderTop3();
        renderDesempateDetalhes();
        renderPredictions();
        updateGlobalStats();
        popularSelectParticipantes();
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

function parseCSV(csv) {
    const lines = csv.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (lines.length === 0) return;

    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('participante')) {
            headerIndex = i;
            break;
        }
    }
    if (headerIndex === -1) headerIndex = 0;

    appData.headers = lines[headerIndex].split(',').map(h => h.replace(/\r|"/g, '').trim());
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante')) || appData.headers[1];
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto')) || appData.headers[2];
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    const gamesHeaders = appData.headers.slice(ptsIndex + 1);

    let rawRows = lines.slice(headerIndex + 1).map(line => {
        const values = line.split(',').map(v => v.replace(/\r|"/g, '').trim());
        let rowData = {};
        appData.headers.forEach((header, index) => { rowData[header] = values[index] || '-'; });
        
        let participacoes = 0;
        gamesHeaders.forEach(game => {
            if (rowData[game] && rowData[game] !== '-' && rowData[game].trim() !== '') participacoes++;
        });
        rowData['_participacoes'] = participacoes;
        
        // ✅ CALCULA PONTOS AUTOMATICAMENTE!
        const pontuacao = calcularPontuacaoCompleta(rowData);
        rowData['_pontosCalculados'] = pontuacao.totalPontos;
        rowData['_vitorias'] = pontuacao.totalExatos;
        rowData['_detalhesPontuacao'] = pontuacao.detalhesPorJogo;
        
        return rowData;
    });

    appData.rows = rawRows.filter(row => {
        const nome = row[partKey];
        const pontosRaiz = row[ptsKey];
        if (!nome || nome === '-' || nome.toLowerCase() === 'participante' || nome.trim() === '') return false;
        return !isNaN(parseInt(pontosRaiz));
    });

    // Ordenação com Critérios de Desempate (usa pontos calculados)
    appData.rows.sort((a, b) => {
        const pA = a['_pontosCalculados'] || 0, pB = b['_pontosCalculados'] || 0;
        if (pB !== pA) return pB - pA;
        
        const vA = a['_vitorias'] || 0, vB = b['_vitorias'] || 0;
        if (vB !== vA) return vB - vA;
        
        const paA = a['_participacoes'] || 0, paB = b['_participacoes'] || 0;
        if (paB !== paA) return paB - paA;
        
        return a[partKey].localeCompare(b[partKey]);
    });

    if (appData.rows.length > 0) {
        let currentRank = 1;
        appData.rows[0]._rank = 1;
        for (let i = 1; i < appData.rows.length; i++) {
            const prev = appData.rows[i - 1], curr = appData.rows[i];
            const samePts = (prev['_pontosCalculados'] || 0) === (curr['_pontosCalculados'] || 0);
            const sameVit = (prev['_vitorias'] || 0) === (curr['_vitorias'] || 0);
            const samePart = prev['_participacoes'] === curr['_participacoes'];
            
            if (samePts && sameVit && samePart) curr._rank = currentRank;
            else { currentRank++; curr._rank = currentRank; }
        }
    }
}

function renderClassification(filterText = '') {
    const tbody = document.querySelector('#table-classificacao tbody');
    tbody.innerHTML = '';
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));

    appData.rows.filter(r => r[partKey].toLowerCase().includes(filterText.toLowerCase())).forEach(row => {
        let displayRank = row._rank;
        if (row._rank === 1) displayRank = '🥇';
        else if (row._rank === 2) displayRank = '🥈';
        else if (row._rank === 3) displayRank = '🥉';
        
        // ✅ USA PONTOS CALCULADOS
        const pontos = row['_pontosCalculados'] || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${displayRank}</td><td class="highlight">${row[partKey]}</td><td><strong>${pontos}</strong></td>`;
        tbody.appendChild(tr);
    });
}

function renderTop3() {
    const container = document.getElementById('top3-cards');
    container.innerHTML = '';
    if (appData.rows.length === 0) return;
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));

    const rank1 = appData.rows.filter(r => r._rank === 1);
    const rank2 = appData.rows.filter(r => r._rank === 2);
    const rank3 = appData.rows.filter(r => r._rank === 3);
    
    const format = (arr) => arr.map(r => r[partKey]).join('<br>');
    const getPts = (arr) => arr.length > 0 ? (arr[0]['_pontosCalculados'] || 0) : '-';
    const getVit = (arr) => arr.length > 0 ? (arr[0]['_vitorias'] || 0) : 0;

    if (rank2.length > 0) container.innerHTML += `<div class="card-top pos-2"><div class="medal">🥈</div><div class="top-name">${format(rank2)}</div><div class="top-pts">${getPts(rank2)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank2)} exatos</div></div>`;
    if (rank1.length > 0) container.innerHTML += `<div class="card-top pos-1"><div class="medal">🥇</div><div class="top-name">${format(rank1)}</div><div class="top-pts">${getPts(rank1)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank1)} exatos</div></div>`;
    if (rank3.length > 0) container.innerHTML += `<div class="card-top pos-3"><div class="medal">🥉</div><div class="top-name">${format(rank3)}</div><div class="top-pts">${getPts(rank3)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank3)} exatos</div></div>`;
}

function renderDesempateDetalhes() {
    const container = document.getElementById('desempate-detalhes');
    if (!container) return;
    container.innerHTML = '';
    if (appData.rows.length === 0) return;
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    
    const ranks = [1, 2, 3];
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const labels = { 1: '1º Lugar', 2: '2º Lugar', 3: '3º Lugar' };
    const colors = { 1: 'var(--yellow)', 2: 'var(--gray)', 3: '#CD7F32' };
    
    let html = `
        <div class="desempate-header">
            <h3><i class="fa-solid fa-scale-balanced"></i> Como o Desempate Foi Definido</h3>
            <p class="desempate-subtitle">Análise dos critérios aplicados para cada posição do pódio</p>
        </div>
        <div class="desempate-grid">
    `;
    
    ranks.forEach(rank => {
        const grupo = appData.rows.filter(r => r._rank === rank);
        if (grupo.length === 0) return;
        
        const nomes = grupo.map(r => r[partKey]).join(', ');
        const pontos = grupo[0]['_pontosCalculados'] || 0;
        const exatos = grupo[0]['_vitorias'] || 0;
        const participacoes = grupo[0]['_participacoes'] || 0;
        const empatou = grupo.length > 1;
        
        let criterioDefinidor = '';
        let statusBadge = '';
        
        if (empatou) {
            statusBadge = `<span class="badge empate">🤝 EMPATE TOTAL — Dividem a posição</span>`;
            criterioDefinidor = 'Todos os critérios aplicados resultaram em igualdade';
        } else {
            const proximo = appData.rows.find(r => r._rank === rank + 1);
            if (proximo) {
                const ptsProx = proximo['_pontosCalculados'] || 0;
                const exatosProx = proximo['_vitorias'] || 0;
                const partProx = proximo['_participacoes'] || 0;
                
                if (parseInt(pontos) > ptsProx) {
                    criterioDefinidor = '✅ Definido pelo <strong>1º critério (Pontuação)</strong>';
                    statusBadge = `<span class="badge definido">🏆 Posição definida</span>`;
                } else if (exatos > exatosProx) {
                    criterioDefinidor = '✅ Definido pelo <strong>2º critério (Placares Exatos)</strong>';
                    statusBadge = `<span class="badge critico2">⭐ Desempate nos exatos</span>`;
                } else if (participacoes > partProx) {
                    criterioDefinidor = '✅ Definido pelo <strong>3º critério (Participações)</strong>';
                    statusBadge = `<span class="badge critico3">🎯 Desempate nas participações</span>`;
                } else {
                    criterioDefinidor = '✅ Definido por ordem alfabética';
                    statusBadge = `<span class="badge definido">🏆 Posição definida</span>`;
                }
            } else {
                criterioDefinidor = '✅ Único nesta posição';
                statusBadge = `<span class="badge definido">🏆 Posição definida</span>`;
            }
        }
        
        html += `
            <div class="desempate-card" style="border-top: 5px solid ${colors[rank]};">
                <div class="desempate-card-header">
                    <span class="desempate-medal">${medals[rank]}</span>
                    <div>
                        <h4>${labels[rank]}</h4>
                        ${statusBadge}
                    </div>
                </div>
                <div class="desempate-nomes">${nomes}</div>
                <div class="desempate-stats">
                    <div class="desempate-stat">
                        <i class="fa-solid fa-trophy"></i>
                        <div>
                            <span class="stat-label">Pontos</span>
                            <span class="stat-num">${pontos}</span>
                        </div>
                    </div>
                    <div class="desempate-stat">
                        <i class="fa-solid fa-bullseye"></i>
                        <div>
                            <span class="stat-label">Exatos</span>
                            <span class="stat-num">${exatos}</span>
                        </div>
                    </div>
                    <div class="desempate-stat">
                        <i class="fa-solid fa-keyboard"></i>
                        <div>
                            <span class="stat-label">Palpites</span>
                            <span class="stat-num">${participacoes}</span>
                        </div>
                    </div>
                </div>
                <div class="desempate-criterio">${criterioDefinidor}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

function renderPredictions() {
    const thead = document.querySelector('#table-palpites thead');
    const tbody = document.querySelector('#table-palpites tbody');
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    const games = appData.headers.slice(ptsIndex + 1); 
    
    thead.innerHTML = `<tr><th>Participante</th>${games.map(g => `<th>${g}</th>`).join('')}</tr>`;
    tbody.innerHTML = appData.rows.map(row => `<tr><td><strong>${row[partKey]}</strong></td>${games.map(g => `<td>${row[g] === '-' || !row[g] ? '' : row[g]}</td>`).join('')}</tr>`).join('');
}

// ✅ ATUALIZADO: Mostra detalhes completos da pontuação
function searchUserPerformance(name) {
    const resultDiv = document.getElementById('resultado-desempenho');
    if (!name.trim()) { resultDiv.classList.add('hidden'); return; }
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const user = appData.rows.find(r => r[partKey].toLowerCase().includes(name.toLowerCase()));

    if (user) {
        resultDiv.classList.remove('hidden');
        
        const select = document.getElementById('select-participante');
        if (select) select.value = user[partKey];
        
        const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
        const gamesHeaders = appData.headers.slice(ptsIndex + 1);
        
        // ✅ USA CÁLCULO AUTOMÁTICO
        const pontuacao = calcularPontuacaoCompleta(user);
        
        let historicoHTML = '';
        
        gamesHeaders.forEach(header => {
            const palpite = user[header];
            if (palpite && palpite !== '-' && palpite.trim() !== '') { 
                const resultadoReal = extrairResultadoReal(header);
                const palpiteNormalizado = normalizarPalpite(palpite);
                const ehExato = resultadoReal && palpiteNormalizado === resultadoReal;
                
                // ✅ MOSTRA DETALHES DA PONTUAÇÃO
                const detalhes = pontuacao.detalhesPorJogo[header] || { pontos: 0, detalhes: [] };
                const pontosGanhos = detalhes.pontos;
                
                const icone = pontosGanhos >= 3 
                    ? '<span style="color:var(--yellow); font-weight:bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">🎯 EXATO!</span>' 
                    : pontosGanhos === 1 
                        ? '<span style="color:var(--green); font-weight:bold;">✅</span>'
                        : '<span style="color: #E94362; font-weight:bold; font-size: 1.2rem;">❌</span>';
                
                const corPalpite = pontosGanhos >= 3 ? 'var(--green)' : pontosGanhos === 1 ? 'var(--primary)' : 'var(--text-color)';
                
                const bgStyle = pontosGanhos >= 3 
                    ? 'background: rgba(47, 172, 102, 0.15); border-left: 4px solid var(--green);' 
                    : pontosGanhos === 1
                        ? 'background: rgba(0, 146, 221, 0.05); border-left: 4px solid var(--primary);'
                        : 'background: rgba(233, 67, 98, 0.05); border-left: 4px solid var(--border-color);';
                
                // ✅ MOSTRA QUANTOS PONTOS GANHOU
                const pontosDisplay = pontosGanhos > 0 
                    ? `<span style="font-size:0.85rem; color:var(--gray); margin-left:8px;">(+${pontosGanhos} ${pontosGanhos === 1 ? 'pt' : 'pts'})</span>` 
                    : '';
                
                historicoHTML += `<div class="history-item" style="${bgStyle}">
                    <div>
                        <div style="margin-bottom:5px;"><strong>${header}</strong></div>
                        <div style="font-size:0.85rem; color:var(--gray);">${detalhes.detalhes.join(', ')}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="margin-bottom:5px;">
                            <span style="color:${corPalpite}; font-weight:600;">${palpite}</span> 
                            ${icone}
                            ${pontosDisplay}
                        </div>
                    </div>
                </div>`;
            }
        });
        
        document.getElementById('user-historico').innerHTML = historicoHTML || '<p style="text-align:center;padding:20px;color:#999;">Nenhum palpite registrado ainda.</p>';
        document.getElementById('user-total-pontos').innerText = pontuacao.totalPontos;
        document.getElementById('user-jogos').innerText = pontuacao.jogosDisputados;
        document.getElementById('user-exatos').innerText = pontuacao.totalExatos;
    } else {
        resultDiv.classList.add('hidden');
    }
}

function popularSelectParticipantes() {
    const select = document.getElementById('select-participante');
    if (!select) return;
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    
    select.innerHTML = '<option value="">👇 Selecione seu nome na lista</option>';
    
    const participantesOrdenados = [...appData.rows].sort((a, b) => 
        a[partKey].localeCompare(b[partKey])
    );
    
    participantesOrdenados.forEach(row => {
        const nome = row[partKey];
        const pontos = row['_pontosCalculados'] || 0;
        const option = document.createElement('option');
        option.value = nome;
        option.textContent = `${nome} — ${pontos} pts`;
        select.appendChild(option);
    });
}

function updateGlobalStats() {
    const statsContainer = document.getElementById('geral-stats');
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    
    const total = appData.rows.length;
    const pontuaram = appData.rows.filter(r => (r['_pontosCalculados'] || 0) > 0).length;
    const lider = appData.rows[0] ? appData.rows[0][partKey] : '-';
    const totalExatos = appData.rows.reduce((sum, r) => sum + (r['_vitorias'] || 0), 0);
    const mediaPontos = total > 0 ? (appData.rows.reduce((sum, r) => sum + (r['_pontosCalculados'] || 0), 0) / total).toFixed(1) : 0;
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <h3><i class="fa-solid fa-users"></i> Participantes</h3>
            <p class="stat-value">${total}</p>
        </div>
        <div class="stat-card">
            <h3><i class="fa-solid fa-star"></i> Já Pontuaram</h3>
            <p class="stat-value">${pontuaram}</p>
        </div>
        <div class="stat-card">
            <h3><i class="fa-solid fa-futbol"></i> Rodadas</h3>
            <p class="stat-value">${appData.headers.slice(ptsIndex + 1).length}</p>
        </div>
        <div class="stat-card">
            <h3><i class="fa-solid fa-crown"></i> Líder Atual</h3>
            <p class="stat-value" style="font-size: 1.2rem;">${lider}</p>
        </div>
        <div class="stat-card">
            <h3><i class="fa-solid fa-bullseye"></i> Total de Exatos</h3>
            <p class="stat-value">${totalExatos}</p>
        </div>
        <div class="stat-card">
            <h3><i class="fa-solid fa-chart-line"></i> Média de Pontos</h3>
            <p class="stat-value">${mediaPontos}</p>
        </div>
    `;
}

function renderCharts() {
    if (appData.rows.length === 0) return;
    const themeDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const txt = themeDark ? '#FFF' : '#1D1D1B';
    const partK = appData.headers.find(h => h.toLowerCase().includes('participante'));

    if (charts.pontos) charts.pontos.destroy();
    if (charts.top10) charts.top10.destroy();

    const counts = {};
    appData.rows.forEach(r => { 
        const p = r['_pontosCalculados'] || 0; 
        counts[p] = (counts[p] || 0) + 1; 
    });

    charts.pontos = new Chart(document.getElementById('pontosChart').getContext('2d'), {
        type: 'bar',
        data: { 
            labels: Object.keys(counts).sort((a,b) => a-b).map(k => `${k} pts`), 
            datasets: [{ 
                label: 'Quantidade de Participantes', 
                data: Object.keys(counts).sort((a,b) => a-b).map(k => counts[k]), 
                backgroundColor: '#0092DD', 
                borderRadius: 5 
            }] 
        },
        options: { 
            responsive: true, 
            plugins: { legend: { labels: { color: txt } } }, 
            scales: { 
                x: { ticks: { color: txt } }, 
                y: { ticks: { color: txt }, beginAtZero: true } 
            } 
        }
    });

    const top10 = appData.rows.slice(0, 10);
    charts.top10 = new Chart(document.getElementById('top10Chart').getContext('2d'), {
        type: 'doughnut',
        data: { 
            labels: top10.map(r => r[partK]), 
            datasets: [{ 
                data: top10.map(r => r['_pontosCalculados'] || 0), 
                backgroundColor: ['#0092DD', '#FDC533', '#2FAC66', '#E94362', '#005CA9', '#D88BB6', '#954B97', '#C6C6C6', '#1D1D1B', '#333333'] 
            }] 
        },
        options: { 
            responsive: true, 
            plugins: { 
                legend: { position: 'right', labels: { color: txt, font: { size: 11 } } } 
            } 
        }
    });
}

function setupEventListeners() {
    document.getElementById('search-classificacao').addEventListener('input', (e) => renderClassification(e.target.value));
    document.getElementById('search-desempenho').addEventListener('input', (e) => searchUserPerformance(e.target.value));
    
    document.getElementById('select-participante').addEventListener('change', (e) => {
        const nomeSelecionado = e.target.value;
        if (nomeSelecionado) {
            searchUserPerformance(nomeSelecionado);
            document.getElementById('search-desempenho').value = nomeSelecionado;
        } else {
            document.getElementById('resultado-desempenho').classList.add('hidden');
            document.getElementById('search-desempenho').value = '';
        }
    });
    
    document.getElementById('btn-export').addEventListener('click', () => {
        html2canvas(document.getElementById('tabela-export-area'), { backgroundColor: null }).then(c => {
            const l = document.createElement('a'); 
            l.download = 'classificacao.png'; 
            l.href = c.toDataURL(); 
            l.click();
        });
    });
    
    document.getElementById('btn-share').addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({ 
                title: 'Bolão TETO-PE', 
                text: 'Confira a classificação do nosso bolão!',
                url: window.location.href 
            });
        } else {
            alert('Link: ' + window.location.href);
        }
    });
}
