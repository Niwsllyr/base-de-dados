let data = [];
let filteredData = [];

let pedidosChart, cidadesChart;

// ============================
// UPLOAD DO CSV
// ============================
document.getElementById("fileInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      data = results.data;
      filteredData = data;

      resetFilters();
      populateCityFilter(data);
      populateStationFilter();
      updateDashboard();
    }
  });
});

// ============================
// RESET
// ============================
function resetFilters() {
  document.getElementById("cityFilter").innerHTML =
    '<option value="">Todas cidades</option>';

  document.getElementById("stationFilter").innerHTML =
    '<option value="">Todas estações</option>';

  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
}

// ============================
// LIMPAR
// ============================
function clearFilters() {
  filteredData = data;

  resetFilters();
  populateCityFilter(data);
  populateStationFilter();

  updateDashboard();
}

// ============================
// CIDADES DINÂMICO
// ============================
function populateCityFilter(filtered = data) {
  const cities = [...new Set(filtered.map(d => d.buyer_address_city_name))];

  const select = document.getElementById("cityFilter");

  select.innerHTML = '<option value="">Todas cidades</option>';

  cities.forEach(city => {
    if (city) {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      select.appendChild(option);
    }
  });
}

// ============================
// ESTAÇÕES
// ============================
function populateStationFilter() {
  const stations = [...new Set(data.map(d => d.lm_station_name))];

  const select = document.getElementById("stationFilter");

  stations.forEach(station => {
    if (station) {
      const option = document.createElement("option");
      option.value = station;
      option.textContent = station;
      select.appendChild(option);
    }
  });
}

// ============================
// FILTRO DEPENDENTE
// ============================
document.getElementById("stationFilter").addEventListener("change", function() {
  const station = this.value;

  if (!station) {
    populateCityFilter(data);
    return;
  }

  const filtered = data.filter(d => d.lm_station_name === station);

  populateCityFilter(filtered);
});

// ============================
// APLICAR FILTROS
// ============================
function applyFilters() {
  const city = document.getElementById("cityFilter").value;
  const station = document.getElementById("stationFilter").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  filteredData = data.filter(d => {
    let valid = true;

    if (city && d.buyer_address_city_name !== city) valid = false;
    if (station && d.lm_station_name !== station) valid = false;

    if (startDate && new Date(d.created_at) < new Date(startDate)) valid = false;
    if (endDate && new Date(d.created_at) > new Date(endDate)) valid = false;

    return valid;
  });

  updateDashboard();
}

// ============================
// ATUALIZAR DASHBOARD
// ============================
function updateDashboard() {
  updateCards();
  renderCharts();
}

// ============================
// CARDS (CORRIGIDO)
// ============================
function updateCards() {
  const total = filteredData.length;

  // SLA INTELIGENTE
  const sla = filteredData.filter(d => {
    const val = String(d.in_sla_performance).toLowerCase();
    return val === "1" || val === "true" || val === "yes";
  }).length;

  // SOMA EM R$
  const holdValue = filteredData.reduce((sum, d) => {
    const value = parseFloat(d["cogs(SUM)"]) || 0;
    return sum + value;
  }, 0);

  document.getElementById("totalPedidos").innerText = total;

  document.getElementById("sla").innerText =
    total > 0 ? ((sla / total) * 100).toFixed(1) + "%" : "0%";

  document.getElementById("hold").innerText =
    "R$ " + holdValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2
    });
}

// ============================
// GRÁFICOS
// ============================
function renderCharts() {

  const porData = {};

  filteredData.forEach(d => {
    const date = d.created_at?.split(" ")[0];
    if (!date) return;

    porData[date] = (porData[date] || 0) + 1;
  });

  const datas = Object.keys(porData);
  const valores = Object.values(porData);

  if (pedidosChart) pedidosChart.destroy();

  pedidosChart = new Chart(document.getElementById("pedidosChart"), {
    type: "line",
    data: {
      labels: datas,
      datasets: [{
        label: "Pedidos por dia",
        data: valores,
        borderColor: "#ee4d2d",
        fill: false
      }]
    }
  });

  const porCidade = {};

  filteredData.forEach(d => {
    const city = d.buyer_address_city_name;
    if (!city) return;

    porCidade[city] = (porCidade[city] || 0) + 1;
  });

  const cidades = Object.keys(porCidade);
  const valoresCidade = Object.values(porCidade);

  if (cidadesChart) cidadesChart.destroy();

  cidadesChart = new Chart(document.getElementById("cidadesChart"), {
    type: "bar",
    data: {
      labels: cidades,
      datasets: [{
        label: "Pedidos por cidade",
        data: valoresCidade,
        backgroundColor: "#ee4d2d"
      }]
    }
  });
}