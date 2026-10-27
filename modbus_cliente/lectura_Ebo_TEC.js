const ModbusRTU = require("modbus-serial");

const TEC_TIMEOUT_MS = parseEnvNumber(process.env.MODBUS_TEC_TIMEOUT_MS, 8000);
const TEC_FLOAT_WORD_ORDER = normalizeWordOrder(
  process.env.MODBUS_TEC_FLOAT_WORD_ORDER || process.env.MODBUS_FLOAT_WORD_ORDER || "ABCD"
);

const PM_FIELDS = [
  { metricKey: "voltage_a_n", unit: "V" },
  { metricKey: "voltage_b_n", unit: "V" },
  { metricKey: "voltage_c_n", unit: "V" },
  { metricKey: "voltage_a_b", unit: "V" },
  { metricKey: "voltage_b_c", unit: "V" },
  { metricKey: "voltage_c_a", unit: "V" },
  { metricKey: "current_a", unit: "A" },
  { metricKey: "current_b", unit: "A" },
  { metricKey: "current_c", unit: "A" },
  { metricKey: "frequency", unit: "Hz" },
  { metricKey: "demand_total", unit: "kW" }
];

const ANALYZER_FIELDS = [
  { metricKey: "active_power_a", unit: "kW" },
  { metricKey: "active_power_b", unit: "kW" },
  { metricKey: "active_power_c", unit: "kW" },
  { metricKey: "active_power_total", unit: "kW" },
  { metricKey: "apparent_power_a", unit: "kVA" },
  { metricKey: "apparent_power_b", unit: "kVA" },
  { metricKey: "apparent_power_c", unit: "kVA" },
  { metricKey: "apparent_power_del_a_peak_demand", unit: "kVA" },
  { metricKey: "apparent_power_del_b_peak_demand", unit: "kVA" },
  { metricKey: "apparent_power_del_c_peak_demand", unit: "kVA" },
  { metricKey: "apparent_power_total", unit: "kVA" },
  { metricKey: "apparent_power_total_peak_demand", unit: "kVA" },
  { metricKey: "current_a", unit: "A" },
  { metricKey: "current_b", unit: "A" },
  { metricKey: "current_c", unit: "A" },
  { metricKey: "power_factor_total", unit: "pf" },
  { metricKey: "frequency", unit: "Hz" },
  { metricKey: "power_factor_a", unit: "pf" },
  { metricKey: "power_factor_b", unit: "pf" },
  { metricKey: "power_factor_c", unit: "pf" },
  { metricKey: "short_term_flicker_pst_a_n", unit: "Pst" },
  { metricKey: "short_term_flicker_pst_b_n", unit: "Pst" },
  { metricKey: "short_term_flicker_pst_c_n", unit: "Pst" },
  { metricKey: "thd_current_a_high", unit: "%" },
  { metricKey: "thd_current_b_high", unit: "%" },
  { metricKey: "thd_current_c_high", unit: "%" },
  { metricKey: "thd_voltage_v1_high", unit: "%" },
  { metricKey: "thd_voltage_v2_high", unit: "%" },
  { metricKey: "thd_voltage_v3_high", unit: "%" },
  { metricKey: "voltage_a_b", unit: "V" },
  { metricKey: "voltage_a_n", unit: "V" },
  { metricKey: "voltage_b_c", unit: "V" },
  { metricKey: "voltage_b_n", unit: "V" },
  { metricKey: "voltage_c_a", unit: "V" },
  { metricKey: "voltage_c_n", unit: "V" }
];

const ANALYZER_QUALITY_FIELDS = ANALYZER_FIELDS.slice(20);

const GENERATOR_FIELDS = [
  { metricKey: "active_fault_type", unit: "code" },
  { metricKey: "alternator_l1_current", unit: "A" },
  { metricKey: "alternator_l1_l2_voltage", unit: "V" },
  { metricKey: "alternator_l1_n_voltage", unit: "V" },
  { metricKey: "alternator_l2_current", unit: "A" },
  { metricKey: "alternator_l2_l3_voltage", unit: "V" },
  { metricKey: "alternator_l2_n_voltage", unit: "V" },
  { metricKey: "alternator_l3_current", unit: "A" },
  { metricKey: "alternator_l3_l1_voltage", unit: "V" },
  { metricKey: "alternator_l3_n_voltage", unit: "V" },
  { metricKey: "alternator_voltage_average", unit: "V" },
  { metricKey: "battery_voltage", unit: "V" },
  { metricKey: "coolant_temperature", unit: "C" },
  { metricKey: "engine_run_time_high_byte", unit: "h" },
  { metricKey: "engine_speed", unit: "RPM" },
  { metricKey: "frequency", unit: "Hz" },
  { metricKey: "lta_temperature", unit: "C" },
  { metricKey: "oil_pressure", unit: "kPa" },
  { metricKey: "operation_mode_switch_position", unit: "state" },
  { metricKey: "total_runs", unit: "count" }
];

const COMMON_TAGS = {
  building: "Principal",
  floor: "1",
  group: "Disponibilidad y Calidad de Energía",
  room: "Principal",
  fase_energy: "Trifásica"
};

const DEVICE_CONFIG = {
  meter1: {
    device_id: "tec_medidor_energia_1",
    name: "MEDIDOR DE ENERGIA 1",
    type: "power_meter",
    model: "2130",
    start: 101,
    end: 121,
    host: process.env.MODBUS_TEC_METER_1_HOST || "10.10.30.10",
    port: parseEnvNumber(process.env.MODBUS_TEC_METER_1_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_METER_1_ID, 2),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_METER_1_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code_inventory: "TEC003",
    code: "TEC001",
    area: ""
  },
  meter2: {
    device_id: "tec_medidor_energia_2",
    name: "MEDIDOR DE ENERGIA 2",
    type: "power_meter",
    model: "2130",
    start: 123,
    end: 143,
    host: process.env.MODBUS_TEC_METER_2_HOST || "10.10.30.10",
    port: parseEnvNumber(process.env.MODBUS_TEC_METER_2_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_METER_2_ID, 3),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_METER_2_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code_inventory: "TEC004",
    code: "TEC002",
    area: ""
  },
  analyzer1: {
    device_id: "tec_analizador_energia_1",
    name: "ANALIZADOR DE ENERGIA 1",
    type: "energy_analyzer",
    model: "ION7400",
    start: 255,
    end: 323,
    host: process.env.MODBUS_TEC_ANALYZER_1_HOST || "10.10.30.11",
    port: parseEnvNumber(process.env.MODBUS_TEC_ANALYZER_1_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_ANALYZER_1_ID, 1),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_ANALYZER_1_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code_inventory: "TEC001",
    code: "TEC001",
    area: "Cuarto eléctrico"
  },
  analyzer2: {
    device_id: "tec_analizador_energia_2",
    name: "ANALIZADOR DE ENERGIA 2",
    type: "energy_analyzer",
    model: "ION7400",
    start: 325,
    end: 397,
    host: process.env.MODBUS_TEC_ANALYZER_2_HOST || "10.10.30.12",
    port: parseEnvNumber(process.env.MODBUS_TEC_ANALYZER_2_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_ANALYZER_2_ID, 1),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_ANALYZER_2_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code_inventory: "TEC002",
    code: "TEC002",
    area: "Cuarto eléctrico"
  },
  generator1: {
    device_id: "GEN01",
    name: "GEN01",
    type: "electric_generator",
    model: "",
    start: 175,
    end: 213,
    host: process.env.MODBUS_TEC_GENERATOR_1_HOST || "10.10.30.11",
    port: parseEnvNumber(process.env.MODBUS_TEC_GENERATOR_1_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_GENERATOR_1_ID, 10),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_GENERATOR_1_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code: "TEC001",
    area: "Cuarto eléctrico"
  },
  generator2: {
    device_id: "GEN02",
    name: "GEN02",
    type: "electric_generator",
    model: "",
    start: 215,
    end: 253,
    host: process.env.MODBUS_TEC_GENERATOR_2_HOST || "10.10.30.12",
    port: parseEnvNumber(process.env.MODBUS_TEC_GENERATOR_2_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_TEC_GENERATOR_2_ID, 11),
    wordOrder: normalizeWordOrder(process.env.MODBUS_TEC_GENERATOR_2_WORD_ORDER || TEC_FLOAT_WORD_ORDER),
    code: "TEC002",
    area: "Cuarto eléctrico"
  }
};

const VIGILANT_CONFIG = [
  {
    device_id: "vigilante_analizador-1",
    name: "vigilante_analizador-1",
    code: "TEC001",
    area: "Cuarto eléctrico",
    connection: "analyzer1",
    registers: {
      s1_commercial_energy_status: 695,
      s2_generator_energy_status: 697,
      s1_commercial_transition_count: 5781,
      s2_generator_transition_count: 5783
    }
  },
  {
    device_id: "vigilante_analizador-2",
    name: "vigilante_analizador-2",
    code: "TEC002",
    area: "Cuarto eléctrico",
    connection: "analyzer2",
    registers: {
      s1_commercial_energy_status: 587,
      s2_generator_energy_status: 589,
      s1_commercial_transition_count: 5785,
      s2_generator_transition_count: 5787
    }
  }
];

let readQueue = Promise.resolve();

function parseEnvNumber(value, fallback) {
  if (value == null) return fallback;
  const text = String(value).split("//")[0].split("#")[0].trim();
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWordOrder(value) {
  const text = String(value || "").toUpperCase();
  return ["CDAB", "SWAP", "BA", "DCBA"].includes(text) ? "CDAB" : "ABCD";
}

function roundToTwo(value) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
}

function decodeFloat32(hi, lo, wordOrder = TEC_FLOAT_WORD_ORDER) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return 0;
  const buffer = Buffer.alloc(4);
  if (wordOrder === "CDAB") {
    buffer.writeUInt16BE(lo & 0xffff, 0);
    buffer.writeUInt16BE(hi & 0xffff, 2);
  } else {
    buffer.writeUInt16BE(hi & 0xffff, 0);
    buffer.writeUInt16BE(lo & 0xffff, 2);
  }
  const value = buffer.readFloatBE(0);
  return roundToTwo(Number.isFinite(value) ? value : 0);
}

function buildMetrics(data, fields, startRegister, wordOrder, registerResolver) {
  const metrics = {};
  fields.forEach((field, index) => {
    const register = registerResolver ? registerResolver(index) : startRegister + (index * 2);
    const offset = register - startRegister;
    metrics[field.metricKey] = {
      value: decodeFloat32(data[offset], data[offset + 1], wordOrder),
      unit: field.unit
    };
  });
  return metrics;
}

function buildAnalyzer2Metrics(data, wordOrder) {
  const metrics = {};
  ANALYZER_FIELDS.slice(0, 20).forEach((field, index) => {
    const offset = index * 2;
    metrics[field.metricKey] = {
      value: decodeFloat32(data[offset], data[offset + 1], wordOrder),
      unit: field.unit
    };
  });
  ANALYZER_QUALITY_FIELDS.forEach((field, index) => {
    const register = 369 + (index * 2);
    const offset = register - DEVICE_CONFIG.analyzer2.start;
    metrics[field.metricKey] = {
      value: decodeFloat32(data[offset], data[offset + 1], wordOrder),
      unit: field.unit
    };
  });
  return metrics;
}

function buildGeneratorMetrics(data, startRegister, wordOrder) {
  const metrics = buildMetrics(data, GENERATOR_FIELDS, startRegister, wordOrder);
  metrics.total_runs_1 = {
    value: metrics.total_runs.value,
    unit: "count"
  };
  return metrics;
}

function devicePayload(config, metrics) {
  return {
    device_id: config.device_id,
    name: config.name,
    type: config.type,
    model: config.model,
    online: "true",
    area: config.area,
    ...COMMON_TAGS,
    ...(config.code_inventory ? { code_inventory: config.code_inventory } : {}),
    code: config.code,
    metrics
  };
}

async function connectTecClient(config) {
  const client = new ModbusRTU();
  await client.connectTCP(config.host, {
    port: config.port,
    timeout: TEC_TIMEOUT_MS
  });
  client.setID(config.unitId);
  client.setTimeout(TEC_TIMEOUT_MS);
  return client;
}

async function closeClient(client) {
  if (!client) return;
  try {
    if (typeof client.close === "function") {
      await client.close();
    } else if (client._client && typeof client._client.destroy === "function") {
      client._client.destroy();
    }
  } catch (_) {
    // La conexión ya estaba cerrada.
  }
}

async function readRegisters(client, startRegister, count) {
  const address = Math.max(0, startRegister - 1);
  let holdingError = null;
  try {
    const response = await client.readHoldingRegisters(address, count);
    return Array.isArray(response?.data) ? response.data : [];
  } catch (err) {
    holdingError = err;
  }

  try {
    const response = await client.readInputRegisters(address, count);
    return Array.isArray(response?.data) ? response.data : [];
  } catch (inputError) {
    throw new Error(
      `Holding: ${holdingError?.message || holdingError}; Input: ${inputError?.message || inputError}`
    );
  }
}

async function readDevice(config, fields, customBuilder) {
  let client = null;
  const count = config.end - config.start + 1;
  try {
    client = await connectTecClient(config);
    const data = await readRegisters(client, config.start, count);
    const metrics = customBuilder
      ? customBuilder(data)
      : buildMetrics(data, fields, config.start, config.wordOrder);
    return devicePayload(config, metrics);
  } catch (err) {
    return {
      ...devicePayload(config, {}),
      online: "false",
      error: err?.message || String(err)
    };
  } finally {
    await closeClient(client);
  }
}

async function readFloatAt(client, register, wordOrder) {
  const data = await readRegisters(client, register, 2);
  return decodeFloat32(data[0], data[1], wordOrder);
}

async function readVigilant(config) {
  const connection = DEVICE_CONFIG[config.connection];
  const metrics = {};
  let online = true;
  let lastError = null;
  let client = null;

  try {
    client = await connectTecClient(connection);
    for (const [metricKey, register] of Object.entries(config.registers)) {
      try {
        const value = await readFloatAt(client, register, connection.wordOrder);
        metrics[metricKey] = {
          value: metricKey.includes("status") ? (value === 1 ? 1 : 0) : value,
          unit: metricKey.includes("status") ? "state" : "count"
        };
      } catch (err) {
        online = false;
        lastError = err;
        metrics[metricKey] = {
          value: 0,
          unit: metricKey.includes("status") ? "state" : "count"
        };
      }
    }
  } catch (err) {
    online = false;
    lastError = err;
    Object.keys(config.registers).forEach(metricKey => {
      metrics[metricKey] = {
        value: 0,
        unit: metricKey.includes("status") ? "state" : "count"
      };
    });
  } finally {
    await closeClient(client);
  }

  return {
    device_id: config.device_id,
    name: config.name,
    type: "vigilant",
    model: "GRV8-10",
    online: online ? "true" : "false",
    area: config.area,
    building: COMMON_TAGS.building,
    floor: COMMON_TAGS.floor,
    group: COMMON_TAGS.group,
    room: COMMON_TAGS.room,
    code: config.code,
    metrics,
    ...(lastError ? { error: lastError?.message || String(lastError) } : {})
  };
}

async function performTecRead() {
  const devices = [];
  devices.push(await readDevice(DEVICE_CONFIG.meter1, PM_FIELDS));
  devices.push(await readDevice(DEVICE_CONFIG.meter2, PM_FIELDS));
  devices.push(await readDevice(DEVICE_CONFIG.analyzer1, ANALYZER_FIELDS));
  devices.push(await readVigilant(VIGILANT_CONFIG[0]));
  devices.push(await readDevice(
    DEVICE_CONFIG.analyzer2,
    ANALYZER_FIELDS,
    data => buildAnalyzer2Metrics(data, DEVICE_CONFIG.analyzer2.wordOrder)
  ));
  devices.push(await readVigilant(VIGILANT_CONFIG[1]));
  devices.push(await readDevice(
      DEVICE_CONFIG.generator1,
      GENERATOR_FIELDS,
      data => buildGeneratorMetrics(
        data,
        DEVICE_CONFIG.generator1.start,
        DEVICE_CONFIG.generator1.wordOrder
      )
  ));
  devices.push(await readDevice(
      DEVICE_CONFIG.generator2,
      GENERATOR_FIELDS,
      data => buildGeneratorMetrics(
        data,
        DEVICE_CONFIG.generator2.start,
        DEVICE_CONFIG.generator2.wordOrder
      )
  ));

  devices.forEach(device => {
    if (device.type === "energy_analyzer") {
      device.metrics = { comercial: device.metrics };
      device.metrics_harmonic = {};
    }
  });

  return { devices };
}

function readModbusAutoTec() {
  const run = readQueue.then(performTecRead, performTecRead);
  readQueue = run.catch(() => {});
  return run;
}

function getModbusTecConnectionInfo() {
  return Object.values(DEVICE_CONFIG).map(config => ({
    device: config.name,
    host: config.host,
    port: config.port,
    unitId: config.unitId,
    registerRange: `${config.start}-${config.end}`,
    wordOrder: config.wordOrder,
    timeoutMs: TEC_TIMEOUT_MS
  }));
}

module.exports = {
  readModbusAutoTec,
  getModbusTecConnectionInfo
};
