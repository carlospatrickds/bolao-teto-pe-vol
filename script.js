/**
 * BOLÃO TETO-PE - Script Principal
 * Lógica de processamento de dados e renderização da interface
 */

// URL da Planilha (Aba específica)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTqRYCxqqTeJLzCpTWOy9CAN_Dh8pWyQquoWLDeCtT8ThDgt4kqi40F5tEXnbAwEVqnzC01MZbOHqT/pub?gid=1254969741&single=true&output=csv';

let appData = {
    headers: [],
    rows: []
};

let charts = {}; // Gerencia instâncias do Chart.js

// ============================================
// FUNÇÕES AUXILIARES PARA PLACARES EXATOS
// ============================================

// Extrai o resultado real do cabeçalho da coluna
// Ex: "Uruguai 1x1 Arábia Saudita" → "1x1"
function extrairResultadoReal(nomeColuna) {
    const regex = /(\d+x\d+)/;
    const match = nomeColuna.match(regex);
    return match ? match[1] : null;
}

// Normaliza o palpite para comparação
// Ex: "Uruguai 1x1 Arábia Saudita" → "1x1"
// Ex: "1x1" → "1x1"
function normalizarPalpite(palpite) {
    if (!palpite || palpite === '-') return null;
    const regex = /(\d+x\d+)/;
    const match = palpite.match(regex);
    return match ? match[1] : null;
}

// Calcula placares exatos comparando com o cabeçalho
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

// ============================================
// TEMA (Claro/Escuro)
// ============================================
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

// ============================================
// NAVEGAÇÃO POR ABAS
// ============================================
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

// ============================================
// FETCH DE DADOS COM CACHE BUSTER
// ============================================
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
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// ============================================
// PARSER, SANITIZAÇÃO E LÓGICA DE RANKING
// ============================================
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
        
        // Calcula placares exatos automaticamente a partir do cabeçalho!
        rowData['_vitorias'] = calcularPlacaresExatos(rowData);
        
        return rowData;
    });

    appData.rows = rawRows.filter(row => {
        const nome = row[partKey];
        const pontosRaiz = row[ptsKey];
        if (!nome || nome === '-' || nome.toLowerCase() === 'participante' || nome.trim() === '') return false;
        return !isNaN(parseInt(pontosRaiz));
    });

    // Ordenação com Critérios de Desempate
    appData.rows.sort((a, b) => {
        // 1º Critério: Pontuação Total
        const pA = parseInt(a[ptsKey]) || 0, pB = parseInt(b[ptsKey]) || 0;
        if (pB !== pA) return pB - pA;
        
        // 2º Critério: Placares Exatos
        const vA = a['_vitorias'] || 0, vB = b['_vitorias'] || 0;
        if (vB !== vA) return vB - vA;
        
        // 3º Critério: Número de Participações
        const paA = a['_participacoes'] || 0, paB = b['_participacoes'] || 0;
        if (paB !== paA) return paB - paA;
        
        // 4º Critério: Ordem alfabética
        return a[partKey].localeCompare(b[partKey]);
    });

    // Cálculo do Ranking Denso (empate = mesma posição)
    if (appData.rows.length > 0) {
        let currentRank = 1;
        appData.rows[0]._rank = 1;
        for (let i = 1; i < appData.rows.length; i++) {
            const prev = appData.rows[i - 1], curr = appData.rows[i];
            const samePts = parseInt(prev[ptsKey]) === parseInt(curr[ptsKey]);
            const sameVit = (prev['_vitorias'] || 0) === (curr['_vitorias'] || 0);
            const samePart = prev['_participacoes'] === curr['_participacoes'];
            
            if (samePts && sameVit && samePart) curr._rank = currentRank;
            else { currentRank++; curr._rank = currentRank; }
        }
    }
}

// ============================================
// RENDERIZAÇÃO DA CLASSIFICAÇÃO
// ============================================
function renderClassification(filterText = '') {
    const tbody = document.querySelector('#table-classificacao tbody');
    tbody.innerHTML = '';
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));

    appData.rows.filter(r => r[partKey].toLowerCase().includes(filterText.toLowerCase())).forEach(row => {
        let displayRank = row._rank;
        if (row._rank === 1) displayRank = '🥇';
        else if (row._rank === 2) displayRank = '🥈';
        else if (row._rank === 3) displayRank = '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${displayRank}</td><td class="highlight">${row[partKey]}</td><td><strong>${row[ptsKey]}</strong></td>`;
        tbody.appendChild(tr);
    });
}

// ============================================
// RENDERIZAÇÃO DO PÓDIO (Top 3)
// ============================================
function renderTop3() {
    const container = document.getElementById('top3-cards');
    container.innerHTML = '';
    if (appData.rows.length === 0) return;
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));

    const rank1 = appData.rows.filter(r => r._rank === 1);
    const rank2 = appData.rows.filter(r => r._rank === 2);
    const rank3 = appData.rows.filter(r => r._rank === 3);
    
    const format = (arr) => arr.map(r => r[partKey]).join('<br>');
    const getPts = (arr) => arr.length > 0 ? arr[0][ptsKey] : '-';
    const getVit = (arr) => arr.length > 0 ? (arr[0]['_vitorias'] || 0) : 0;

    if (rank2.length > 0) container.innerHTML += `<div class="card-top pos-2"><div class="medal">🥈</div><div class="top-name">${format(rank2)}</div><div class="top-pts">${getPts(rank2)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank2)} exatos</div></div>`;
    if (rank1.length > 0) container.innerHTML += `<div class="card-top pos-1"><div class="medal">🥇</div><div class="top-name">${format(rank1)}</div><div class="top-pts">${getPts(rank1)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank1)} exatos</div></div>`;
    if (rank3.length > 0) container.innerHTML += `<div class="card-top pos-3"><div class="medal">🥉</div><div class="top-name">${format(rank3)}</div><div class="top-pts">${getPts(rank3)} pts</div><div class="top-vit" style="font-size:0.8rem;color:#666;">${getVit(rank3)} exatos</div></div>`;
}

// ============================================
// DETALHES DO DESEMPATE
// ============================================
function renderDesempateDetalhes() {
    const container = document.getElementById('desempate-detalhes');
    if (!container) return;
    container.innerHTML = '';
    if (appData.rows.length === 0) return;
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));
    
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
        const pontos = grupo[0][ptsKey];
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
                const ptsProx = parseInt(proximo[ptsKey]);
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
                    statusBadge = `<span class="badge definido"> Posição definida</span>`;
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

// ============================================
// RENDERIZAÇÃO DOS PALPITES
// ============================================
function renderPredictions() {
    const thead = document.querySelector('#table-palpites thead');
    const tbody = document.querySelector('#table-palpites tbody');
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    const games = appData.headers.slice(ptsIndex + 1); 
    
    thead.innerHTML = `<tr><th>Participante</th>${games.map(g => `<th>${g}</th>`).join('')}</tr>`;
    tbody.innerHTML = appData.rows.map(row => `<tr><td><strong>${row[partKey]}</strong></td>${games.map(g => `<td>${row[g] === '-' || !row[g] ? '' : row[g]}</td>`).join('')}</tr>`).join('');
}

// ============================================
// DESEMPENHO INDIVIDUAL DO USUÁRIO
// ============================================

function searchUserPerformance(name) {
    const resultDiv = document.getElementById('resultado-desempenho');
    if (!name.trim()) { resultDiv.classList.add('hidden'); return; }
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const user = appData.rows.find(r => r[partKey].toLowerCase().includes(name.toLowerCase()));

    if (user) {
        resultDiv.classList.remove('hidden');
        const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));
        const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
        const gamesHeaders = appData.headers.slice(ptsIndex + 1);
        
        let disputados = 0;
        let exatos = calcularPlacaresExatos(user);
        let historicoHTML = '';
        
        gamesHeaders.forEach(header => {
            const palpite = user[header];
            if (palpite && palpite !== '-' && palpite.trim() !== '') { 
                disputados++; 
                
                const resultadoReal = extrairResultadoReal(header);
                const palpiteNormalizado = normalizarPalpite(palpite);
                const ehExato = resultadoReal && palpiteNormalizado === resultadoReal;
                
                const icone = ehExato 
                    ? '🎯 <span style="color:var(--yellow);font-weight:bold;">EXATO!</span>' 
                    : '✅';
                const corPalpite = ehExato ? 'var(--green)' : 'var(--primary)';
                
                historicoHTML += `<div class="history-item" style="${ehExato ? 'background:#d4edda;border-left:4px solid var(--green);' : ''}">
                    <div><strong>${header}</strong></div>
                    <div>
                        <span style="color:${corPalpite};font-weight:600;">${palpite}</span> 
                        ${icone}
                    </div>
                </div>`;
            }
        });
        
        document.getElementById('user-historico').innerHTML = historicoHTML || '<p style="text-align:center;padding:20px;color:#999;">Nenhum palpite registrado ainda.</p>';
        document.getElementById('user-total-pontos').innerText = user[ptsKey];
        document.getElementById('user-jogos').innerText = disputados;
        document.getElementById('user-exatos').innerText = exatos;
    } else {
        resultDiv.classList.add('hidden');
    }
}

// ============================================
// POPULAR DROPDOWN DE PARTICIPANTES
// ============================================
function popularSelectParticipantes() {
    const select = document.getElementById('select-participante');
    if (!select) return;
    
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));
    
    // Mantém a primeira opção (placeholder)
    select.innerHTML = '<option value="">👇 Selecione seu nome na lista</option>';
    
    // Ordena alfabeticamente para facilitar a busca
    const participantesOrdenados = [...appData.rows].sort((a, b) => 
        a[partKey].localeCompare(b[partKey])
    );
    
    participantesOrdenados.forEach(row => {
        const nome = row[partKey];
        const pontos = row[ptsKey];
        const option = document.createElement('option');
        option.value = nome;
        option.textContent = `${nome} — ${pontos} pts`;
        select.appendChild(option);
    });
}

// ============================================
// ESTATÍSTICAS GERAIS
// ============================================
function updateGlobalStats() {
    const statsContainer = document.getElementById('geral-stats');
    const partKey = appData.headers.find(h => h.toLowerCase().includes('participante'));
    const ptsKey = appData.headers.find(h => h.toLowerCase().includes('ponto'));
    const ptsIndex = appData.headers.findIndex(h => h.toLowerCase().includes('ponto'));
    
    const total = appData.rows.length;
    const pontuaram = appData.rows.filter(r => parseInt(r[ptsKey]) > 0).length;
    const lider = appData.rows[0] ? appData.rows[0][partKey] : '-';
    const totalExatos = appData.rows.reduce((sum, r) => sum + (r['_vitorias'] || 0), 0);
    const mediaPontos = total > 0 ? (appData.rows.reduce((sum, r) => sum + parseInt(r[ptsKey] || 0), 0) / total).toFixed(1) : 0;
    
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

// ============================================
// GRÁFICOS (Chart.js)
// ============================================
function renderCharts() {
    if (appData.rows.length === 0) return;
    const themeDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const txt = themeDark ? '#FFF' : '#1D1D1B';
    const ptsK = appData.headers.find(h => h.toLowerCase().includes('ponto'));
    const partK = appData.headers.find(h => h.toLowerCase().includes('participante'));

    if (charts.pontos) charts.pontos.destroy();
    if (charts.top10) charts.top10.destroy();

    // Distribuição de Pontos
    const counts = {};
    appData.rows.forEach(r => { 
        const p = parseInt(r[ptsK]) || 0; 
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

    // Top 10 Participantes
    const top10 = appData.rows.slice(0, 10);
    charts.top10 = new Chart(document.getElementById('top10Chart').getContext('2d'), {
        type: 'doughnut',
        data: { 
            labels: top10.map(r => r[partK]), 
            datasets: [{ 
                data: top10.map(r => parseInt(r[ptsK]) || 0), 
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

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    document.getElementById('search-classificacao').addEventListener('input', (e) => renderClassification(e.target.value));
    document.getElementById('search-desempenho').addEventListener('input', (e) => searchUserPerformance(e.target.value));
    
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
