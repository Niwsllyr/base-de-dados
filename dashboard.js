import { processCSV } from './csvReader.js';
import { renderCharts } from './charts.js';
import { calculateMetrics } from './metrics.js';

const input = document.getElementById('csvInput');
const dsInput = document.getElementById('dsInput');
const driverSelect = document.getElementById('driverSelect');
const citySelect = document.getElementById('citySelect');
const statusSelect = document.getElementById('statusSelect');
const cityTableBody = document.getElementById('cityTableBody');

const btnGeneral = document.getElementById('btnGeneral');
const btnSLA = document.getElementById('btnSLA');
const btnDS = document.getElementById('btnDS');
const btnCity = document.getElementById('btnCity');

const homePage = document.getElementById('homePage');
const cityPage = document.getElementById('cityPage');

let rawData = [];
let dsData = [];

let currentMode = 'GENERAL';

const META_SLA = 98;

/* =========================
   CACHE DE MÉTRICAS
========================= */
const metricsCache = new Map();

function getMetrics(data, mode) {
  const key = mode + JSON.stringify(data);

  if (metricsCache.has(key)) {
    return metricsCache.get(key);
  }

  const result = calculateMetrics(data, mode);
  metricsCache.set(key, result);

  return result;
}

// =========================
// CACHE DINÂMICO DE CEP
// =========================
let dynamicCityMap = JSON.parse(localStorage.getItem('dynamicCityMap') || '{}');

const cityMap = {
  '65365-000': 'Zé Doca',
  '65272-000': 'Santa Luzia do Paruá',
  '65274-000': 'Nova Olinda do Maranhão',
  '65368-000': 'Araguanã',
  '65398-000': 'Alto Alegre do Pindaré',
  '65363-000': 'Gov. Newton Bello',
  '65385-000': 'São João do Carú',
  '65378-000': 'Tufilândia',
  '65380-000': 'Bom Jardim'
};

function normalizeCEP(cep) {
  if (!cep) return '';
  const clean = cep.toString().replace(/\D/g, '');
  if (clean.length !== 8) return '';
  return `${clean.slice(0,5)}-${clean.slice(5)}`;
}

async function getCityFromCEP(cep) {
  const formatted = normalizeCEP(cep);
  if (!formatted) return null;

  if (cityMap[formatted]) return cityMap[formatted];
  if (dynamicCityMap[formatted]) return dynamicCityMap[formatted];

  try {
    const raw = formatted.replace('-', '');
    const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    const data = await response.json();

    if (!data.erro && data.localidade) {
      dynamicCityMap[formatted] = data.localidade;
      localStorage.setItem('dynamicCityMap', JSON.stringify(dynamicCityMap));
      return data.localidade;
    }
  } catch (e) {
    console.error('Erro ao buscar CEP:', formatted);
  }

  return null;
}

async function enrichDataWithCities(data) {
  const ceps = [...new Set(data.map(r => r['Postal Code']).filter(Boolean))];

  await Promise.all(ceps.map(getCityFromCEP));
}

function resolveCity(cep) {
  const formatted = normalizeCEP(cep);
  return cityMap[formatted] || dynamicCityMap[formatted] || 'Não identificado';
}

function getSlaClass(sla) {
  const v = parseFloat(sla);
  if (v >= 98) return 'sla-green';
  if (v >= 95) return 'sla-yellow';
  return 'sla-red';
}

/* =========================
   FILTROS (COM DEBOUNCE)
========================= */
let debounceTimer;

function debounceFilter() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 200);
}

function applyFilters() {

  let filteredSLA = [...rawData];
  let filteredDS = [...dsData];

  if (driverSelect.value) {
    filteredSLA = filteredSLA.filter(r => r['Driver Name'] === driverSelect.value);
    filteredDS = filteredDS.filter(r => r['Driver Name'] === driverSelect.value);
  }

  if (citySelect.value) {
    filteredSLA = filteredSLA.filter(r => resolveCity(r['Postal Code']) === citySelect.value);
    filteredDS = filteredDS.filter(r => resolveCity(r['Postal Code']) === citySelect.value);
  }

  if (statusSelect.value) {
    filteredSLA = filteredSLA.filter(r => r['Status'] === statusSelect.value);
    filteredDS = filteredDS.filter(r => r['Status'] === statusSelect.value);
  }

  updateByMode({ sla: filteredSLA, ds: filteredDS });
}

/* =========================
   ATUALIZA DASHBOARD
========================= */
function updateByMode({ sla, ds }) {

  const baseRaw = currentMode === 'DS' ? ds : sla;

  const cardMeta = document.getElementById('cardMeta');
  const cardDiff = document.getElementById('cardDiff');
  const cardScore = document.getElementById('cardScore');

  if (currentMode === 'GENERAL') {

    cardMeta.style.display = 'none';
    cardDiff.style.display = 'none';
    cardScore.style.display = 'none';

    const slaResult = getMetrics(sla, 'SLA');
    const dsResult = getMetrics(ds, 'DS');

    const slaVal = parseFloat(slaResult.sla) || 0;
    const dsVal = parseFloat(dsResult.sla) || 0;

    document.getElementById('kpiTotal').innerText = slaResult.total;
    document.getElementById('kpiDelivered').innerText = slaResult.delivered;
    document.getElementById('kpiPending').innerText = slaResult.pending;
    document.getElementById('kpiSla').innerText = slaVal + '%';

    document.getElementById('kpiSlaCard').className =
      'kpi ' + getSlaClass(slaVal);

    document.getElementById('kpiDs').innerText = dsVal + '%';
    document.getElementById('kpiDsCard').className =
      'kpi ' + getSlaClass(dsVal);

    const diff = (dsVal - slaVal).toFixed(2);
    document.getElementById('kpiDiff').innerText =
      (diff > 0 ? '+' : '') + diff + '%';

    let alerta = '';

    if (slaVal >= META_SLA && dsVal >= META_SLA) {
      alerta = '✅ Meta batida (SLA e DS)';
    } 
    else if (slaVal >= META_SLA && dsVal < META_SLA) {
      alerta = '⚠️ SLA OK, mas DS abaixo da meta';
    } 
    else if (slaVal < META_SLA && dsVal >= META_SLA) {
      alerta = '⚠️ DS OK, mas SLA abaixo da meta';
    } 
    else {
      alerta = '🚨 SLA e DS abaixo da meta';
    }

    document.getElementById('kpiAlert').innerText = alerta;
    document.getElementById('kpiForecast').innerText = '-';

    renderCharts(
      { ...slaResult, driverSLA: slaResult.driverSLA, citySLA: slaResult.citySLA },
      currentMode,
      { status: statusSelect.value, rawData: baseRaw }
    );

    renderDriverRanking(sla);
    return;
  }

  cardMeta.style.display = 'none';
  cardDiff.style.display = 'none';
  cardScore.style.display = 'block';

  let result;
  if (currentMode === 'SLA') result = getMetrics(sla, 'SLA');
  if (currentMode === 'DS') result = getMetrics(ds, 'DS');

  document.getElementById('kpiTotal').innerText = result.total;
  document.getElementById('kpiDelivered').innerText = result.delivered;
  document.getElementById('kpiPending').innerText = result.pending;

  if (currentMode === 'SLA') {
    document.getElementById('kpiSla').innerText = result.sla + '%';
    document.getElementById('kpiSlaCard').className = 'kpi ' + getSlaClass(result.sla);
    document.getElementById('kpiSlaCard').style.display = 'block';
    document.getElementById('kpiDsCard').style.display = 'none';
  } else {
    document.getElementById('kpiDs').innerText = result.sla + '%';
    document.getElementById('kpiDsCard').className = 'kpi ' + getSlaClass(result.sla);
    document.getElementById('kpiDsCard').style.display = 'block';
    document.getElementById('kpiSlaCard').style.display = 'none';
  }

  let alerta = parseFloat(result.sla) < META_SLA
    ? '🚨 Abaixo da meta (98%)'
    : '✅ Meta batida';

  document.getElementById('kpiAlert').innerText = alerta;
  document.getElementById('kpiScore').innerText = result.sla;

  renderCharts(
    { ...result, driverSLA: result.driverSLA, citySLA: result.citySLA },
    currentMode,
    { status: statusSelect.value, rawData: baseRaw }
  );

  renderDriverTable(baseRaw);
}

/* =========================
   TABELAS OTIMIZADAS
========================= */
function renderDriverRanking(data) {
  const result = getMetrics(data, 'SLA');

  let html = '';

  result.driverSLA
    .sort((a, b) => b.total - a.total)
    .forEach((driver, index) => {

      let medal = '';
      if (index === 0) medal = '🥇';
      else if (index === 1) medal = '🥈';
      else if (index === 2) medal = '🥉';

      html += `
        <tr>
          <td>${medal} ${driver.name}</td>
          <td>${driver.total}</td>
          <td>${driver.delivered}</td>
          <td>${driver.pending}</td>
          <td class="${getSlaClass(driver.sla)}">${driver.sla}%</td>
        </tr>
      `;
    });

  cityTableBody.innerHTML = html;
}

function renderDriverTable(data) {
  const result = getMetrics(data, 'SLA');

  let html = '';

  result.driverSLA.forEach(driver => {
    html += `
      <tr>
        <td>${driver.name}</td>
        <td>${driver.total}</td>
        <td>${driver.delivered}</td>
        <td>${driver.pending}</td>
        <td class="${getSlaClass(driver.sla)}">${driver.sla}%</td>
      </tr>
    `;
  });

  cityTableBody.innerHTML = html;
}

/* =========================
   LOAD CSV
========================= */
input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  rawData = await processCSV(file);
  await enrichDataWithCities(rawData);

  const drivers = [...new Set(rawData.map(r => r['Driver Name']).filter(Boolean))];
  driverSelect.innerHTML = '<option value="">Todos os Entregadores</option>';
  drivers.forEach(d => driverSelect.innerHTML += `<option value="${d}">${d}</option>`);

  const cities = [...new Set(rawData.map(r => resolveCity(r['Postal Code'])).filter(Boolean))];
  citySelect.innerHTML = '<option value="">Todas as Cidades</option>';
  cities.forEach(c => citySelect.innerHTML += `<option value="${c}">${c}</option>`);

  const statuses = [...new Set(rawData.map(r => r['Status']).filter(Boolean))];
  statusSelect.innerHTML = '<option value="">Todos Status</option>';
  statuses.forEach(s => statusSelect.innerHTML += `<option value="${s}">${s}</option>`);

  applyFilters();
});

dsInput.addEventListener('change', async (e) => {
  dsData = await processCSV(e.target.files[0]);
  await enrichDataWithCities(dsData);
  applyFilters();
});

/* 🔥 AQUI FOI CORRIGIDO (REMOVE DUPLICAÇÃO) */
driverSelect.addEventListener('change', debounceFilter);
citySelect.addEventListener('change', debounceFilter);
statusSelect.addEventListener('change', debounceFilter);

/* =========================
   NAV
========================= */
function setActiveButton(btn) {
  [btnGeneral, btnSLA, btnDS, btnCity].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

btnGeneral.onclick = () => {
  currentMode = 'GENERAL';

  document.getElementById('kpiSlaCard').style.display = 'block';
  document.getElementById('kpiDsCard').style.display = 'block';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnGeneral);
  applyFilters();
};

btnSLA.onclick = () => {
  currentMode = 'SLA';

  document.getElementById('kpiSlaCard').style.display = 'block';
  document.getElementById('kpiDsCard').style.display = 'none';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnSLA);
  applyFilters();
};

btnDS.onclick = () => {
  currentMode = 'DS';

  document.getElementById('kpiDsCard').style.display = 'block';
  document.getElementById('kpiSlaCard').style.display = 'none';

  homePage.style.display = 'grid';
  cityPage.style.display = 'none';
  setActiveButton(btnDS);
  applyFilters();
};

btnCity.onclick = () => {
  homePage.style.display = 'none';
  cityPage.style.display = 'block';
  setActiveButton(btnCity);
};

function exportDashboard() {
  const element = document.getElementById('homePage');

  document.body.classList.add('export-mode');

  html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  }).then(canvas => {

    document.body.classList.remove('export-mode');

    const link = document.createElement('a');
    link.download = 'dashboard.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

window.handleStatusClick = function(status) {

  const dataBase = currentMode === 'DS' ? dsData : rawData;

  const filtrados = dataBase.filter(r => r['Status'] === status);

  const agrupado = {};

  filtrados.forEach(row => {
    const driver = row['Driver Name'] || 'Sem nome';
    const br = row['Order ID'] || 'Sem código';
    if (!agrupado[driver]) {
      agrupado[driver] = [];
    }

    agrupado[driver].push(br);
  });

  renderStatusPage(status, agrupado);
};

function renderStatusPage(status, data) {

  homePage.style.display = 'none';
  cityPage.style.display = 'none';

  let page = document.getElementById('statusPage');

  if (!page) {
    page = document.createElement('section');
    page.id = 'statusPage';
    page.className = 'table-page';

    page.innerHTML = `
      <div class="card table-card">
        <h2 id="statusTitle"></h2>
        <button onclick="voltarDashboard()">⬅ Voltar</button>
        <div id="statusContent"></div>
      </div>
    `;

    document.querySelector('.dashboard').appendChild(page);
  }

  page.style.display = 'block';

  document.getElementById('statusTitle').innerText =
    `Status: ${status}`;

  const container = document.getElementById('statusContent');
  container.innerHTML = '';

  Object.entries(data).forEach(([driver, brs]) => {

    const div = document.createElement('div');
    div.className = 'driver-block';

    div.innerHTML = `
      <h3>${driver}</h3>
      <p>${brs.join('<br>')}</p>
    `;

    container.appendChild(div);
  });
}

window.voltarDashboard = function() {
  document.getElementById('statusPage').style.display = 'none';
  homePage.style.display = 'grid';
};