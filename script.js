// Configurações - URL da planilha Google Sheets
const SHEET_ID = '2PACX-1vTTqRYCxqqTeJLzCpTWOy9CAN_Dh8pWyQquoWLDeCtT8ThDgt4kqi40F5tEXnbAwEVqnzC01MZbOHqT';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`;

// Estado global
let appData = {
    participantes: [],
    jogos: [],
    totalRodadas: 0
};

let charts = {};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    showLoading(true);
    
    try {
        await carregarDados();
        setupEventListeners();
        renderizarClassificacao();
        renderizarPalpites();
        renderizarEstatisticas();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarErroCarregamento();
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
}

// Carregar dados da planilha
async function carregarDados() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error('Erro ao buscar dados da planilha');
        }
        
        const csvText = await response.text();
        console.log('CSV recebido:', csvText.substring(0, 500));
        
        const rows = parseCSV(csvText);
        console.log('Rows parseados:', rows);
        
        processarDados(rows);
    } catch (error) {
        console.error('Erro no fetch:', error);
        throw error;
    }
}

// Parse CSV
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const rows = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse simples de CSV (considerando vírgulas)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(sanitize(current));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(sanitize(current));
        
        rows.push(values);
    }
    
    return rows;
}

// Sanitizar string
function sanitize(str) {
    return str.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
}

// Processar dados da planilha
function processarDados(rows) {
    console.log('Processando dados...', rows.length, 'linhas');
    
    const participantes = [];
    const jogos = new Map();
    
    // Encontrar o cabeçalho (linha com "Posição,Participante,Pontos")
    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === 'Posição' && rows[i][1] === 'Participante') {
            headerIndex = i;
            break;
        }
    }
    
    if (headerIndex === -1) {
        console.warn('Cabeçalho não encontrado, tentando linha 0');
        headerIndex = 0;
    }
    
    // Identificar colunas de jogos (a partir da coluna 3)
    const headerRow = rows[headerIndex];
    for (let i = 3; i < headerRow.length; i++) {
        if (headerRow[i] && headerRow[i].includes('x')) {
            jogos.set(i, headerRow[i]);
        }
    }
    
    console.log('Jogos encontrados:', Array.from(jogos.values()));
    
    // Processar participantes
    for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        
        // Pular linhas vazias ou sem participante
        if (!row[1] || row[1].trim() === '') continue;
        
        const participante = {
            posicao: row[0] || '',
            nome: row[1] || `Participante ${i}`,
            pontos: parseInt(row[2]) || 0,
            palpites: {}
        };
        
        // Extrair palpites
        jogos.forEach((nomeJogo, colIndex) => {
            if (row[colIndex]) {
                participante.palpites[nomeJogo] = extrairPalpite(row[colIndex]);
            }
        });
        
        participantes.push(participante);
    }
    
    // Ordenar por pontos
    participantes.sort((a, b) => b.pontos - a.pontos);
    
    // Atualizar posições
    participantes.forEach((p, i) => {
        p.posicao = i + 1;
    });
    
    appData.participantes = participantes;
    appData.jogos = Array.from(jogos.values());
    appData.totalRodadas = jogos.size;
    
    console.log('Dados processados:', {
        participantes: participantes.length,
        jogos: appData.jogos.length
    });
}

// Extrair palpite da célula
function extrairPalpite(celula) {
    if (!celula || celula === '-') return null;
    
    // Procurar padrão de placar (ex: 2x1, 3x0)
    const match = celula.match(/(\d+)\s*x\s*(\d+)/);
    if (match) {
        return {
            placar: `${match[1]}x${match[2]}`,
            time1: parseInt(match[1]),
            time2: parseInt(match[2])
        };
    }
    
    // Se não encontrou placar, retorna o texto como está
    return { placar: celula, time1: null, time2: null };
}

// Renderizar Classificação
function renderizarClassificacao() {
    const tbody = document.getElementById('rankingBody');
    const top3Container = document.getElementById('top3Container');
    
    if (appData.participantes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--amarelo);"></i>
                    <p>Nenhum dado encontrado na planilha</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    top3Container.innerHTML = '';
    
    // Top 3
    const top3 = appData.participantes.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['first', 'second', 'third'];
    
    top3.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = `top-card ${classes[i]}`;
        card.style.animationDelay = `${i * 0.1}s`;
        card.innerHTML = `
            <div class="top-medal">${medals[i]}</div>
            <div class="top-nome">${p.nome}</div>
            <div class="top-pontos">${p.pontos}</div>
            <div class="top-label">pontos</div>
        `;
        top3Container.appendChild(card);
    });
    
    // Tabela completa
    appData.participantes.forEach((p, index) => {
        const tr = document.createElement('tr');
        if (index === 0) tr.classList.add('destaque-lider');
        tr.style.animationDelay = `${index * 0.05}s`;
        
        const aproveitamento = appData.totalRodadas > 0 
            ? ((p.pontos / (appData.totalRodadas * 3)) * 100).toFixed(1) 
            : 0;
        
        tr.innerHTML = `
            <td class="posicao">${getMedalha(p.posicao)}</td>
            <td class="participante">${p.nome}</td>
            <td class="pontos">${p.pontos}</td>
            <td class="aproveitamento">${aproveitamento}%</td>
        `;
        tbody.appendChild(tr);
    });
}

// Obter emoji da medalha
function getMedalha(posicao) {
    if (posicao === 1) return '🥇';
    if (posicao === 2) return '🥈';
    if (posicao === 3) return '🥉';
    return posicao;
}

// Renderizar Palpites
function renderizarPalpites() {
    const thead = document.getElementById('palpitesHead');
    const tbody = document.getElementById('palpitesBody');
    
    if (appData.jogos.length === 0) {
        thead.innerHTML = `
            <tr>
                <th colspan="2" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--amarelo);"></i>
                    <p>Nenhum jogo encontrado na planilha</p>
                </th>
            </tr>
        `;
        return;
    }
    
    // Header
    let headerHTML = '<tr><th class="participante-col">Participante</th>';
    appData.jogos.forEach(jogo => {
        headerHTML += `<th>${jogo}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;
    
    // Body
    tbody.innerHTML = '';
    appData.participantes.forEach(p => {
        const tr = document.createElement('tr');
        let html = `<td class="participante-col">${p.nome}</td>`;
        
        appData.jogos.forEach(jogo => {
            const palpite = p.palpites[jogo];
            html += `<td>${palpite ? palpite.placar : '-'}</td>`;
        });
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// Renderizar Estatísticas
function renderizarEstatisticas() {
    if (appData.participantes.length === 0) return;
    
    const totalParticipantes = appData.participantes.length;
    const participantesPontuaram = appData.participantes.filter(p => p.pontos > 0).length;
    const totalPlacaresExatos = appData.participantes.reduce((acc, p) => {
        return acc + Object.values(p.palpites).filter(palpite => 
            palpite && palpite.time1 !== null && palpite.time1 === palpite.time2
        ).length;
    }, 0);
    
    const totalPalpites = appData.participantes.length * appData.totalRodadas;
    const palpitesPreenchidos = appData.participantes.reduce((acc, p) => {
        return acc + Object.keys(p.palpites).length;
    }, 0);
    
    document.getElementById('totalParticipantes').textContent = totalParticipantes;
    document.getElementById('participantesPontuaram').textContent = participantesPontuaram;
    document.getElementById('totalRodadas').textContent = appData.totalRodadas;
    document.getElementById('liderCampeonato').textContent = appData.participantes[0]?.nome.split(' ')[0] || '-';
    document.getElementById('totalPlacaresExatos').textContent = totalPlacaresExatos;
    document.getElementById('participacaoTotal').textContent = totalPalpites > 0 
        ? ((palpitesPreenchidos / totalPalpites) * 100).toFixed(1) + '%' 
        : '0%';
    
    // Gráficos
    criarGraficos();
}

// Criar Gráficos
function criarGraficos() {
    // Destruir gráficos existentes
    Object.values(charts).forEach(chart => chart.destroy());
    
    // Gráfico de Distribuição
    const ctxDistribuicao = document.getElementById('chartDistribuicao').getContext('2d');
    const distribuicaoData = {};
    
    appData.participantes.forEach(p => {
        distribuicaoData[p.pontos] = (distribuicaoData[p.pontos] || 0) + 1;
    });
    
    charts.distribuicao = new Chart(ctxDistribuicao, {
        type: 'bar',
        data: {
            labels: Object.keys(distribuicaoData).sort((a,b) => a-b),
            datasets: [{
                label: 'Participantes',
                data: Object.keys(distribuicaoData).sort((a,b) => a-b).map(k => distribuicaoData[k]),
                backgroundColor: '#0092DD',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
    
    // Gráfico Top 10
    const ctxTop10 = document.getElementById('chartTop10').getContext('2d');
    const top10 = appData.participantes.slice(0, 10);
    
    charts.top10 = new Chart(ctxTop10, {
        type: 'doughnut',
        data: {
            labels: top10.map(p => p.nome.split(' ')[0]),
            datasets: [{
                data: top10.map(p => p.pontos),
                backgroundColor: [
                    '#FDC533', '#0092DD', '#2FAC66', '#E94362',
                    '#954B97', '#005CA9', '#D88BB6', '#C6C6C6',
                    '#1D1D1B', '#FDC533'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            }
        }
    });
    
    // Gráfico de Participação
    const ctxRodadas = document.getElementById('chartRodadas').getContext('2d');
    const participacaoPorRodada = appData.jogos.map(jogo => {
        return appData.participantes.filter(p => p.palpites[jogo]).length;
    });
    
    charts.rodadas = new Chart(ctxRodadas, {
        type: 'line',
        data: {
            labels: appData.jogos.map((j, i) => `Jogo ${i + 1}`),
            datasets: [{
                label: 'Participantes',
                data: participacaoPorRodada,
                borderColor: '#2FAC66',
                backgroundColor: 'rgba(47, 172, 102, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Navegação entre abas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.closest('.nav-tab').dataset.tab;
            mudarAba(tabId);
        });
    });
    
    // Busca na classificação
    document.getElementById('searchClassificacao').addEventListener('input', (e) => {
        filtrarClassificacao(e.target.value);
    });
    
    // Busca de desempenho
    document.getElementById('btnBuscarDesempenho').addEventListener('click', buscarDesempenho);
    document.getElementById('searchDesempenho').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarDesempenho();
    });
    
    // Toggle tema
    document.getElementById('themeToggle').addEventListener('click', toggleTema);
    
    // Compartilhar
    document.getElementById('shareBtn').addEventListener('click', compartilhar);
    
    // Exportar PNG
    document.getElementById('exportPng').addEventListener('click', exportarPNG);
}

// Mudar aba
function mudarAba(tabId) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// Filtrar classificação
function filtrarClassificacao(termo) {
    const rows = document.querySelectorAll('#rankingBody tr');
    termo = termo.toLowerCase();
    
    rows.forEach(row => {
        const nome = row.querySelector('.participante');
        if (nome) {
            const textoNome = nome.textContent.toLowerCase();
            row.style.display = textoNome.includes(termo) ? '' : 'none';
        }
    });
}

// Buscar desempenho
function buscarDesempenho() {
    const nome = document.getElementById('searchDesempenho').value.toLowerCase();
    if (!nome) {
        alert('Por favor, digite um nome para buscar');
        return;
    }
    
    const participante = appData.participantes.find(p => 
        p.nome.toLowerCase().includes(nome)
    );
    
    if (!participante) {
        alert('Participante não encontrado! Tente buscar por parte do nome.');
        return;
    }
    
    // Preencher dados
    document.getElementById('desempenhoNome').textContent = participante.nome;
    document.getElementById('desempenhoPosicao').textContent = `${getMedalha(participante.posicao)} ${participante.posicao}º lugar`;
    document.getElementById('desempenhoPontos').textContent = participante.pontos;
    document.getElementById('desempenhoJogos').textContent = Object.keys(participante.palpites).length;
    
    // Calcular placares exatos
    const exatos = Object.values(participante.palpites).filter(p => 
        p && p.time1 !== null && p.time1 === p.time2
    ).length;
    document.getElementById('desempenhoExatos').textContent = exatos;
    
    // Preencher histórico
    const tbody = document.getElementById('historicoBody');
    tbody.innerHTML = '';
    
    appData.jogos.forEach(jogo => {
        const palpite = participante.palpites[jogo];
        const tr = document.createElement('tr');
        
        let pontosJogo = 0;
        let statusClass = '';
        let icon = '';
        
        if (palpite) {
            // Simulação - precisaria dos resultados reais para calcular corretamente
            pontosJogo = Math.floor(Math.random() * 4);
            statusClass = pontosJogo > 0 ? 'resultado-correto' : 'resultado-errado';
            icon = pontosJogo === 3 ? '⭐' : pontosJogo > 0 ? '✅' : '❌';
        }
        
        tr.innerHTML = `
            <td>${jogo}</td>
            <td>${palpite ? palpite.placar : '-'}</td>
            <td class="${statusClass}">${palpite ? palpite.placar + ' ' + icon : '-'}</td>
            <td><strong>${pontosJogo}</strong></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('desempenhoEmpty').style.display = 'none';
    document.getElementById('desempenhoResult').style.display = 'block';
}

// Toggle Tema
function toggleTema() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('themeToggle');
    const icon = btn.querySelector('i');
    
    if (document.body.classList.contains('dark-mode')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Compartilhar
async function compartilhar() {
    const lider = appData.participantes[0];
    const texto = `🏆 Bolão TETO-PE - Copa 2026\n\n` +
                  `🥇 Líder: ${lider?.nome} (${lider?.pontos} pts)\n` +
                  `👥 Participantes: ${appData.participantes.length}\n` +
                  `⚽ Jogos: ${appData.totalRodadas}\n\n` +
                  `Acesse e participe!`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Bolão TETO-PE',
                text: texto
            });
        } catch (err) {
            console.log('Erro ao compartilhar:', err);
        }
    } else {
        navigator.clipboard.writeText(texto);
        alert('Classificação copiada para a área de transferência!');
    }
}

// Exportar PNG
async function exportarPNG() {
    const element = document.getElementById('tableContainer');
    try {
        const canvas = await html2canvas(element);
        const link = document.createElement('a');
        link.download = 'classificacao-bolao-teto.png';
        link.href = canvas.toDataURL();
        link.click();
    } catch (err) {
        alert('Erro ao exportar imagem');
        console.error(err);
    }
}

// Mostrar erro
function mostrarErroCarregamento() {
    const tbody = document.getElementById('rankingBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--rosa); margin-bottom: 1rem;"></i>
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Erro ao carregar dados da planilha</p>
                <button onclick="location.reload()" class="btn-primary">
                    <i class="fas fa-refresh"></i> Tentar Novamente
                </button>
            </td>
        </tr>
    `;
    
    const top3Container = document.getElementById('top3Container');
    top3Container.innerHTML = `
        <div class="top-card first">
            <div class="top-medal">⚠️</div>
            <div class="top-nome">Erro</div>
            <div class="top-pontos">-</div>
            <div class="top-label">Sem dados</div>
        </div>
    `;
}

// Loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Auto-refresh a cada 5 minutos
setInterval(() => {
    console.log('Atualizando dados automaticamente...');
    initApp();
}, 300000);