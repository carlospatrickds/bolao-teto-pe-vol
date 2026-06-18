// Configurações
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTqRYCxqqTeJLzCpTWOy9CAN_Dh8pWyQquoWLDeCtT8ThDgt4kqi40F5tEXnbAwEVqnzC01MZbOHqT/pub?output=csv';

// Estado global
let appData = {
    participantes: [],
    jogos: [],
    resultados: {},
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
        alert('Erro ao carregar dados da planilha. Tente novamente mais tarde.');
    } finally {
        showLoading(false);
    }
}

// Carregar dados da planilha
async function carregarDados() {
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    // Processar dados
    processarDados(rows);
}

// Parse CSV
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => sanitize(h));
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => sanitize(v));
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
}

// Sanitizar string
function sanitize(str) {
    return str.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
}

// Processar dados da planilha
function processarDados(rows) {
    const participantes = [];
    const jogos = [];
    const resultados = {};
    
    // Identificar colunas de jogos (a partir da coluna D)
    let colunasJogos = [];
    
    rows.forEach((row, index) => {
        if (index === 0) {
            // Primeira linha após header - identificar colunas de jogos
            Object.keys(row).forEach((key, i) => {
                if (i >= 3) { // Colunas D em diante
                    if (row[key] && (row[key].includes('x') || row[key].includes('Argentina') || row[key].includes('Colômbia'))) {
                        colunasJogos.push(key);
                        // Extrair nome do jogo
                        const nomeJogo = extrairNomeJogo(key);
                        jogos.push({
                            id: i,
                            nome: nomeJogo,
                            coluna: key
                        });
                    }
                }
            });
        }
    });
    
    // Processar participantes
    rows.forEach((row, index) => {
        if (index === 0) return; // Pular header
        
        const participante = {
            posicao: parseInt(row['Posição']) || index,
            nome: row['Participante'] || `Participante ${index}`,
            pontos: parseInt(row['Pontos']) || 0,
            palpites: {}
        };
        
        // Extrair palpites
        jogos.forEach(jogo => {
            const palpite = row[jogo.coluna] || '';
            participante.palpites[jogo.nome] = extrairPalpite(palpite);
        });
        
        participantes.push(participante);
    });
    
    // Ordenar por pontos
    participantes.sort((a, b) => b.pontos - a.pontos);
    
    // Atualizar posições
    participantes.forEach((p, i) => {
        p.posicao = i + 1;
    });
    
    appData.participantes = participantes;
    appData.jogos = jogos;
    appData.totalRodadas = jogos.length;
    
    // Calcular estatísticas adicionais
    calcularEstatisticas();
}

// Extrair nome do jogo da célula
function extrairNomeJogo(celula) {
    // Remove números e mantém apenas o texto do jogo
    return celula.replace(/\d+x\d+/g, '').trim();
}

// Extrair palpite da célula
function extrairPalpite(celula) {
    if (!celula) return null;
    
    // Procurar padrão de placar (ex: 2x1, 3x0)
    const match = celula.match(/(\d+)x(\d+)/);
    if (match) {
        return {
            placar: `${match[1]}x${match[2]}`,
            time1: parseInt(match[1]),
            time2: parseInt(match[2])
        };
    }
    return null;
}

// Calcular estatísticas
function calcularEstatisticas() {
    let totalPlacaresExatos = 0;
    let participantesPontuaram = 0;
    let totalPalpites = 0;
    let palpitesPreenchidos = 0;
    
    appData.participantes.forEach(p => {
        if (p.pontos > 0) participantesPontuaram++;
        
        Object.values(p.palpites).forEach(palpite => {
            totalPalpites++;
            if (palpite) {
                palpitesPreenchidos++;
                // Verificar se é placar exato (simplificado)
                if (palpite.time1 === palpite.time2 && palpite.time1 > 0) {
                    // Lógica simplificada - na prática precisaria dos resultados reais
                }
            }
        });
    });
    
    appData.estatisticas = {
        totalParticipantes: appData.participantes.length,
        participantesPontuaram,
        totalPlacaresExatos,
        participacaoMedia: totalPalpites > 0 ? (palpitesPreenchidos / totalPalpites * 100).toFixed(1) : 0
    };
}

// Renderizar Classificação
function renderizarClassificacao() {
    const tbody = document.getElementById('rankingBody');
    const top3Container = document.getElementById('top3Container');
    
    tbody.innerHTML = '';
    top3Container.innerHTML = '';
    
    // Top 3
    const top3 = appData.participantes.slice(0, 3);
    const medals = ['🥇', '🥈', ''];
    const classes = ['first', 'second', 'third'];
    
    top3.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = `top-card ${classes[i]}`;
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
    
    // Header
    let headerHTML = '<tr><th class="participante-col">Participante</th>';
    appData.jogos.forEach(jogo => {
        headerHTML += `<th>${jogo.nome}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;
    
    // Body
    tbody.innerHTML = '';
    appData.participantes.forEach(p => {
        const tr = document.createElement('tr');
        let html = `<td class="participante-col">${p.nome}</td>`;
        
        appData.jogos.forEach(jogo => {
            const palpite = p.palpites[jogo.nome];
            html += `<td>${palpite ? palpite.placar : '-'}</td>`;
        });
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// Renderizar Estatísticas
function renderizarEstatisticas() {
    const stats = appData.estatisticas;
    
    document.getElementById('totalParticipantes').textContent = stats.totalParticipantes;
    document.getElementById('participantesPontuaram').textContent = stats.participantesPontuaram;
    document.getElementById('totalRodadas').textContent = appData.totalRodadas;
    document.getElementById('liderCampeonato').textContent = appData.participantes[0]?.nome.split(' ')[0] || '-';
    document.getElementById('totalPlacaresExatos').textContent = stats.totalPlacaresExatos;
    document.getElementById('participacaoTotal').textContent = stats.participacaoMedia + '%';
    
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
        const count = appData.participantes.filter(p => p.palpites[jogo.nome]).length;
        return count;
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
    // Remover active de todas as abas
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adicionar active na aba selecionada
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// Filtrar classificação
function filtrarClassificacao(termo) {
    const rows = document.querySelectorAll('#rankingBody tr');
    termo = termo.toLowerCase();
    
    rows.forEach(row => {
        const nome = row.querySelector('.participante').textContent.toLowerCase();
        row.style.display = nome.includes(termo) ? '' : 'none';
    });
}

// Buscar desempenho
function buscarDesempenho() {
    const nome = document.getElementById('searchDesempenho').value.toLowerCase();
    if (!nome) return;
    
    const participante = appData.participantes.find(p => 
        p.nome.toLowerCase().includes(nome)
    );
    
    if (!participante) {
        alert('Participante não encontrado!');
        return;
    }
    
    // Preencher dados
    document.getElementById('desempenhoNome').textContent = participante.nome;
    document.getElementById('desempenhoPosicao').textContent = `${getMedalha(participante.posicao)} ${participante.posicao}º lugar`;
    document.getElementById('desempenhoPontos').textContent = participante.pontos;
    document.getElementById('desempenhoJogos').textContent = Object.keys(participante.palpites).length;
    
    // Calcular placares exatos (simplificado)
    const exatos = Object.values(participante.palpites).filter(p => p && p.time1 === p.time2).length;
    document.getElementById('desempenhoExatos').textContent = exatos;
    
    // Preencher histórico
    const tbody = document.getElementById('historicoBody');
    tbody.innerHTML = '';
    
    appData.jogos.forEach(jogo => {
        const palpite = participante.palpites[jogo.nome];
        const tr = document.createElement('tr');
        
        let pontosJogo = 0;
        let statusClass = '';
        let icon = '';
        
        if (palpite) {
            // Simulação - na prática precisaria dos resultados reais
            pontosJogo = Math.floor(Math.random() * 4); // Placeholder
            statusClass = pontosJogo > 0 ? 'resultado-correto' : 'resultado-errado';
            icon = pontosJogo === 3 ? '⭐' : pontosJogo > 0 ? '✅' : '❌';
        }
        
        tr.innerHTML = `
            <td>${jogo.nome}</td>
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
    const texto = `🏆 Bolão TETO-PE - Copa 2026\n\n` +
                  `🥇 Líder: ${appData.participantes[0]?.nome} (${appData.participantes[0]?.pontos} pts)\n` +
                  `👥 Participantes: ${appData.participantes.length}\n\n` +
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
        // Fallback: copiar para clipboard
        navigator.clipboard.writeText(texto);
        alert('Classificação copiada para a área de transferência!');
    }
}

// Exportar PNG
async function exportarPNG() {
    const element = document.querySelector('.table-container');
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
    console.log('Atualizando dados...');
    initApp();
}, 300000);