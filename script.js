// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAPoOlv-mub_pmnOjNTQgxDbjFur2NmEdY",
  authDomain: "nexora-os-a6c46.firebaseapp.com",
  projectId: "nexora-os-a6c46",
  storageBucket: "nexora-os-a6c46.firebasestorage.app",
  messagingSenderId: "204169799274",
  appId: "1:204169799274:web:eb46867b5df42d33afcc13",
  measurementId: "G-YMZQP33KQR"
};

// Inicializar Firebase Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- BANCO DE DADOS EM TEMPO REAL (SEM LOGIN) ---
let operacoes = [];
let vendas = [];
let clientes = [];
let config = {
  metaFixa: 1000000.0,
  taxaVenda: 6.0,
  taxaAds: 12.0,
  modoLeitura: false
};

let graficoPerformance = null;
let graficoTendencia = null;

const docRef = db.collection("nexora_db").doc("dados_globais");

// Sincronização em tempo real (Firestore onSnapshot)
docRef.onSnapshot((doc) => {
  if (doc.exists) {
    const data = doc.data();
    operacoes = data.operacoes || [];
    vendas = data.vendas || [];
    clientes = data.clientes || [];
    config = data.config || config;

    aplicarEstadoModoLeitura();
    atualizarInterface();
  } else {
    salvarDados();
  }
}, (error) => {
  console.error("Erro ao sincronizar com o Firebase:", error);
});

function salvarDados() {
  const payload = { operacoes, vendas, clientes, config };
  docRef.set(payload).catch((error) => {
    console.error("Erro ao salvar no Firestore:", error);
  });
  atualizarInterface();
}

// --- GARANTIR QUE A TELA DE LOGIN SUMA ---
document.addEventListener('DOMContentLoaded', () => {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    authScreen.classList.remove('active'); // Oculta a tela de login permanentemente
    authScreen.style.display = 'none';
  }

  inicializarNavegacao();
});

function inicializarNavegacao() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const viewPanes = document.querySelectorAll('.view-pane');

  const titulos = {
    'view-resumo': 'Dashboard - Principal',
    'view-financeiro': 'Despesas & Fluxo de Caixa',
    'view-vendas': 'Vendas & Funil Comercial',
    'view-taxas': 'Taxas, Impostos & Segurança',
    'view-clientes': 'Clientes (CRM)'
  };

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!target) return;

      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      viewPanes.forEach(p => p.classList.remove('active'));
      const paneTarget = document.getElementById(target);
      if (paneTarget) {
        paneTarget.classList.add('active');
      }

      const pageTitle = document.getElementById('page-title');
      if (pageTitle) {
        pageTitle.innerText = titulos[target] || 'Dashboard';
      }

      if (target === 'view-resumo') {
        setTimeout(() => {
          renderizarGrafico(operacoes);
          renderizarTendencia(operacoes);
        }, 50);
      }
    });
  });
}

// --- MODO SOMENTE LEITURA ---
function aplicarEstadoModoLeitura() {
  const btn = document.getElementById('btn-toggle-lock');
  const icon = document.getElementById('lock-icon');
  const text = document.getElementById('lock-text');
  if (!btn) return;

  if (config.modoLeitura) {
    document.body.classList.add('modo-leitura');
    btn.classList.add('locked');
    if (icon) icon.innerText = '🔒';
    if (text) text.innerText = 'Somente Leitura';
  } else {
    document.body.classList.remove('modo-leitura');
    btn.classList.remove('locked');
    if (icon) icon.innerText = '🔓';
    if (text) text.innerText = 'Edição Liberada';
  }
}

function alternarModoLeitura() {
  config.modoLeitura = !config.modoLeitura;
  salvarDados();
  aplicarEstadoModoLeitura();
}

// --- MODAIS ---
function abrirModal(id) {
  if (config.modoLeitura) return;
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function fecharModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('active');
    const form = m.querySelector('form');
    if (form) form.reset();
  }
}

const btnNovaOp = document.getElementById('btn-nova-operacao');
if (btnNovaOp) {
  btnNovaOp.addEventListener('click', () => abrirModal('modal-operacao'));
}

document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', e => {
    if (e.target === b) fecharModal(b.id);
  });
});

function formatarMoeda(v) {
  const valorNum = parseFloat(v) || 0;
  return valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function converterDataBR(dataStr) {
  if (!dataStr) return new Date();
  const partes = dataStr.split('/');
  if (partes.length !== 3) return new Date();
  return new Date(partes[2], partes[1] - 1, partes[0]);
}

// --- CONFIGURAR TAXAS ---
const inputTaxaVenda = document.getElementById('config-taxa-venda');
if (inputTaxaVenda) inputTaxaVenda.value = config.taxaVenda;

const inputTaxaAds = document.getElementById('config-taxa-ads');
if (inputTaxaAds) inputTaxaAds.value = config.taxaAds;

const formTaxas = document.getElementById('form-taxas');
if (formTaxas) {
  formTaxas.addEventListener('submit', e => {
    e.preventDefault();
    if (config.modoLeitura) return;
    config.taxaVenda = parseFloat(document.getElementById('config-taxa-venda').value) || 0;
    config.taxaAds = parseFloat(document.getElementById('config-taxa-ads').value) || 0;
    salvarDados();
    alert('Alíquotas atualizadas com sucesso!');
  });
}

// --- LANÇAR OPERAÇÃO ---
const formOp = document.getElementById('form-operacao');
if (formOp) {
  formOp.addEventListener('submit', e => {
    e.preventDefault();
    if (config.modoLeitura) return;

    const desc = document.getElementById('op-desc').value.trim();
    const tipo = document.getElementById('op-tipo').value;
    const canal = document.getElementById('op-canal').value;
    const valor = parseFloat(document.getElementById('op-valor').value);

    if (!desc || isNaN(valor) || valor <= 0) return;

    operacoes.push({
      id: Date.now(),
      desc,
      tipo,
      canal,
      valor,
      data: new Date().toLocaleDateString('pt-BR')
    });

    salvarDados();
    fecharModal('modal-operacao');
  });
}

function excluirOperacao(id) {
  if (config.modoLeitura) return;
  if (!confirm('Tem certeza que deseja excluir esta operação financeira?')) return;
  operacoes = operacoes.filter(o => o.id !== id);
  salvarDados();
}

// --- LANÇAR VENDA ---
const formVenda = document.getElementById('form-venda');
if (formVenda) {
  formVenda.addEventListener('submit', e => {
    e.preventDefault();
    if (config.modoLeitura) return;

    const produto = document.getElementById('venda-produto').value.trim();
    const cliente = document.getElementById('venda-cliente').value.trim();
    const canal = document.getElementById('venda-canal').value;
    const status = document.getElementById('venda-status').value;
    const valor = parseFloat(document.getElementById('venda-valor').value);

    if (!produto || !cliente || isNaN(valor) || valor <= 0) return;

    vendas.push({ id: Date.now(), produto, cliente, canal, status, valor });

    if (status === 'Aprovada') {
      operacoes.push({
        id: Date.now() + 1,
        desc: `Venda: ${produto} (${cliente})`,
        tipo: 'receita',
        canal: canal,
        valor: valor,
        data: new Date().toLocaleDateString('pt-BR')
      });
    }

    salvarDados();
    fecharModal('modal-venda');
  });
}

function aprovarVenda(id) {
  if (config.modoLeitura) return;
  const v = vendas.find(item => item.id === id);
  if (v && v.status === 'Pendente') {
    v.status = 'Aprovada';
    operacoes.push({
      id: Date.now(),
      desc: `Venda Aprovada: ${v.produto} (${v.cliente})`,
      tipo: 'receita',
      canal: v.canal,
      valor: v.valor,
      data: new Date().toLocaleDateString('pt-BR')
    });
    salvarDados();
  }
}

function excluirVenda(id) {
  if (config.modoLeitura) return;
  if (!confirm('Deseja realmente remover este pedido?')) return;
  vendas = vendas.filter(v => v.id !== id);
  salvarDados();
}

// --- CLIENTES ---
const formCliente = document.getElementById('form-cliente');
if (formCliente) {
  formCliente.addEventListener('submit', e => {
    e.preventDefault();
    if (config.modoLeitura) return;

    const nome = document.getElementById('cli-nome').value.trim();
    const email = document.getElementById('cli-email').value.trim();
    const tel = document.getElementById('cli-tel').value.trim();

    if (!nome) return;
    clientes.push({ id: Date.now(), nome, email, tel });
    salvarDados();
    fecharModal('modal-cliente');
  });
}

function excluirCliente(id) {
  if (config.modoLeitura) return;
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  clientes = clientes.filter(c => c.id !== id);
  salvarDados();
}

// --- CÁLCULO DE BI + SMART ALERTS + FILTROS ---
function atualizarInterface() {
  const filtroPeriodoEl = document.getElementById('filtro-periodo');
  const filtroCanalEl = document.getElementById('filtro-canal');
  const filtroTipoEl = document.getElementById('filtro-tipo');

  const filtroPeriodo = filtroPeriodoEl ? filtroPeriodoEl.value : 'todos';
  const filtroCanal = filtroCanalEl ? filtroCanalEl.value : 'todos';
  const filtroTipo = filtroTipoEl ? filtroTipoEl.value : 'todos';
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = new Date().toLocaleDateString('pt-BR');

  const opsFiltradas = operacoes.filter(op => {
    if (filtroCanal !== 'todos' && op.canal !== filtroCanal) return false;
    if (filtroTipo !== 'todos' && op.tipo !== filtroTipo) return false;

    const dataOp = converterDataBR(op.data);
    dataOp.setHours(0, 0, 0, 0);

    if (filtroPeriodo === 'hoje') {
      if (op.data !== hojeStr) return false;
    } else if (filtroPeriodo === '7dias') {
      const limite7Dias = new Date();
      limite7Dias.setDate(hoje.getDate() - 7);
      limite7Dias.setHours(0, 0, 0, 0);
      if (dataOp < limite7Dias) return false;
    } else if (filtroPeriodo === 'mes') {
      if (dataOp.getMonth() !== hoje.getMonth() || dataOp.getFullYear() !== hoje.getFullYear()) return false;
    }

    return true;
  });

  let faturamento = 0;
  let gastosAds = 0;
  let outrasDespesas = 0;
  let qtdVendas = 0;

  const tbodyResumo = document.getElementById('tabela-resumo');
  const tbodyFin = document.getElementById('tabela-financeiro');
  if (tbodyResumo) tbodyResumo.innerHTML = '';
  if (tbodyFin) tbodyFin.innerHTML = '';

  const nomesCat = {
    receita: 'Faturamento',
    anuncio: 'Tráfego / Ads',
    despesa: 'Despesa Fixa'
  };

  opsFiltradas.forEach(op => {
    if (op.tipo === 'receita') {
      faturamento += op.valor;
      qtdVendas++;
    } else if (op.tipo === 'anuncio') {
      gastosAds += op.valor;
    } else {
      outrasDespesas += op.valor;
    }

    const row = `
      <tr>
        <td><strong>${op.desc}</strong></td>
        <td style="color: var(--cyan);">${op.canal}</td>
        <td><span class="badge ${op.tipo}">${nomesCat[op.tipo]}</span></td>
        <td>${formatarMoeda(op.valor)}</td>
        <td style="color: var(--text-muted);">${op.data}</td>
        <td><button class="btn-del" onclick="excluirOperacao(${op.id})">Excluir</button></td>
      </tr>
    `;
    if (tbodyResumo) tbodyResumo.innerHTML += row;
    if (tbodyFin) tbodyFin.innerHTML += row;
  });

  if (opsFiltradas.length === 0) {
    const empty = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:28px;">Nenhuma operação encontrada para este filtro.</td></tr>`;
    if (tbodyResumo) tbodyResumo.innerHTML = empty;
    if (tbodyFin) tbodyFin.innerHTML = empty;
  }

  let totalPendentes = 0;
  const tbodyVendas = document.getElementById('tabela-vendas');
  if (tbodyVendas) {
    tbodyVendas.innerHTML = '';
    vendas.forEach(v => {
      if (v.status === 'Pendente') totalPendentes += v.valor;
      tbodyVendas.innerHTML += `
        <tr>
          <td><strong>${v.produto}</strong></td>
          <td>${v.cliente}</td>
          <td style="color: var(--cyan);">${v.canal}</td>
          <td><span class="badge ${v.status === 'Aprovada' ? 'receita' : 'despesa'}">${v.status}</span></td>
          <td>${formatarMoeda(v.valor)}</td>
          <td>
            ${v.status === 'Pendente' ? `<button class="btn-primary protecao-edicao" style="padding:4px 8px; font-size:11px; margin-right:4px;" onclick="aprovarVenda(${v.id})">Aprovar</button>` : ''}
            <button class="btn-del" onclick="excluirVenda(${v.id})">Excluir</button>
          </td>
        </tr>
      `;
    });
    if (vendas.length === 0) {
      tbodyVendas.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:28px;">Nenhum pedido registrado.</td></tr>`;
    }
  }

  const tbodyClientes = document.getElementById('tabela-clientes');
  if (tbodyClientes) {
    tbodyClientes.innerHTML = '';
    clientes.forEach(c => {
      tbodyClientes.innerHTML += `
        <tr>
          <td><strong>${c.nome}</strong></td>
          <td style="color: var(--text-muted);">${c.email}</td>
          <td>${c.tel}</td>
          <td><button class="btn-del" onclick="excluirCliente(${c.id})">Excluir</button></td>
        </tr>
      `;
    });
  }

  const impostoVenda = faturamento * (config.taxaVenda / 100);
  const impostoAds = gastosAds * (config.taxaAds / 100);
  const totalCustos = gastosAds + outrasDespesas + impostoVenda + impostoAds;
  const lucroLiquido = faturamento - totalCustos;

  const roas = gastosAds > 0 ? (faturamento / gastosAds) : 0;
  const roi = totalCustos > 0 ? ((faturamento - totalCustos) / totalCustos) : 0;
  const margem = faturamento > 0 ? ((lucroLiquido / faturamento) * 100) : 0;
  const arpu = qtdVendas > 0 ? (faturamento / qtdVendas) : 0;

  const alertBox = document.getElementById('smart-alert-box');
  const alertText = document.getElementById('smart-alert-text');
  if (alertBox && alertText) {
    if (gastosAds > 0 && roas < 1.5) {
      alertBox.style.display = 'flex';
      alertBox.className = 'smart-alert danger';
      alertText.innerText = `ROAS crítico (${roas.toFixed(2)}x). O investimento em anúncios está superando o retorno saudável esperado.`;
    } else if (lucroLiquido < 0) {
      alertBox.style.display = 'flex';
      alertBox.className = 'smart-alert danger';
      alertText.innerText = `Operação no vermelho! O lucro líquido atual está negativo (${formatarMoeda(lucroLiquido)}).`;
    } else {
      alertBox.style.display = 'none';
    }
  }

  if (document.getElementById('kpi-faturamento')) document.getElementById('kpi-faturamento').innerText = formatarMoeda(faturamento);
  if (document.getElementById('kpi-ads')) document.getElementById('kpi-ads').innerText = formatarMoeda(gastosAds);
  if (document.getElementById('kpi-roas')) document.getElementById('kpi-roas').innerText = roas.toFixed(2);
  if (document.getElementById('kpi-roi')) document.getElementById('kpi-roi').innerText = roi.toFixed(2);
  if (document.getElementById('kpi-margem')) document.getElementById('kpi-margem').innerText = `${margem.toFixed(1)}%`;

  if (document.getElementById('kpi-pendentes')) document.getElementById('kpi-pendentes').innerText = formatarMoeda(totalPendentes);
  if (document.getElementById('label-taxa-venda')) document.getElementById('label-taxa-venda').innerText = config.taxaVenda;
  if (document.getElementById('label-taxa-ads')) document.getElementById('label-taxa-ads').innerText = config.taxaAds;
  if (document.getElementById('kpi-imposto-venda')) document.getElementById('kpi-imposto-venda').innerText = formatarMoeda(impostoVenda);
  if (document.getElementById('kpi-imposto-ads')) document.getElementById('kpi-imposto-ads').innerText = formatarMoeda(impostoAds);
  if (document.getElementById('kpi-lucro')) document.getElementById('kpi-lucro').innerText = formatarMoeda(lucroLiquido);
  if (document.getElementById('kpi-arpu')) document.getElementById('kpi-arpu').innerText = formatarMoeda(arpu);

  const faturamentoGlobal = operacoes.filter(o => o.tipo === 'receita').reduce((acc, o) => acc + o.valor, 0);
  const pctMeta = Math.min((faturamentoGlobal / config.metaFixa) * 100, 100);
  if (document.getElementById('meta-texto')) document.getElementById('meta-texto').innerText = `${formatarMoeda(faturamentoGlobal)} / ${formatarMoeda(config.metaFixa)}`;
  if (document.getElementById('meta-barra')) document.getElementById('meta-barra').style.width = `${pctMeta}%`;

  renderizarGrafico(opsFiltradas);
  renderizarTendencia(opsFiltradas);
}

// --- GRÁFICO DE BARRAS (CANAIS) ---
function renderizarGrafico(lista = operacoes) {
  const canvas = document.getElementById('graficoPerformance');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const canais = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'Direto / Orgânico'];
  const receitasPorCanal = canais.map(c =>
    lista.filter(o => o.canal === c && o.tipo === 'receita').reduce((s, o) => s + o.valor, 0)
  );
  const gastosPorCanal = canais.map(c =>
    lista.filter(o => o.canal === c && o.tipo !== 'receita').reduce((s, o) => s + o.valor, 0)
  );

  if (graficoPerformance) graficoPerformance.destroy();

  graficoPerformance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: canais,
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: receitasPorCanal,
          backgroundColor: '#1d63ff',
          borderRadius: 6
        },
        {
          label: 'Investimento / Custos (R$)',
          data: gastosPorCanal,
          backgroundColor: '#22d3ee',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8ea4cc', font: { size: 12 } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8ea4cc' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8ea4cc' } }
      }
    }
  });
}

// --- GRÁFICO DE TENDÊNCIA TEMPORAL ---
function renderizarTendencia(lista = operacoes) {
  const canvas = document.getElementById('graficoTendencia');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const datasUnicas = [...new Set(lista.map(o => o.data))].sort((a, b) => converterDataBR(a) - converterDataBR(b));

  const faturamentoPorData = datasUnicas.map(data =>
    lista.filter(o => o.data === data && o.tipo === 'receita').reduce((s, o) => s + o.valor, 0)
  );

  const custosPorData = datasUnicas.map(data =>
    lista.filter(o => o.data === data && o.tipo !== 'receita').reduce((s, o) => s + o.valor, 0)
  );

  if (graficoTendencia) graficoTendencia.destroy();

  graficoTendencia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datasUnicas.length > 0 ? datasUnicas : ['Sem dados'],
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: faturamentoPorData.length > 0 ? faturamentoPorData : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        },
        {
          label: 'Custos / Ads (R$)',
          data: custosPorData.length > 0 ? custosPorData : [0],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8ea4cc', font: { size: 12 } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8ea4cc' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8ea4cc' } }
      }
    }
  });
}