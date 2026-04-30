export function calculateMetrics(data, mode = 'SLA') {

  let total = 0;
  let delivered = 0;
  let onHold = 0;

  const statusMap = {};
  const driverMap = {};
  const cityMapInternal = {};

  // =========================
  // MAPA FIXO + DINÂMICO
  // =========================
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

  const dynamicCityMap = JSON.parse(localStorage.getItem('dynamicCityMap') || '{}');

  function normalizeCEP(cep) {
    if (!cep) return '';
    const clean = cep.toString().replace(/\D/g, '');
    if (clean.length !== 8) return '';
    return `${clean.slice(0,5)}-${clean.slice(5)}`;
  }

  function resolveCity(cep) {
    const formatted = normalizeCEP(cep);
    return cityMap[formatted] || dynamicCityMap[formatted] || 'Não identificado';
  }

  data.forEach(row => {

    const status = row['Status'];
    const driver = row['Driver Name'];
    const city = resolveCity(row['Postal Code']);

    if (!status) return;

    const cleanStatus = status.toString().trim();
    const statusLower = cleanStatus.toLowerCase();

    total++;

    statusMap[cleanStatus] =
      (statusMap[cleanStatus] || 0) + 1;

    if (statusLower === 'onhold') {
      onHold++;
    }

    const isDelivered =
      statusLower === 'delivered' ||
      statusLower.endsWith('_delivered');

    if (isDelivered) {
      delivered++;
    }

    /* =========================
       DRIVER
    ========================= */
    if (driver) {
      if (!driverMap[driver]) {
        driverMap[driver] = { total: 0, delivered: 0 };
      }

      if (mode === 'SLA') {
        if (statusLower !== 'onhold') {
          driverMap[driver].total++;
        }
      } else {
        driverMap[driver].total++;
      }

      if (isDelivered) {
        driverMap[driver].delivered++;
      }
    }

    /* =========================
       CITY
    ========================= */
    if (city) {
      if (!cityMapInternal[city]) {
        cityMapInternal[city] = { total: 0, delivered: 0 };
      }

      if (mode === 'SLA') {
        if (statusLower !== 'onhold') {
          cityMapInternal[city].total++;
        }
      } else {
        cityMapInternal[city].total++;
      }

      if (isDelivered) {
        cityMapInternal[city].delivered++;
      }
    }

  });

  /* =========================
     CÁLCULOS FINAIS
  ========================= */

  let validBase;

  if (mode === 'SLA') {
    validBase = total - onHold;
  } else {
    validBase = total;
  }

  const pending = validBase - delivered;

  const sla = validBase > 0
    ? ((delivered / validBase) * 100).toFixed(2)
    : 0;

  const driverSLA = Object.entries(driverMap).map(([name, info]) => ({
    name,
    total: info.total,
    delivered: info.delivered,
    pending: info.total - info.delivered,
    sla: info.total > 0
      ? ((info.delivered / info.total) * 100).toFixed(1)
      : 0
  }));

  const citySLA = Object.entries(cityMapInternal).map(([name, info]) => ({
    name,
    total: info.total,
    delivered: info.delivered,
    pending: info.total - info.delivered,
    sla: info.total > 0
      ? ((info.delivered / info.total) * 100).toFixed(1)
      : 0
  }));

  return {
    total: validBase,
    delivered,
    pending,
    sla,
    statusMap,
    driverSLA,
    citySLA
  };
}