let data = [];
let filteredData = [];

let pedidosChart, cidadesChart;

// ============================
// FUNÇÃO PRA DINHEIRO
// ============================
function parseMoney(value) {
  if (!value) return 0;
  value = value.toString().replace(/\./g, "").replace(",", ".");
  return parseFloat(value) || 0;
}

// ============================
// UPLOAD
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
      populateStationNameFilter();
      updateDashboard();
    }
  });
});

// ============================
function resetFilters() {
  document.getElementById("cityFilter").innerHTML =
    '<option value="">Todas cidades</option>';

  document.getElementById("stationFilter").innerHTML =
    '<option value="">Todas estações</option>';

  document.getElementById("stationNameFilter").innerHTML =
    '<option value="">Todos os Station Names</option>';

  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
}

// ============================
function clearFilters() {
  filteredData = data;

  resetFilters();
  populateCityFilter(data);
  populateStationFilter();
  populateStationNameFilter();

  updateDashboard();
}

// ============================
// CIDADES
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
// ESTAÇÕES (lm_station_name)
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
// NOVO: STATION NAME (coluna F)
// ============================
function populateStationNameFilter(filtered = data) {
  const stationNames = [...new Set(filtered.map(d => d.station_name))];

  const select = document.getElementById("stationNameFilter");
  select.innerHTML = '<option value="">Todos os Station Names</option>';

  stationNames.forEach(name => {
    if (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
  });
}

// ============================
// FILTRO INTELIGENTE (ESTAÇÃO -> CIDADE + STATION NAME)
// ============================
document.getElementById("stationFilter").addEventListener("change", function() {
  const station = this.value;

  if (!station) {
    populateCityFilter(data);
    populateStationNameFilter(data);
    return;
  }

  const filtered = data.filter(d => d.lm_station_name === station);

  populateCityFilter(filtered);
  populateStationNameFilter(filtered);
});

// ============================
// FILTROS
// ============================
function applyFilters() {
  const city = document.getElementById("cityFilter").value;
  const station = document.getElementById("stationFilter").value;
  const stationName = document.getElementById("stationNameFilter").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  filteredData = data.filter(d => {
    let valid = true;

    if (city && d.buyer_address_city_name !== city) valid = false;
    if (station && d.lm_station_name !== station) valid = false;
    if (stationName && d.station_name !== stationName) valid = false;

    if (startDate && new Date(d.created_at) < new Date(startDate)) valid = false;
    if (endDate && new Date(d.created_at) > new Date(endDate)) valid = false;

    return valid;
  });

  updateDashboard();
}

// ============================
// DASHBOARD
// ============================
function updateDashboard() {
  updateCards();
  renderCharts();
}

// ============================
// CARDS
// ============================
function updateCards() {
  const total = filteredData.length;

  const sla = filteredData.filter(d => {
    const val = String(d.in_sla_performance).toLowerCase().trim();
    return val !== "" && val !== "0" && val !== "false" && val !== "no";
  }).length;

  const holdValue = filteredData.reduce((sum, d) => {
    return sum + parseMoney(d["cogs(SUM)"]);
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