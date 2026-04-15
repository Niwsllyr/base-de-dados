let data = [];
let filteredData = [];

let cidadesChart, slaChart;

let cityChoice, stationChoice, stationNameChoice;

// ============================
function normalize(val) {
  return String(val || "").toLowerCase().trim();
}

// ============================
function isDentroSLA(val) {
  val = normalize(val);
  return val.includes("first") ||
         val.includes("second") ||
         val.includes("third");
}

// ============================
function isForaSLA(val) {
  val = normalize(val);
  return val.includes("out") || val.includes("nyd");
}

// ============================
function isOnHold(val) {
  return normalize(val).includes("onhold");
}

// ============================
function initChoices() {
  if (cityChoice) cityChoice.destroy();
  if (stationChoice) stationChoice.destroy();
  if (stationNameChoice) stationNameChoice.destroy();

  cityChoice = new Choices("#cityFilter", { searchEnabled: true, itemSelectText: '' });
  stationChoice = new Choices("#stationFilter", { searchEnabled: true, itemSelectText: '' });
  stationNameChoice = new Choices("#stationNameFilter", { searchEnabled: true, itemSelectText: '' });
}

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

      populateCityFilter(data);
      populateStationFilter();
      populateStationNameFilter();

      initChoices();
      updateDashboard();
    }
  });
});

// ============================
function clearFilters() {
  filteredData = data;

  populateCityFilter(data);
  populateStationFilter();
  populateStationNameFilter();

  initChoices();
  updateDashboard();
}

// ============================
function populateCityFilter(filtered = data) {
  const cities = [...new Set(filtered.map(d => d.buyer_address_city_name))]
    .filter(Boolean)
    .sort();

  const select = document.getElementById("cityFilter");
  select.innerHTML = '<option value="">Todas cidades</option>';

  cities.forEach(city => {
    select.innerHTML += `<option value="${city}">${city}</option>`;
  });
}

// ============================
function populateStationFilter() {
  const stations = [...new Set(data.map(d => d.lm_station_name))]
    .filter(Boolean)
    .sort();

  const select = document.getElementById("stationFilter");
  select.innerHTML = '<option value="">Todas estações</option>';

  stations.forEach(s => {
    select.innerHTML += `<option value="${s}">${s}</option>`;
  });
}

// ============================
function populateStationNameFilter(filtered = data) {
  const names = [...new Set(filtered.map(d => d.station_name))]
    .filter(Boolean)
    .sort();

  const select = document.getElementById("stationNameFilter");
  select.innerHTML = '<option value="">Todos</option>';

  names.forEach(n => {
    select.innerHTML += `<option value="${n}">${n}</option>`;
  });
}

// ============================
function applyFilters() {
  const city = document.getElementById("cityFilter").value;
  const station = document.getElementById("stationFilter").value;
  const stationName = document.getElementById("stationNameFilter").value;

  filteredData = data.filter(d => {
    return (!city || d.buyer_address_city_name === city) &&
           (!station || d.lm_station_name === station) &&
           (!stationName || d.station_name === stationName);
  });

  updateDashboard();
}

// ============================
function updateDashboard() {
  updateCards();
  renderCidadesChart();
  renderSLAChart();
}

// ============================
function updateCards() {
  const total = filteredData.length;

  const dentro = filteredData.filter(d => isDentroSLA(d.in_sla_performance)).length;
  const fora = filteredData.filter(d => isForaSLA(d.in_sla_performance)).length;
  const holdQtd = filteredData.filter(d => isOnHold(d.in_sla_performance)).length;

  const dentroPercent = total ? ((dentro / total) * 100).toFixed(1) : "0";
  const foraPercent = total ? ((fora / total) * 100).toFixed(1) : "0";

  document.getElementById("totalPedidos").innerText = total;
  document.getElementById("slaDentro").innerText = dentroPercent + "%";
  document.getElementById("slaFora").innerText = foraPercent + "%";
  document.getElementById("hold").innerText = holdQtd;
}

// ============================
function renderCidadesChart() {

  const porCidade = {};
  filteredData.forEach(d => {
    const city = d.buyer_address_city_name;
    if (!city) return;
    porCidade[city] = (porCidade[city] || 0) + 1;
  });

  if (cidadesChart) cidadesChart.destroy();

  cidadesChart = new Chart(document.getElementById("cidadesChart"), {
    type: "bar",
    data: {
      labels: Object.keys(porCidade),
      datasets: [{
        data: Object.values(porCidade),
        backgroundColor: "#ee4d2d",
        borderRadius: 6
      }]
    },
    options: getChartOptions("Cidade")
  });
}

// ============================
function renderSLAChart() {

  const slaTipos = {
    "First Rule": 0,
    "Second Rule": 0,
    "Third Rule": 0,
    "Out Performance": 0,
    "OnHold": 0,
    "NYD": 0
  };

  filteredData.forEach(d => {
    let val = normalize(d.in_sla_performance);

    if (val.includes("first")) slaTipos["First Rule"]++;
    else if (val.includes("second")) slaTipos["Second Rule"]++;
    else if (val.includes("third")) slaTipos["Third Rule"]++;
    else if (val.includes("out")) slaTipos["Out Performance"]++;
    else if (val.includes("onhold")) slaTipos["OnHold"]++;
    else if (val.includes("nyd")) slaTipos["NYD"]++;
  });

  if (slaChart) slaChart.destroy();

  slaChart = new Chart(document.getElementById("slaChart"), {
    type: "bar",
    data: {
      labels: Object.keys(slaTipos),
      datasets: [{
        data: Object.values(slaTipos),
        backgroundColor: [
          "#22c55e","#4ade80","#86efac",
          "#ef4444","#f97316","#9ca3af"
        ]
      }]
    },
    options: getChartOptions("SLA")
  });
}

// ============================
// 🔥 TOOLTIP PROFISSIONAL
function getChartOptions(labelName) {
  return {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      tooltip: {
        backgroundColor: "#020617",
        borderColor: "#334155",
        borderWidth: 1,
        padding: 12,

        callbacks: {

          // 🔥 TÍTULO
          title: function(context) {
            return `${labelName}: ${context[0].label}`;
          },

          // 🔥 CONTEÚDO COMPLETO
          label: function(context) {

            const value = context.raw;
            const data = context.chart.data.datasets[0].data;

            const total = data.reduce((a, b) => a + b, 0);
            const percent = total ? ((value / total) * 100).toFixed(1) : 0;

            let extra = "";

            // 🔥 INFO EXTRA PARA SLA
            if (labelName === "SLA") {
              const label = context.label.toLowerCase();

              if (label.includes("first") || label.includes("second") || label.includes("third")) {
                extra = "🟢 Dentro do SLA";
              } else if (label.includes("out") || label.includes("nyd")) {
                extra = "🔴 Fora do SLA";
              } else if (label.includes("onhold")) {
                extra = "🟠 Em espera (OnHold)";
              }
            }

            return [
              `📦 Pedidos: ${value}`,
              `📊 Participação: ${percent}%`,
              `📈 Total geral: ${total}`,
              extra
            ];
          }
        }
      },

      legend: {
        display: false
      }
    },

    interaction: {
      mode: 'index',
      intersect: false
    }
  };
}