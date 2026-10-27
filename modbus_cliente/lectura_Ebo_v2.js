const {
  client,
  connectModbus,
  readHoldingRegistersForUnit,
  readInputRegistersForUnit
} = require("./modbus_rtu");

/**
 * Lee variables ATS A exactamente como en EBO WorkStation
 */
/*
async function readATSA_ModbusVariables() {
  try {
    await connectModbus();

    // 101 ? 127 (28 registros, 32-bit cada variable)
    let res = await client.readHoldingRegisters(100, 28);

    const block = "ATS A";
    const timestamp = new Date().toISOString();
    const primaryOrder = getFloatWordOrder();
    const alternateOrder = getAlternateFloatWordOrder(primaryOrder);
    const buildData = (dataArray, order) => ([
      { name: "LN1 Frequency", value: roundToTwo(decodeAtsFromArray(dataArray, 0, order)), unit: "Hz", register: 101 },
      { name: "LN1 V1 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 2, order)), unit: "V", register: 103 },
      { name: "LN1 V2 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 4, order)), unit: "V", register: 105 },
      { name: "LN1 V3 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 6, order)), unit: "V", register: 107 },
      { name: "LN1 V12 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 8, order)), unit: "V", register: 109 },
      { name: "LN1 V23 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 10, order)), unit: "V", register: 111 },
      { name: "LN1 V31 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 12, order)), unit: "V", register: 113 },
      { name: "LN2 Frequency", value: roundToTwo(decodeAtsFromArray(dataArray, 14, order)), unit: "Hz", register: 115 },
      { name: "LN2 V1 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 16, order)), unit: "V", register: 117 },
      { name: "LN2 V2 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 18, order)), unit: "V", register: 119 },
      { name: "LN2 V3 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 20, order)), unit: "V", register: 121 },
      { name: "LN2 V12 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 22, order)), unit: "V", register: 123 },
      { name: "LN2 V23 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 24, order)), unit: "V", register: 125 },
      { name: "LN2 V31 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 26, order)), unit: "V", register: 127 }
    ]);

    const selectData = (dataArray) => {
      const primary = buildData(dataArray, primaryOrder);
      if (primary.some(d => Number(d.value) !== 0)) return primary;
      const alternate = buildData(dataArray, alternateOrder);
      if (alternate.some(d => Number(d.value) !== 0)) return alternate;
      return primary;
    };

    let data = selectData(res.data);
    const nonZero = data.some(d => Number(d.value) !== 0);
    if (!nonZero && typeof client.readInputRegisters === "function") {
      try {
        const resInput = await client.readInputRegisters(100, 28);
        const alt = selectData(resInput.data);
        const altNonZero = alt.some(d => Number(d.value) !== 0);
        if (altNonZero) data = alt;
      } catch (_) {
        // ignore input fallback errors
      }
    }
    const dataWithMeta = data.map(item => ({ ...item, block, timestamp }));

    console.log("? ATS A Modbus Variables VOLTAJE LECTURA EBO:", { block, timestamp, data: dataWithMeta });
    return dataWithMeta;

  } catch (err) {
    console.error("? Error leyendo ATS A Modbus:", err.message);
    return [];
  }
}

async function readATSB_ModbusVariables() {
  try {
    await connectModbus();

    // 129 ? 155 (28 registros, 32-bit cada variable)
    let res = await client.readHoldingRegisters(128, 28);

    const block = "ATS B";
    const timestamp = new Date().toISOString();
    const primaryOrder = getFloatWordOrder();
    const alternateOrder = getAlternateFloatWordOrder(primaryOrder);
    const buildData = (dataArray, order) => ([
      { name: "LN1 Frequency", value: roundToTwo(decodeAtsFromArray(dataArray, 0, order)), unit: "Hz", register: 129 },
      { name: "LN1 V1 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 2, order)), unit: "V", register: 131 },
      { name: "LN1 V2 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 4, order)), unit: "V", register: 133 },
      { name: "LN1 V3 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 6, order)), unit: "V", register: 135 },
      { name: "LN1 V12 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 8, order)), unit: "V", register: 137 },
      { name: "LN1 V23 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 10, order)), unit: "V", register: 139 },
      { name: "LN1 V31 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 12, order)), unit: "V", register: 141 },
      { name: "LN2 Frequency", value: roundToTwo(decodeAtsFromArray(dataArray, 14, order)), unit: "Hz", register: 143 },
      { name: "LN2 V1 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 16, order)), unit: "V", register: 145 },
      { name: "LN2 V2 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 18, order)), unit: "V", register: 147 },
      { name: "LN2 V3 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 20, order)), unit: "V", register: 149 },
      { name: "LN2 V12 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 22, order)), unit: "V", register: 151 },
      { name: "LN2 V23 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 24, order)), unit: "V", register: 153 },
      { name: "LN2 V31 Voltage", value: roundToTwo(decodeAtsFromArray(dataArray, 26, order)), unit: "V", register: 155 }
    ]);

    const selectData = (dataArray) => {
      const primary = buildData(dataArray, primaryOrder);
      if (primary.some(d => Number(d.value) !== 0)) return primary;
      const alternate = buildData(dataArray, alternateOrder);
      if (alternate.some(d => Number(d.value) !== 0)) return alternate;
      return primary;
    };

    let data = selectData(res.data);
    const nonZero = data.some(d => Number(d.value) !== 0);
    if (!nonZero && typeof client.readInputRegisters === "function") {
      try {
        const resInput = await client.readInputRegisters(128, 28);
        const alt = selectData(resInput.data);
        const altNonZero = alt.some(d => Number(d.value) !== 0);
        if (altNonZero) data = alt;
      } catch (_) {
        // ignore input fallback errors
      }
    }
    const dataWithMeta = data.map(item => ({ ...item, block, timestamp }));

    console.log("? ATS B Modbus Variables VOLTAJE LECTURA EBO:", { block, timestamp, data: dataWithMeta });
    return dataWithMeta;

  } catch (err) {
    console.error("? Error leyendo ATS A Modbus:", err.message);
    return [];
  }
}

async function readInversorMateo_ModbusVariables() {
  try {
    await connectModbus();

    // 157 ? 173 (18 registros, 32-bit cada variable)
    const res = await client.readHoldingRegisters(156, 18);

    //const res = await client.readHoldingRegisters(102, 3);
    //console.log("PRUEBA REG 113:", res.data);

    const block = "Inversor Mateo";
    const timestamp = new Date().toISOString();
    const data = [

      
      {
        name: "Bateria Corriente",
        value: roundToTwo(decodeInversorFromArray(res.data, 0, 157)),
        unit: "A",
        register: 157
      },
      {
        name: "Bateria Voltaje",
        value: roundToTwo(decodeInversorFromArray(res.data, 2, 159)),
        unit: "V",
        register: 159
      },
      {
        name: "Entrada Corriente fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 4, 161)),
        unit: "A",
        register: 161
      },
      {
        name: "Entrada Frecuencia fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 6, 163)),
        unit: "Hz",
        register: 163
      },
      {
        name: "Entrada Voltaje fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 8, 165)),
        unit: "V",
        register: 165
      },
      {
        name: "Estado de carga",
        value: roundToTwo(decodeInversorFromArray(res.data, 10, 167)),
        unit: "%",
        register: 167
      },
      {
        name: "Salida Corriente fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 12, 169)),
        unit: "A",
        register: 169
      },

       {
        name: "Salida Frecuencia fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 14, 171)),
        unit: "Hz",
        register: 171
      },

       {
        name: "Salida Voltaje fase 1",
        value: roundToTwo(decodeInversorFromArray(res.data, 16, 173)),
        unit: "V",
        register: 173
      }
    ];
    const dataWithMeta = data.map(item => ({ ...item, block, timestamp }));

    return dataWithMeta;

  } catch (err) {
    return [];
  }
}
*/

function parseEnvNumber(value) {
  if (value == null) return null;
  const text = String(value).split("//")[0].split("#")[0].trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function getModbusAutoDefaults() {
  // V2 usa variables propias para no cambiar el rango de modbus-auto V1.
  const startEnv = parseEnvNumber(process.env.MODBUS_AUTO_V2_START);
  const endEnv = parseEnvNumber(process.env.MODBUS_AUTO_V2_END);
  const countEnv = parseEnvNumber(process.env.MODBUS_AUTO_V2_COUNT);
  const chunkEnv = parseEnvNumber(process.env.MODBUS_AUTO_V2_CHUNK || process.env.MODBUS_AUTO_CHUNK);

  const start = Number.isFinite(startEnv) && startEnv > 0 ? startEnv : 101;
  const defaultEnd = 5787;
  const end = Number.isFinite(endEnv) && endEnv >= start ? endEnv : defaultEnd;
  const countFromEnd = end ? end - start + 1 : null;
  const count = Number.isFinite(countEnv) && countEnv > 0
    ? countEnv
    : (Number.isFinite(countFromEnd) && countFromEnd > 0 ? countFromEnd : (defaultEnd - start + 1));
  const chunk = Number.isFinite(chunkEnv) && chunkEnv > 0 ? chunkEnv : 120;

  return { start, count, chunk, end };
}

/*
const PM2130_SEDES_POINTS = [
  { register: 3028, name: "Voltage A-N", unit: "V", metricKey: "voltage_a_n" },
  { register: 3030, name: "Voltage B-N", unit: "V", metricKey: "voltage_b_n" },
  { register: 3032, name: "Voltage C-N", unit: "V", metricKey: "voltage_c_n" },
  { register: 3020, name: "Voltage A-B", unit: "V", metricKey: "voltage_a_b" },
  { register: 3022, name: "Voltage B-C", unit: "V", metricKey: "voltage_b_c" },
  { register: 3024, name: "Voltage C-A", unit: "V", metricKey: "voltage_c_a" },
  { register: 3000, name: "Current A", unit: "A", metricKey: "current_a" },
  { register: 3002, name: "Current B", unit: "A", metricKey: "current_b" },
  { register: 3004, name: "Current C", unit: "A", metricKey: "current_c" },
  { register: 3010, name: "Frequency", unit: "Hz", metricKey: "frequency" },
  { register: 3060, name: "Demanda Total", unit: "kW", metricKey: "demand_total", optional: true }
];

const PM2130_SEDES_READ_RANGES = [
  { start: 3000, count: 6 },
  { start: 3010, count: 2 },
  { start: 3020, count: 6 },
  { start: 3028, count: 6 },
  { start: 3060, count: 2, optional: true }
];

const ION7400_SEDES_POINTS = [
  { register: 3054, name: "Active Power A", unit: "kW", metricKey: "active_power_a", words: 2 },
  { register: 3056, name: "Active Power B", unit: "kW", metricKey: "active_power_b", words: 2 },
  { register: 3058, name: "Active Power C", unit: "kW", metricKey: "active_power_c", words: 2 },
  { register: 3060, name: "Active Power Total", unit: "kW", metricKey: "active_power_total", words: 2 },
  { register: 3070, name: "Apparent Power A", unit: "kVA", metricKey: "apparent_power_a", words: 2 },
  { register: 3072, name: "Apparent Power B", unit: "kVA", metricKey: "apparent_power_b", words: 2 },
  { register: 3074, name: "Apparent Power C", unit: "kVA", metricKey: "apparent_power_c", words: 2 },
  { register: 30450, name: "Apparent Power Del A Peak Demand", unit: "kVA", metricKey: "apparent_power_del_a_peak_demand", words: 2 },
  { register: 30464, name: "Apparent Power Del B Peak Demand", unit: "kVA", metricKey: "apparent_power_del_b_peak_demand", words: 2 },
  { register: 30478, name: "Apparent Power Del C Peak Demand", unit: "kVA", metricKey: "apparent_power_del_c_peak_demand", words: 2 },
  { register: 3076, name: "Apparent Power Total", unit: "kVA", metricKey: "apparent_power_total", words: 2 },
  { register: 30112, name: "Apparent Power Total Peak Demand", unit: "kVA", metricKey: "apparent_power_total_peak_demand", words: 2 },
  { register: 3000, name: "Current A", unit: "A", metricKey: "current_a", words: 2 },
  { register: 3002, name: "Current B", unit: "A", metricKey: "current_b", words: 2 },
  { register: 3004, name: "Current C", unit: "A", metricKey: "current_c", words: 2 },
  { register: 3150, name: "Factor Potencia Total", unit: "pf", metricKey: "power_factor_total", words: 2 },
  { register: 3110, name: "Frequency", unit: "Hz", metricKey: "frequency", words: 2 },
  { register: 3144, name: "Power Factor A", unit: "pf", metricKey: "power_factor_a", words: 2 },
  { register: 3146, name: "Power Factor B", unit: "pf", metricKey: "power_factor_b", words: 2 },
  { register: 3148, name: "Power Factor C", unit: "pf", metricKey: "power_factor_c", words: 2 },
  { register: 34649, name: "Short-Term Flicker (Pst) A-N", unit: "Pst", metricKey: "short_term_flicker_pst_a_n", words: 2 },
  { register: 34651, name: "Short-Term Flicker (Pst) B-N", unit: "Pst", metricKey: "short_term_flicker_pst_b_n", words: 2 },
  { register: 34653, name: "Short-Term Flicker (Pst) C-N", unit: "Pst", metricKey: "short_term_flicker_pst_c_n", words: 2 },
  { register: 28148, name: "THD Current A High", unit: "%", metricKey: "thd_current_a_high", words: 2 },
  { register: 28150, name: "THD Current B High", unit: "%", metricKey: "thd_current_b_high", words: 2 },
  { register: 28152, name: "THD Current C High", unit: "%", metricKey: "thd_current_c_high", words: 2 },
  { register: 28156, name: "THD Voltage V1 High", unit: "%", metricKey: "thd_voltage_v1_high", words: 2 },
  { register: 28158, name: "THD Voltage V2 High", unit: "%", metricKey: "thd_voltage_v2_high", words: 2 },
  { register: 28160, name: "THD Voltage V3 High", unit: "%", metricKey: "thd_voltage_v3_high", words: 2 },
  { register: 3020, name: "Voltage A-B", unit: "V", metricKey: "voltage_a_b", words: 2 },
  { register: 3028, name: "Voltage A-N", unit: "V", metricKey: "voltage_a_n", words: 2 },
  { register: 3022, name: "Voltage B-C", unit: "V", metricKey: "voltage_b_c", words: 2 },
  { register: 3030, name: "Voltage B-N", unit: "V", metricKey: "voltage_b_n", words: 2 },
  { register: 3024, name: "Voltage C-A", unit: "V", metricKey: "voltage_c_a", words: 2 },
  { register: 3032, name: "Voltage C-N", unit: "V", metricKey: "voltage_c_n", words: 2 },
  { register: 8915, name: "Comercial", unit: "state", metricKey: "s1_transfer_normal", words: 1, boolean: true, optional: true },
  { register: 8919, name: "Generador", unit: "state", metricKey: "s2_transfer_generator", words: 1, boolean: true, optional: true }
];
*/
const SEDES_DEVICE_TAGS = {
  "PM2130-1": {
    area: "Emergencia",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES111"
  },
  "PM2130-2": {
    area: "Quirófanos",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES116"
  },
  "PM2130-3": {
    area: "Quirófanos",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES117"
  },
  "PM2130-4": {
    area: "Laboratorio",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES114"
  },
  "PM2130-5": {
    area: "Banco de Sangre",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES112"
  },
  "PM2130-6": {
    area: "Intensivos",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Pasillo Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES113"
  },
  "PM2130-7": {
    area: "Intensivos Neonatología",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Principal",
    fase_energy: "Monofásica",
    code_inventory: "HES115"
  },
  "ANALIZADOR-1": {
    area: "Cuarto eléctrico",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES107",
    code: "HES107",
    capacity: 300
  },
  "ANALIZADOR-2": {
    area: "Cuarto eléctrico",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES108",
    capacity: 200
  },
  "ANALIZADOR-3": {
    area: "Consulta Externa",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Sala de Espera",
    fase_energy: "Trifásica",
    code_inventory: "HES105",
    capacity: 225
  },
  "ANALIZADOR-4": {
    area: "Consulta Externa",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Sala de Espera",
    fase_energy: "Monofásica",
    code_inventory: "HES106",
    capacity: 22
  },
  "ANALIZADOR-5": {
    area: "Modulos",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES109",
    code: "HES109",
    capacity: 750
  },
  "ANALIZADOR-6": {
    area: "Modulos",
    building: "Principal",
    floor: "1",
    group: "Disponibilidad y Calidad de Energía",
    room: "Principal",
    fase_energy: "Trifásica",
    code_inventory: "HES110",
    capacity: 750
  }
};

function getSedesDeviceTags(deviceName) {
  const normalized = String(deviceName || "").trim();
  return {
    area: "",
    building: "",
    floor: "",
    group: "",
    room: "",
    fase_energy: "",
    ...(normalized === "generador_planta_hospital"
      ? SEDES_DEVICE_TAGS["ANALIZADOR-1"]
      : normalized === "generador_modulos"
      ? SEDES_DEVICE_TAGS["ANALIZADOR-5"]
      : (SEDES_DEVICE_TAGS[normalized] || {}))
  };
}

function parseEnvIdList(value) {
  const text = String(value ?? "").split("//")[0].split("#")[0].trim();
  if (!text) return [];

  const ids = [];
  text.split(",").forEach(token => {
    const part = token.trim();
    if (!part) return;

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const step = start <= end ? 1 : -1;
      for (let id = start; step > 0 ? id <= end : id >= end; id += step) {
        ids.push(id);
      }
      return;
    }

    const parsed = Number(part);
    if (Number.isFinite(parsed)) {
      ids.push(parsed);
    }
  });

  return ids.filter(id => Number.isFinite(id) && id > 0);
}

function getPm2130SedesUnitIds() {
  const explicitIds = parseEnvIdList(
    process.env.MODBUS_PM2130_IDS || process.env.MODBUS_PM2130_UNIT_IDS
  );
  if (explicitIds.length > 0) return explicitIds;

  const count = parseEnvNumber(process.env.MODBUS_PM2130_COUNT);
  if (!Number.isFinite(count) || count <= 0) return [];

  const startId = parseEnvNumber(process.env.MODBUS_PM2130_START_ID) || 1;
  return Array.from({ length: count }, (_, index) => startId + index);
}

function getPm2130SedesActiveBlocks() {
  const activeBlocks = parseEnvIdList(
    process.env.MODBUS_PM2130_ACTIVE_BLOCKS || process.env.MODBUS_PM2130_CONNECTED_BLOCKS
  );
  return activeBlocks.length > 0 ? new Set(activeBlocks) : null;
}

function getIon7400SedesUnitIds() {
  const explicitIds = parseEnvIdList(
    process.env.MODBUS_ION7400_IDS || process.env.MODBUS_ION7400_UNIT_IDS
  );
  if (explicitIds.length > 0) return explicitIds;

  const count = parseEnvNumber(process.env.MODBUS_ION7400_COUNT);
  if (!Number.isFinite(count) || count <= 0) return [];

  const startId = parseEnvNumber(process.env.MODBUS_ION7400_START_ID) || 1;
  return Array.from({ length: count }, (_, index) => startId + index);
}

function getIon7400SedesActiveBlocks() {
  const activeBlocks = parseEnvIdList(
    process.env.MODBUS_ION7400_ACTIVE_BLOCKS || process.env.MODBUS_ION7400_CONNECTED_BLOCKS
  );
  return activeBlocks.length > 0 ? new Set(activeBlocks) : null;
}
function isPm2130SedesFloatRegister(register) {
  if (getPm2130SedesUnitIds().length === 0) {
    return false;
  }

  return [
    3000, 3002, 3004,
    3010,
    3020, 3022, 3024,
    3028, 3030, 3032,
    3060
  ].includes(register);
}
function getLegacyPm2130BlockStart(deviceIndex, fallback) {
  const parsed = parseEnvNumber(process.env[`MODBUS_PM2130_${deviceIndex}_START`]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const LEGACY_PM2130_BLOCKS = [
  { block: "PM2130-1", start: getLegacyPm2130BlockStart(1, 101) },
  { block: "PM2130-2", start: getLegacyPm2130BlockStart(2, 123) },
  { block: "PM2130-3", start: getLegacyPm2130BlockStart(3, 145) },
  { block: "PM2130-4", start: getLegacyPm2130BlockStart(4, 167) },
  { block: "PM2130-5", start: getLegacyPm2130BlockStart(5, 189) },
  { block: "PM2130-6", start: getLegacyPm2130BlockStart(6, 211) },
  { block: "PM2130-7", start: getLegacyPm2130BlockStart(7, 233) }
];

const LEGACY_PM2130_FIELDS = [
  { name: "Voltage A-N", unit: "V", metricKey: "voltage_a_n" },
  { name: "Voltage B-N", unit: "V", metricKey: "voltage_b_n" },
  { name: "Voltage C-N", unit: "V", metricKey: "voltage_c_n" },
  { name: "Voltage A-B", unit: "V", metricKey: "voltage_a_b" },
  { name: "Voltage B-C", unit: "V", metricKey: "voltage_b_c" },
  { name: "Voltage C-A", unit: "V", metricKey: "voltage_c_a" },
  { name: "Current A", unit: "A", metricKey: "current_a" },
  { name: "Current B", unit: "A", metricKey: "current_b" },
  { name: "Current C", unit: "A", metricKey: "current_c" },
  { name: "Frequency", unit: "Hz", metricKey: "frequency" },
  { name: "Demanda Total", unit: "kW", metricKey: "demand_total" }
];

function buildLegacyPm2130MetricsFromStart(startRegister, valuesByRegister) {
  const metrics = {};

  LEGACY_PM2130_FIELDS.forEach((field, index) => {
    const register = startRegister + (index * 2);
    const decoded = decodeFloat32(register, valuesByRegister);
    metrics[field.metricKey] = {
      value: Number.isFinite(decoded) ? roundToTwo(decoded) : 0,
      unit: field.unit
    };
  });

  return metrics;
}

function hasAnyNonZeroPm2130Metric(metrics) {
  return Object.values(metrics || {}).some(metric => Number(metric?.value || 0) !== 0);
}

function isLikelyPm2130Metrics(metrics) {
  const get = (key) => Number(metrics?.[key]?.value);
  const phaseToNeutral = ["voltage_a_n", "voltage_b_n", "voltage_c_n"].map(get);
  const lineToLine = ["voltage_a_b", "voltage_b_c", "voltage_c_a"].map(get);
  const frequency = get("frequency");

  const hasValidPhaseVoltage = phaseToNeutral.some(value => Number.isFinite(value) && value >= 50 && value <= 300);
  const hasValidLineVoltage = lineToLine.some(value => Number.isFinite(value) && value >= 80 && value <= 500);
  const hasValidFrequency = Number.isFinite(frequency) && frequency >= 40 && frequency <= 80;

  return (hasValidPhaseVoltage || hasValidLineVoltage) && hasValidFrequency;
}

function getLegacyPm2130StartCandidates(deviceIndex, startRegister) {
  const envCandidates = parseEnvIdList(process.env[`MODBUS_PM2130_${deviceIndex}_START_CANDIDATES`]);
  const defaults = deviceIndex === 7
    ? [startRegister, startRegister - 2, startRegister + 2, startRegister - 4, startRegister + 4, startRegister + 6]
    : [startRegister];

  return Array.from(new Set([...envCandidates, ...defaults]))
    .filter(value => Number.isFinite(value) && value > 0 && value % 2 === 1);
}

function getLegacyPm2130Field(register) {
  if (register % 2 === 0) return null;

  for (const cfg of LEGACY_PM2130_BLOCKS) {
    const index = (register - cfg.start) / 2;
    if (!Number.isInteger(index) || index < 0 || index >= LEGACY_PM2130_FIELDS.length) {
      continue;
    }
    return {
      block: cfg.block,
      ...LEGACY_PM2130_FIELDS[index]
    };
  }

  return null;
}

const LEGACY_ION7400_BLOCKS = [
  { block: "ANALIZADOR-1", start: 255, end: 323 },
  { block: "ANALIZADOR-2", start: 325, end: 397 },
  { block: "ANALIZADOR-3", start: 399, end: 471 },
  { block: "ANALIZADOR-4", start: 473, end: 545 },
  { block: "ANALIZADOR-5", start: 547, end: 619 },
  { block: "ANALIZADOR-6", start: 621, end: 693 }
];

const LEGACY_ION7400_HARMONIC_BLOCKS = [
  { block: "ANALIZADOR-1", start: 701, end: 1533 },
  { block: "ANALIZADOR-2", start: 1535, end: 2367 },
  { block: "ANALIZADOR-3", start: 2369, end: 3201 },
  { block: "ANALIZADOR-4", start: 3203, end: 4035 },
  { block: "ANALIZADOR-5", start: 4037, end: 4869 },
  { block: "ANALIZADOR-6", start: 4871, end: 5703 }
];

const LEGACY_ION7400_VIGILANT_FIELDS = {
  695: { block: "ANALIZADOR-1", name: "S1 Commercial Energy Status", unit: "state", metricKey: "s1_commercial_energy_status" },
  697: { block: "ANALIZADOR-1", name: "S2 Generator Energy Status", unit: "state", metricKey: "s2_generator_energy_status" },
  587: { block: "ANALIZADOR-5", name: "S1 Commercial Energy Status", unit: "state", metricKey: "s1_commercial_energy_status" },
  589: { block: "ANALIZADOR-5", name: "S2 Generator Energy Status", unit: "state", metricKey: "s2_generator_energy_status" },
  5781: { block: "ANALIZADOR-1", name: "S1 Commercial Transition Count", unit: "count", metricKey: "s1_commercial_transition_count" },
  5783: { block: "ANALIZADOR-1", name: "S2 Generator Transition Count", unit: "count", metricKey: "s2_generator_transition_count" },
  5785: { block: "ANALIZADOR-5", name: "S1 Commercial Transition Count", unit: "count", metricKey: "s1_commercial_transition_count" },
  5787: { block: "ANALIZADOR-5", name: "S2 Generator Transition Count", unit: "count", metricKey: "s2_generator_transition_count" }
};

const GENERADOR_PLANTA_HOSPITAL_BLOCK = {
  block: "generador_planta_hospital",
  start: 5705,
  end: 5741
};

const GENERADOR_MODULOS_BLOCK = {
  block: "generador_modulos",
  start: 5743,
  end: 5779
};

const GENERADOR_PLANTA_HOSPITAL_FIELDS = [
  { name: "Gen kVA A Metering", unit: "kVA", metricKey: "gen_kva_a_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kVA B Metering", unit: "kVA", metricKey: "gen_kva_b_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kVA C Metering", unit: "kVA", metricKey: "gen_kva_c_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kVA Total Metering", unit: "kVA", metricKey: "gen_kva_total_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kW A Metering", unit: "kW", metricKey: "gen_kw_a_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kW B Metering", unit: "kW", metricKey: "gen_kw_b_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kW C Metering", unit: "kW", metricKey: "gen_kw_c_metering", dataType: "INT32", scale: 0.01 },
  { name: "Gen kW Total Metering", unit: "kW", metricKey: "gen_kw_total_metering", dataType: "INT32", scale: 0.01 },
  { name: "Power Factor Metering", unit: "pf", metricKey: "power_factor_metering", dataType: "UINT16", scale: 0.01 },
  { name: "Gen PF Lagging", unit: "state", metricKey: "gen_pf_lagging", dataType: "INT32", scale: 1 },
  { name: "Gen Frequency Metering", unit: "Hz", metricKey: "gen_frequency_metering", dataType: "UINT16", scale: 0.01 },
  { name: "Bus Frequency Metering", unit: "Hz", metricKey: "bus_frequency_metering", dataType: "UINT16", scale: 0.01 },
  { name: "Active Speed Source", unit: "state", metricKey: "active_speed_source", dataType: "UINT32", scale: 1 },
  { name: "Engine Speed Metering", unit: "RPM", metricKey: "engine_speed_metering", dataType: "UINT32", scale: 1 },
  { name: "Engine Load Metering", unit: "%", metricKey: "engine_load_metering", dataType: "INT32", scale: 0.01 },
  { name: "Coolant Temp. Metering", unit: "C", metricKey: "coolant_temp_metering", dataType: "INT32", scale: 0.01 },
  { name: "Oil Pressure Metering", unit: "psi", metricKey: "oil_pressure_metering", dataType: "INT32", scale: 0.01 },
  { name: "Battery Voltage Metering", unit: "V", metricKey: "battery_voltage_metering", dataType: "INT32", scale: 0.01 },
  { name: "Fuel Level Metering", unit: "%", metricKey: "fuel_level_metering", dataType: "INT32", scale: 0.01 }
];

const GENERADOR_BLOCKS = [
  GENERADOR_PLANTA_HOSPITAL_BLOCK,
  GENERADOR_MODULOS_BLOCK
];

function buildLegacyIon7400HarmonicFields() {
  const fields = [];
  const pad = (value) => String(value).padStart(2, "0");
  const addHarmonics = (label, key, total) => {
    for (let harmonic = 1; harmonic <= total; harmonic++) {
      fields.push({
        name: `${label} Harmonic ${pad(harmonic)}`,
        unit: "%",
        metricKey: `${key}_harmonic_${pad(harmonic)}`
      });
    }
  };

  addHarmonics("Voltage A-N", "voltage_a_n", 63);
  addHarmonics("Voltage B-N", "voltage_b_n", 63);
  addHarmonics("Voltage C-N", "voltage_c_n", 63);
  addHarmonics("Voltage A-B", "voltage_a_b", 13);
  addHarmonics("Voltage B-C", "voltage_b_c", 13);
  addHarmonics("Voltage C-A", "voltage_c_a", 13);
  addHarmonics("Current A", "current_a", 63);
  addHarmonics("Current B", "current_b", 63);
  addHarmonics("Current C", "current_c", 63);

  return fields;
}

const LEGACY_ION7400_HARMONIC_FIELDS = buildLegacyIon7400HarmonicFields();

const LEGACY_ION7400_FIELDS = [
  { name: "Active Power A", unit: "kW", metricKey: "active_power_a" },
  { name: "Active Power B", unit: "kW", metricKey: "active_power_b" },
  { name: "Active Power C", unit: "kW", metricKey: "active_power_c" },
  { name: "Active Power Total", unit: "kW", metricKey: "active_power_total" },
  { name: "Apparent Power A", unit: "kVA", metricKey: "apparent_power_a" },
  { name: "Apparent Power B", unit: "kVA", metricKey: "apparent_power_b" },
  { name: "Apparent Power C", unit: "kVA", metricKey: "apparent_power_c" },
  { name: "Apparent Power Del A Peak Demand", unit: "kVA", metricKey: "apparent_power_del_a_peak_demand" },
  { name: "Apparent Power Del B Peak Demand", unit: "kVA", metricKey: "apparent_power_del_b_peak_demand" },
  { name: "Apparent Power Del C Peak Demand", unit: "kVA", metricKey: "apparent_power_del_c_peak_demand" },
  { name: "Apparent Power Total", unit: "kVA", metricKey: "apparent_power_total" },
  { name: "Apparent Power Total Peak Demand", unit: "kVA", metricKey: "apparent_power_total_peak_demand" },
  { name: "Current A", unit: "A", metricKey: "current_a" },
  { name: "Current B", unit: "A", metricKey: "current_b" },
  { name: "Current C", unit: "A", metricKey: "current_c" },
  { name: "Factor Potencia Total", unit: "pf", metricKey: "power_factor_total" },
  { name: "Frequency", unit: "Hz", metricKey: "frequency" },
  { name: "Power Factor A", unit: "pf", metricKey: "power_factor_a" },
  { name: "Power Factor B", unit: "pf", metricKey: "power_factor_b" },
  { name: "Power Factor C", unit: "pf", metricKey: "power_factor_c" },
  { name: "Short-Term Flicker (Pst) A-N", unit: "Pst", metricKey: "short_term_flicker_pst_a_n" },
  { name: "Short-Term Flicker (Pst) B-N", unit: "Pst", metricKey: "short_term_flicker_pst_b_n" },
  { name: "Short-Term Flicker (Pst) C-N", unit: "Pst", metricKey: "short_term_flicker_pst_c_n" },
  { name: "THD Current A High", unit: "%", metricKey: "thd_current_a_high" },
  { name: "THD Current B High", unit: "%", metricKey: "thd_current_b_high" },
  { name: "THD Current C High", unit: "%", metricKey: "thd_current_c_high" },
  { name: "THD Voltage V1 High", unit: "%", metricKey: "thd_voltage_v1_high" },
  { name: "THD Voltage V2 High", unit: "%", metricKey: "thd_voltage_v2_high" },
  { name: "THD Voltage V3 High", unit: "%", metricKey: "thd_voltage_v3_high" },
  { name: "Voltage A-B", unit: "V", metricKey: "voltage_a_b" },
  { name: "Voltage A-N", unit: "V", metricKey: "voltage_a_n" },
  { name: "Voltage B-C", unit: "V", metricKey: "voltage_b_c" },
  { name: "Voltage B-N", unit: "V", metricKey: "voltage_b_n" },
  { name: "Voltage C-A", unit: "V", metricKey: "voltage_c_a" },
  { name: "Voltage C-N", unit: "V", metricKey: "voltage_c_n" }
];

const LEGACY_ION7400_QUALITY_FIELDS = [
  { name: "Short-Term Flicker (Pst) A-N", unit: "Pst", metricKey: "short_term_flicker_pst_a_n" },
  { name: "Short-Term Flicker (Pst) B-N", unit: "Pst", metricKey: "short_term_flicker_pst_b_n" },
  { name: "Short-Term Flicker (Pst) C-N", unit: "Pst", metricKey: "short_term_flicker_pst_c_n" },
  { name: "THD Current A High", unit: "%", metricKey: "thd_current_a_high" },
  { name: "THD Current B High", unit: "%", metricKey: "thd_current_b_high" },
  { name: "THD Current C High", unit: "%", metricKey: "thd_current_c_high" },
  { name: "THD Voltage V1 High", unit: "%", metricKey: "thd_voltage_v1_high" },
  { name: "THD Voltage V2 High", unit: "%", metricKey: "thd_voltage_v2_high" },
  { name: "THD Voltage V3 High", unit: "%", metricKey: "thd_voltage_v3_high" },
  { name: "Voltage A-B", unit: "V", metricKey: "voltage_a_b" },
  { name: "Voltage A-N", unit: "V", metricKey: "voltage_a_n" },
  { name: "Voltage B-C", unit: "V", metricKey: "voltage_b_c" },
  { name: "Voltage B-N", unit: "V", metricKey: "voltage_b_n" },
  { name: "Voltage C-A", unit: "V", metricKey: "voltage_c_a" },
  { name: "Voltage C-N", unit: "V", metricKey: "voltage_c_n" }
];

const LEGACY_ION7400_FIELD_OVERRIDE_CONFIG = {
  "ANALIZADOR-2": {
    clear: [365, 367],
    qualityStart: 369
  },
  "ANALIZADOR-3": {
    clear: [439, 441],
    qualityStart: 443
  },
  "ANALIZADOR-4": {
    clear: [513, 515],
    qualityStart: 517
  },
  "ANALIZADOR-5": {
    clear: [587, 589],
    qualityStart: 591
  },
  "ANALIZADOR-6": {
    clear: [661, 663],
    qualityStart: 665
  }
};

function buildLegacyIon7400FieldOverrides(config) {
  const overrides = {};

  Object.entries(config).forEach(([block, cfg]) => {
    overrides[block] = {};

    (cfg.clear || []).forEach(register => {
      overrides[block][register] = null;
    });

    if (Number.isFinite(cfg.qualityStart)) {
      LEGACY_ION7400_QUALITY_FIELDS.forEach((field, index) => {
        overrides[block][cfg.qualityStart + (index * 2)] = field;
      });
    }
  });

  return overrides;
}

const LEGACY_ION7400_FIELD_OVERRIDES = buildLegacyIon7400FieldOverrides(
  LEGACY_ION7400_FIELD_OVERRIDE_CONFIG
);

function getLegacyIon7400VigilantField(register) {
  return LEGACY_ION7400_VIGILANT_FIELDS[register] || null;
}

function getLegacyIon7400HarmonicField(register) {
  if (register % 2 === 0) return null;

  for (const cfg of LEGACY_ION7400_HARMONIC_BLOCKS) {
    const index = (register - cfg.start) / 2;
    if (!Number.isInteger(index) || index < 0 || index >= LEGACY_ION7400_HARMONIC_FIELDS.length) {
      continue;
    }
    return {
      block: cfg.block,
      harmonic: true,
      ...LEGACY_ION7400_HARMONIC_FIELDS[index]
    };
  }

  return null;
}

function getLegacyIon7400Field(register) {
  if (register % 2 === 0) return null;

  const vigilantField = getLegacyIon7400VigilantField(register);
  if (vigilantField) return vigilantField;

  const harmonicField = getLegacyIon7400HarmonicField(register);
  if (harmonicField) return harmonicField;

  for (const cfg of LEGACY_ION7400_BLOCKS) {
    const override = LEGACY_ION7400_FIELD_OVERRIDES[cfg.block]?.[register];
    if (override === null) return null;
    if (override) {
      return {
        block: cfg.block,
        ...override
      };
    }

    const index = (register - cfg.start) / 2;
    if (!Number.isInteger(index) || index < 0 || index >= LEGACY_ION7400_FIELDS.length) {
      continue;
    }
    return {
      block: cfg.block,
      ...LEGACY_ION7400_FIELDS[index]
    };
  }

  return null;
}

function getGeneradorPlantaHospitalField(register) {
  if (register % 2 === 0) return null;

  for (const cfg of GENERADOR_BLOCKS) {
    const index = (register - cfg.start) / 2;
    if (!Number.isInteger(index) || index < 0 || index >= GENERADOR_PLANTA_HOSPITAL_FIELDS.length) {
      continue;
    }

    return {
      block: cfg.block,
      ...GENERADOR_PLANTA_HOSPITAL_FIELDS[index]
    };
  }

  return null;
}

function getGeneratorWordOrder() {
  const raw = String(process.env.MODBUS_GENERATOR_WORD_ORDER || "CDAB").toUpperCase();
  if (raw === "ABCD" || raw === "NORMAL") return "ABCD";
  return "CDAB";
}

function decodeInt32WithOrder(hi, lo, order) {
  const unsigned = decodeUint32WithOrder(hi, lo, order);
  if (!Number.isFinite(unsigned)) return null;
  return unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;
}

function getGeneratorPlausibleRange(field) {
  switch (field.unit) {
    case "%":
      return { min: -1, max: 100 };
    case "Hz":
      return { min: 0, max: 100 };
    case "V":
      return { min: 0, max: 1000 };
    case "C":
      return { min: -50, max: 250 };
    case "psi":
      return { min: 0, max: 1000 };
    case "pf":
      return { min: -100, max: 100 };
    case "RPM":
      return { min: 0, max: 10000 };
    default:
      return { min: -100000, max: 100000 };
  }
}

function pickGeneratorCandidate(candidates, field) {
  const range = getGeneratorPlausibleRange(field);
  const plausible = candidates.find(value =>
    Number.isFinite(value) && value >= range.min && value <= range.max
  );
  if (Number.isFinite(plausible)) return plausible;
  const finite = candidates.find(Number.isFinite);
  return Number.isFinite(finite) ? finite : 0;
}

function decodeGeneradorPlantaHospitalValue(register, valuesByRegister) {
  const field = getGeneradorPlantaHospitalField(register);
  if (!field) return null;

  const scale = Number.isFinite(field.scale) ? field.scale : 1;
  if (field.dataType === "UINT16") {
    const raw = valuesByRegister.get(register);
    return Number.isFinite(raw) ? (raw & 0xffff) * scale : 0;
  }

  const hi = valuesByRegister.get(register);
  const lo = valuesByRegister.get(register + 1);
  const order = getGeneratorWordOrder();
  const altOrder = getAlternateFloatWordOrder(order);
  const decoder = field.dataType === "UINT32" ? decodeUint32WithOrder : decodeInt32WithOrder;
  const primary = decoder(hi, lo, order);
  const alternate = decoder(hi, lo, altOrder);
  const candidates = [primary, alternate]
    .filter(Number.isFinite)
    .map(value => value * scale);

  return pickGeneratorCandidate(candidates, field);
}

function mapModbusMetaByRegister(register) {
  const pm2130Field = getLegacyPm2130Field(register);
  if (pm2130Field) {
    return {
      block: pm2130Field.block,
      name: pm2130Field.name,
      unit: pm2130Field.unit,
      metricKey: pm2130Field.metricKey
    };
  }

  const ion7400Field = getLegacyIon7400Field(register);
  if (ion7400Field) {
    return {
      block: ion7400Field.block,
      name: ion7400Field.name,
      unit: ion7400Field.unit,
      metricKey: ion7400Field.metricKey,
      harmonic: ion7400Field.harmonic === true
    };
  }

  const generadorField = getGeneradorPlantaHospitalField(register);
  if (generadorField) {
    return {
      block: generadorField.block,
      name: generadorField.name,
      unit: generadorField.unit,
      metricKey: generadorField.metricKey
    };
  }
/*
  switch (register) {
    
    // Reservado para futuro: modbus_auto actual no publica bloques de
    // Generador A/B. Se dejan comentados para reutilizarlos después.
    // Generador A
    case 175: return { block: "Generador A", name: "Active Fault Type", unit: "code" };
    case 177: return { block: "Generador A", name: "Alternator L1 Current", unit: "A" };
    case 179: return { block: "Generador A", name: "Alternator L1-L2 Voltage", unit: "V" };
    case 181: return { block: "Generador A", name: "Alternator L1-N Voltage", unit: "V" };
    case 183: return { block: "Generador A", name: "Alternator L2 Current", unit: "A" };
    case 185: return { block: "Generador A", name: "Alternator L2-L3 Voltage", unit: "V" };
    case 187: return { block: "Generador A", name: "Alternator L2-N Voltage", unit: "V" };
    case 189: return { block: "Generador A", name: "Alternator L3 Current", unit: "A" };
    case 191: return { block: "Generador A", name: "Alternator L3-L1 Voltage", unit: "V" };
    case 193: return { block: "Generador A", name: "Alternator L3-N Voltage", unit: "V" };
    case 195: return { block: "Generador A", name: "Alternator Voltage Average", unit: "V" };
    case 197: return { block: "Generador A", name: "Battery Voltage", unit: "V" };
    case 199: return { block: "Generador A", name: "Coolant Temperature", unit: "�C" };
    case 201: return { block: "Generador A", name: "Engine Run Time (High Byte)", unit: "h" };
    case 203: return { block: "Generador A", name: "Engine Speed", unit: "RPM" };
    case 205: return { block: "Generador A", name: "Frequency", unit: "Hz" };
    case 207: return { block: "Generador A", name: "LTA Temperature", unit: "�C" };
    case 209: return { block: "Generador A", name: "Oil Pressure", unit: "kPa" };
    case 211: return { block: "Generador A", name: "Operation Mode Switch Position", unit: "state" };
    case 213: return { block: "Generador A", name: "Total Runs", unit: "count" };
    // Generador B
    case 215: return { block: "Generador B", name: "Active Fault Type", unit: "code" };
    case 217: return { block: "Generador B", name: "Alternator L1 Current", unit: "A" };
    case 219: return { block: "Generador B", name: "Alternator L1-L2 Voltage", unit: "V" };
    case 221: return { block: "Generador B", name: "Alternator L1-N Voltage", unit: "V" };
    case 223: return { block: "Generador B", name: "Alternator L2 Current", unit: "A" };
    case 225: return { block: "Generador B", name: "Alternator L2-L3 Voltage", unit: "V" };
    case 227: return { block: "Generador B", name: "Alternator L2-N Voltage", unit: "V" };
    case 229: return { block: "Generador B", name: "Alternator L3 Current", unit: "A" };
    case 231: return { block: "Generador B", name: "Alternator L3-L1 Voltage", unit: "V" };
    case 233: return { block: "Generador B", name: "Alternator L3-N Voltage", unit: "V" };
    case 235: return { block: "Generador B", name: "Alternator Voltage Average", unit: "V" };
    case 237: return { block: "Generador B", name: "Battery Voltage", unit: "V" };
    case 239: return { block: "Generador B", name: "Coolant Temperature", unit: "�C" };
    case 241: return { block: "Generador B", name: "Engine Run Time (High Byte)", unit: "h" };
    case 243: return { block: "Generador B", name: "Engine Speed", unit: "RPM" };
    case 245: return { block: "Generador B", name: "Frequency", unit: "Hz" };
    case 247: return { block: "Generador B", name: "LTA Temperature", unit: "�C" };
    case 249: return { block: "Generador B", name: "Oil Pressure", unit: "kPa" };
    case 251: return { block: "Generador B", name: "Operation Mode Switch Position", unit: "state" };
    case 253: return { block: "Generador B", name: "Total Runs", unit: "count" };
    
    // ION7400
    case 255: return { block: "ION7400", name: "Active Power A", unit: "kW" };
    case 257: return { block: "ION7400", name: "Active Power B", unit: "kW" };
    case 259: return { block: "ION7400", name: "Active Power C", unit: "kW" };
    case 261: return { block: "ION7400", name: "Active Power Total", unit: "kW" };
    case 263: return { block: "ION7400", name: "Apparent Power A", unit: "kVA" };
    case 265: return { block: "ION7400", name: "Apparent Power B", unit: "kVA" };
    case 267: return { block: "ION7400", name: "Apparent Power C", unit: "kVA" };
    case 269: return { block: "ION7400", name: "Apparent Power Del A Peak Demand", unit: "kVA" };
    case 271: return { block: "ION7400", name: "Apparent Power Del B Peak Demand", unit: "kVA" };
    case 273: return { block: "ION7400", name: "Apparent Power Del C Peak Demand", unit: "kVA" };
    case 275: return { block: "ION7400", name: "Apparent Power Total", unit: "kVA" };
    case 277: return { block: "ION7400", name: "Apparent Power Total Peak Demand", unit: "kVA" };
    case 279: return { block: "ION7400", name: "Current A", unit: "A" };
    case 281: return { block: "ION7400", name: "Current B", unit: "A" };
    case 283: return { block: "ION7400", name: "Current C", unit: "A" };
    case 285: return { block: "ION7400", name: "Factor Potencia Total", unit: "pf" };
    case 287: return { block: "ION7400", name: "Frequency", unit: "Hz" };
    case 289: return { block: "ION7400", name: "Power Factor A", unit: "pf" };
    case 291: return { block: "ION7400", name: "Power Factor B", unit: "pf" };
    case 293: return { block: "ION7400", name: "Power Factor C", unit: "pf" };
    case 295: return { block: "ION7400", name: "Short-Term Flicker (Pst) A-N", unit: "Pst" };
    case 297: return { block: "ION7400", name: "Short-Term Flicker (Pst) B-N", unit: "Pst" };
    case 299: return { block: "ION7400", name: "Short-Term Flicker (Pst) C-N", unit: "Pst" };
    case 301: return { block: "ION7400", name: "THD Current A High", unit: "%" };
    case 303: return { block: "ION7400", name: "THD Current B High", unit: "%" };
    case 305: return { block: "ION7400", name: "THD Current C High", unit: "%" };
    case 307: return { block: "ION7400", name: "THD Voltage V1 High", unit: "%" };
    case 309: return { block: "ION7400", name: "THD Voltage V2 High", unit: "%" };
    case 311: return { block: "ION7400", name: "THD Voltage V3 High", unit: "%" };
    case 313: return { block: "ION7400", name: "Voltage A-B", unit: "V" };
    case 315: return { block: "ION7400", name: "Voltage A-N", unit: "V" };
    case 317: return { block: "ION7400", name: "Voltage B-C", unit: "V" };
    case 319: return { block: "ION7400", name: "Voltage B-N", unit: "V" };
    case 321: return { block: "ION7400", name: "Voltage C-A", unit: "V" };
    case 323: return { block: "ION7400", name: "Voltage C-N", unit: "V" };

    default: return null;
  }
    */
}
function mapModbusDeviceKey(block) {
  const pmMatch = String(block || "").match(/^PM2130-(\d+)$/);
  if (pmMatch) {
    return `pm_2130_${pmMatch[1]}`;
  }

  const ionMatch = String(block || "").match(/^(?:ION7400|ANALIZADOR)-(\d+)$/);
  if (ionMatch) {
    return `analizador_${ionMatch[1]}`;
  }

  if (/^generador_(planta_hospital|modulos)$/.test(String(block || ""))) {
    return String(block);
  }

  switch (block) {
    // Reservado para futuro: modbus_auto hoy no arma devices ATS/Inversor/Generador.
    // case "ATS A": return "ats_a";
    // case "ATS B": return "ats_b";
    // case "Inversor Mateo": return "inverter_mateo";
    // case "Generador A": return "generator_a";
    // case "Generador B": return "generator_b";
    case "ANALIZADOR": return "analizador";
    case "PM2130": return "pm_2130";
    default: return null;
  }
}

function mapModbusDeviceType(block) {
  if (/^PM2130-\d+$/.test(String(block || ""))) {
    return "power_meter";
  }

  if (/^(?:ION7400|ANALIZADOR)-\d+$/.test(String(block || ""))) {
    return "energy_analyzer";
  }

  if (/^generador_(planta_hospital|modulos)$/.test(String(block || ""))) {
    return "electric_generator";
  }

  switch (block) {
    // Reservado para futuro: modbus_auto hoy no arma devices ATS/Inversor/Generador.
    // case "ATS A":
    // case "ATS B":
    //   return "ats";
    // case "Inversor Mateo":
    //   return "inverter";
    // case "Generador A":
    // case "Generador B":
    //   return "generator";
    case "ANALIZADOR":
      return "energy_analyzer";
    case "PM2130":
      return "power_meter";
    default:
      return "unknown";
  }
}

function mapModbusDeviceModel(block) {
  if (/^PM2130-\d+$/.test(String(block || ""))) {
    return "2130";
  }

  if (/^(?:ION7400|ANALIZADOR)-\d+$/.test(String(block || ""))) {
    return "ION7400";
  }

  if (String(block || "") === "generador_planta_hospital") {
    return "DGC-2020";
  }

  if (String(block || "") === "generador_modulos") {
    return "TECUN";
  }

  switch (block) {
    // Reservado para futuro: modbus_auto hoy no arma devices ATS/Inversor/Generador.
    // case "ATS A":
    // case "ATS B":
    //   return "PM2130";
    // case "Inversor Mateo":
    //   return "MATEO";
    // case "Generador A":
    // case "Generador B":
    //   return "ION7400";
    case "ANALIZADOR":
      return "ION7400";
    case "PM2130":
      return "2130";
    default:
      return "";
  }
}

function getFloatWordOrder() {
  const raw = String(process.env.MODBUS_FLOAT_WORD_ORDER || "ABCD").toUpperCase();
  if (raw === "CDAB" || raw === "SWAP" || raw === "BA" || raw === "DCBA") {
    return "CDAB";
  }
  return "ABCD";
}

function getAlternateFloatWordOrder(order) {
  return order === "CDAB" ? "ABCD" : "CDAB";
}
function isFloat32Register(register) {
  const isOdd = register % 2 === 1;
  if (isOdd && register >= 101 && register <= 253) return true; // PM2130-1 ... PM2130-7
  if (isOdd && register >= 255 && register <= 693) return true; // ANALIZADOR-1 ... ANALIZADOR-6
  if (getLegacyIon7400VigilantField(register)) return true; // Vigilante S1/S2 por ION
  if (getLegacyIon7400HarmonicField(register)) return true; // ION7400 harmonics
  if (isPm2130SedesFloatRegister(register)) return true; // PM2130-1 SEDES
  return false;
}

function isInversorRegister(register) {
  return register % 2 === 1 && register >= 157 && register <= 173;
}

function getExtraWordCount(register) {
  if (isIon7400TimestampedRegister(register)) return 5;
  return needsSecondWord(register) ? 1 : 0;
}

function needsSecondWord(register) {
  if (isPm2130SedesFloatRegister(register)) return true; // PM2130-1 SEDES
  const isOdd = register % 2 === 1;
  if (!isOdd) return false;
  if (register >= 101 && register <= 127) return true; // ATS A
  if (register >= 129 && register <= 155) return true; // ATS B
  if (isInversorRegister(register)) return true; // Inversor Mateo (low word holds value)
  const generadorField = getGeneradorPlantaHospitalField(register);
  if (generadorField) return generadorField.dataType !== "UINT16";
  return isFloat32Register(register);
}

function decodeFloat32WithOrder(hi, lo, order) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;

  const buf = Buffer.alloc(4);
  if (order === "CDAB") {
    buf.writeUInt16BE(lo, 0);
    buf.writeUInt16BE(hi, 2);
  } else {
    buf.writeUInt16BE(hi, 0);
    buf.writeUInt16BE(lo, 2);
  }
  const value = buf.readFloatBE(0);
  return Number.isFinite(value) ? value : null;
}

function decodeUint32WithOrder(hi, lo, order) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  const hi16 = hi & 0xffff;
  const lo16 = lo & 0xffff;
  if (order === "CDAB") {
    return (((lo16 << 16) >>> 0) + hi16) >>> 0;
  }
  return (((hi16 << 16) >>> 0) + lo16) >>> 0;
}

function decodeFloat32FromArray(data, index, orderOverride) {
  const hi = data?.[index];
  const lo = data?.[index + 1];
  const order = orderOverride || getFloatWordOrder();
  return decodeFloat32WithOrder(hi, lo, order);
}
function decodeFloat32(register, valuesByRegister, orderOverride) {
  const hi = valuesByRegister.get(register);
  const lo = valuesByRegister.get(register + 1);
  const order = orderOverride || getFloatWordOrder();
  return decodeFloat32WithOrder(hi, lo, order);
}

function getIon7400DataType(register) {
  return "FLOAT32_SWAPPED"; // 32 bit real swapped (EBO)
}

function isIon7400TimestampedRegister(register) {
  return false;
}

function decodeIon7400Timestamp(register, valuesByRegister) {
  if (!isIon7400TimestampedRegister(register)) return null;
  const minMs = Date.parse("2010-01-01T00:00:00Z");
  const maxMs = Date.parse("2035-12-31T23:59:59Z");
  const nowMs = Date.now();

  const candidatesMs = [];
  const w0 = valuesByRegister.get(register + 2);
  const w1 = valuesByRegister.get(register + 3);
  const w2 = valuesByRegister.get(register + 4);
  const w3 = valuesByRegister.get(register + 5);
  if (![w0, w1, w2, w3].some(Number.isFinite)) return null;

  const u32Pairs = [];
  const pushPair = (a, b) => {
    const v1 = decodeUint32WithOrder(a, b, "CDAB");
    const v2 = decodeUint32WithOrder(a, b, "ABCD");
    if (Number.isFinite(v1)) u32Pairs.push(v1);
    if (Number.isFinite(v2)) u32Pairs.push(v2);
  };
  if (Number.isFinite(w0) && Number.isFinite(w1)) {
    pushPair(w0, w1);
    pushPair(w1, w0);
  }
  if (Number.isFinite(w2) && Number.isFinite(w3)) {
    pushPair(w2, w3);
    pushPair(w3, w2);
  }

  const orderings = [
    [0, 1, 2, 3], // ABCD
    [1, 0, 3, 2], // BADC
    [2, 3, 0, 1], // CDAB
    [3, 2, 1, 0]  // DCBA
  ];
  const words = [w0, w1, w2, w3].map(v => (Number.isFinite(v) ? v : 0));
  const u64Candidates = [];
  orderings.forEach(order => {
    let value = 0n;
    for (const idx of order) {
      const word = BigInt(words[idx] & 0xffff);
      value = (value << 16n) | word;
    }
    if (value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      u64Candidates.push(Number(value));
    }
  });

  const baseEpochs = [
    0, // 1970-01-01
    Date.parse("2000-01-01T00:00:00Z"),
    Date.parse("2010-01-01T00:00:00Z"),
    Date.parse("1990-01-01T00:00:00Z")
  ];

  const addIfInRange = (ms) => {
    if (ms >= minMs && ms <= maxMs) candidatesMs.push(ms);
  };

  u32Pairs.forEach(v => {
    baseEpochs.forEach(base => {
      addIfInRange(base + v * 1000);     // seconds
      addIfInRange(base + v * 60000);    // minutes
    });
    addIfInRange(v);                     // raw ms
    addIfInRange(v * 1000);              // raw seconds
  });

  u64Candidates.forEach(v => {
    addIfInRange(v);
    addIfInRange(v * 1000);
  });

  if (candidatesMs.length === 0) return null;
  let best = candidatesMs[0];
  let bestDist = Math.abs(best - nowMs);
  for (const ms of candidatesMs) {
    const dist = Math.abs(ms - nowMs);
    if (dist < bestDist) {
      best = ms;
      bestDist = dist;
    }
  }
  return new Date(best).toISOString();
}

function decodeIon7400Value(register, valuesByRegister, unit, orderOverride) {
  const hi = valuesByRegister.get(register);
  if (unit === "state" || unit === "count") {
    return Number.isFinite(hi) ? hi : 0;
  }

  const lo = valuesByRegister.get(register + 1);
  const type = getIon7400DataType(register);
  const atsOrder = orderOverride || getFloatWordOrder(); // mismo formato que ATS
  const atsAltOrder = orderOverride ? null : getAlternateFloatWordOrder(atsOrder);
  const swappedOrder = "CDAB";
  const swappedAltOrder = "ABCD";

  let primary;
  let alternate;
  if (type === "UINT32_SWAPPED") {
    primary = decodeUint32WithOrder(hi, lo, swappedOrder);
    alternate = decodeUint32WithOrder(hi, lo, swappedAltOrder);
  } else {
    primary = decodeFloat32WithOrder(hi, lo, atsOrder);
    alternate = atsAltOrder ? decodeFloat32WithOrder(hi, lo, atsAltOrder) : null;
  }

  const candidates = [primary, alternate].filter(Number.isFinite);
  const primaryUsable = Number.isFinite(primary) && primary !== 0;
  if (isIon7400ScaledRegister(register) && (unit === "%" || unit === "Pst")) {
    return pickIon7400ByUnit(candidates, unit);
  }

  if (primaryUsable) return primary;
  if (Number.isFinite(alternate)) return alternate;

  return Number.isFinite(primary) ? primary : 0;
}

function isIon7400ScaledRegister(register) {
  const harmonicField = getLegacyIon7400HarmonicField(register);
  if (harmonicField && harmonicField.unit === "%") {
    return true;
  }

  for (const overrides of Object.values(LEGACY_ION7400_FIELD_OVERRIDES)) {
    const field = overrides?.[register];
    if (field && (field.unit === "%" || field.unit === "Pst")) {
      return true;
    }
  }

  switch (register) {
    case 295:
    case 297:
    case 299:
    case 301:
    case 303:
    case 305:
    case 307:
    case 309:
    case 311:
      return true;
    default:
      return false;
  }
}

function getIon7400FloatWordOrder(valuesByRegister) {
  const primary = getFloatWordOrder();
  const alternate = getAlternateFloatWordOrder(primary);
  const probeOffsets = [
    0, 2, 4, 6,
    8, 10, 12, 20,
    24, 26, 28, 32,
    58, 60, 62, 64,
    66, 68
  ];
  const probeRegisters = LEGACY_ION7400_BLOCKS.flatMap(cfg =>
    probeOffsets.map(offset => cfg.start + offset)
  );

  const scoreForOrder = (order) => {
    let score = 0;
    for (const reg of probeRegisters) {
      const hi = valuesByRegister.get(reg);
      const lo = valuesByRegister.get(reg + 1);
      const value = decodeFloat32WithOrder(hi, lo, order);
      if (Number.isFinite(value) && value !== 0) score += 1;
    }
    return score;
  };

  const primaryScore = scoreForOrder(primary);
  const alternateScore = scoreForOrder(alternate);
  return alternateScore > primaryScore ? alternate : primary;
}

function pickIon7400ByUnit(candidates, unit) {
  const range = unit === "%"
    ? { min: 0, max: 200, target: 5 }
    : { min: 0, max: 10, target: 1 };

  const scaleFactors = [
    1, 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001, 0.0000001, 0.00000001, 0.000000001,
    10, 100
  ];
  const scaled = [];
  for (const v of candidates) {
    for (const f of scaleFactors) {
      const c = v * f;
      if (Number.isFinite(c)) scaled.push(c);
    }
  }

  let best = null;
  let bestDist = Infinity;
  for (const c of scaled) {
    if (c < range.min || c > range.max) continue;
    const dist = Math.abs(c - range.target);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }

  if (best !== null) return best;
  return candidates.length > 0 ? candidates[0] : 0;
}

function getAtsExpectedType(register) {
  switch (register) {
    case 101:
    case 115:
    case 129:
    case 143:
      return "frequency";
    case 103:
    case 105:
    case 107:
    case 117:
    case 119:
    case 121:
    case 131:
    case 133:
    case 135:
    case 145:
    case 147:
    case 149:
      return "voltage_ln";
    case 109:
    case 111:
    case 113:
    case 123:
    case 125:
    case 127:
    case 137:
    case 139:
    case 141:
    case 151:
    case 153:
    case 155:
      return "voltage_ll";
    default:
      return null;
  }
}

function getAtsExpectedTypeFromIndex(index) {
  switch (index) {
    case 0:
    case 14:
      return "frequency";
    case 2:
    case 4:
    case 6:
    case 16:
    case 18:
    case 20:
      return "voltage_ln";
    case 8:
    case 10:
    case 12:
    case 22:
    case 24:
    case 26:
      return "voltage_ll";
    default:
      return null;
  }
}

function getAtsRangeByType(type) {
  switch (type) {
    case "frequency":
      return { target: 60, tightMin: 45, tightMax: 70, wideMin: 30, wideMax: 80 };
    case "voltage_ln":
      return { target: 120, tightMin: 80, tightMax: 140, wideMin: 50, wideMax: 160 };
    case "voltage_ll":
      return { target: 208, tightMin: 180, tightMax: 260, wideMin: 150, wideMax: 300 };
    default:
      return null;
  }
}

function pickAtsCandidate(floatVal, raw, type) {
  const candidates = [
    floatVal,
    Number.isFinite(raw) ? raw / 10 : null,
    Number.isFinite(raw) ? raw / 100 : null,
    Number.isFinite(raw) ? raw : null
  ];

  const range = type ? getAtsRangeByType(type) : null;
  if (!range) {
    for (const v of candidates) {
      if (Number.isFinite(v)) return v;
    }
    return null;
  }

  let best = null;
  let bestScore = -1;
  let bestDist = Infinity;

  for (const v of candidates) {
    if (!Number.isFinite(v)) continue;
    if (v === 0) {
      if (bestScore < 0) {
        best = 0;
        bestScore = 0;
        bestDist = Infinity;
      }
      continue;
    }

    let score = -1;
    if (v >= range.tightMin && v <= range.tightMax) {
      score = 2;
    } else if (v >= range.wideMin && v <= range.wideMax) {
      score = 1;
    }
    if (score < 0) continue;

    const dist = Math.abs(v - range.target);
    if (score > bestScore || (score === bestScore && dist < bestDist)) {
      best = v;
      bestScore = score;
      bestDist = dist;
    }
  }

  if (best !== null) return best;
  for (const v of candidates) {
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function decodeAtsFromArray(data, index, orderOverride) {
  const floatVal = decodeFloat32FromArray(data, index, orderOverride);
  const raw = data?.[index];
  const type = getAtsExpectedTypeFromIndex(index);
  return pickAtsCandidate(floatVal, raw, type);
}

function decodeAtsValue(register, valuesByRegister, orderOverride) {
  const floatVal = decodeFloat32(register, valuesByRegister, orderOverride);
  const raw = valuesByRegister.get(register);
  const type = getAtsExpectedType(register);
  return pickAtsCandidate(floatVal, raw, type);
}

function getInversorExpectedType(register) {
  switch (register) {
    case 157:
    case 161:
    case 169:
      return "current";
    case 159:
      return "battery_voltage";
    case 165:
    case 173:
      return "ac_voltage";
    case 163:
    case 171:
      return "frequency";
    case 167:
      return "percent";
    default:
      return null;
  }
}

function getInversorRangeByType(type) {
  switch (type) {
    case "current":
      return { target: 10, tightMin: 0, tightMax: 200, wideMin: 0, wideMax: 300 };
    case "battery_voltage":
      return { target: 24, tightMin: 10, tightMax: 80, wideMin: 5, wideMax: 100 };
    case "ac_voltage":
      return { target: 120, tightMin: 80, tightMax: 260, wideMin: 50, wideMax: 300 };
    case "frequency":
      return { target: 60, tightMin: 45, tightMax: 70, wideMin: 30, wideMax: 80 };
    case "percent":
      return { target: 50, tightMin: 0, tightMax: 100, wideMin: 0, wideMax: 100 };
    default:
      return null;
  }
}

function pickInversorValue(candidates, type) {
  const scoreWithRange = (range) => {
    if (!range) return null;

    let best = null;
    let bestScore = -1;
    let bestDist = Infinity;

    for (const v of candidates) {
      if (!Number.isFinite(v)) continue;
      if (v === 0) {
        if (bestScore < 0) {
          best = 0;
          bestScore = 0;
          bestDist = Infinity;
        }
        continue;
      }

      let score = -1;
      if (v >= range.tightMin && v <= range.tightMax) {
        score = 2;
      } else if (v >= range.wideMin && v <= range.wideMax) {
        score = 1;
      }
      if (score < 0) continue;

      const dist = Math.abs(v - range.target);
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        best = v;
        bestScore = score;
        bestDist = dist;
      }
    }

    return best;
  };

  if (!type) {
    for (const v of candidates) {
      if (Number.isFinite(v)) return v;
    }
    return null;
  }

  if (type === "battery_voltage") {
    const highRange = { target: 120, tightMin: 80, tightMax: 160, wideMin: 50, wideMax: 200 };
    const lowRange = getInversorRangeByType(type);
    const hasHighCandidate = candidates.some(
      v => Number.isFinite(v) && v >= highRange.wideMin && v <= highRange.wideMax
    );
    const best = scoreWithRange(hasHighCandidate ? highRange : lowRange);
    if (best !== null) return best;
  } else {
    const range = getInversorRangeByType(type);
    const best = scoreWithRange(range);
    if (best !== null) return best;
  }

  for (const v of candidates) {
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function decodeInversorFromArray(data, index, register) {
  const rawHi = data?.[index];
  const rawLo = data?.[index + 1];
  const order = getFloatWordOrder();
  const altOrder = getAlternateFloatWordOrder(order);
  const raw32 = decodeUint32WithOrder(rawHi, rawLo, order);
  const raw32Alt = altOrder === order ? null : decodeUint32WithOrder(rawHi, rawLo, altOrder);
  const type = getInversorExpectedType(register);
  const candidates = [];

  if (Number.isFinite(raw32)) {
    candidates.push(raw32 / 100, raw32 / 10, raw32);
  }
  if (Number.isFinite(raw32Alt) && raw32Alt !== raw32) {
    candidates.push(raw32Alt / 100, raw32Alt / 10, raw32Alt);
  }
  if (Number.isFinite(rawHi)) {
    candidates.push(rawHi / 100, rawHi / 10, rawHi);
  }
  if (Number.isFinite(rawLo)) {
    candidates.push(rawLo / 100, rawLo / 10, rawLo);
  }

  return pickInversorValue(candidates, type);
}

function decodeInversorValue(register, valuesByRegister) {
  const rawHi = valuesByRegister.get(register);
  const rawLo = valuesByRegister.get(register + 1);
  const order = getFloatWordOrder();
  const altOrder = getAlternateFloatWordOrder(order);
  const raw32 = decodeUint32WithOrder(rawHi, rawLo, order);
  const raw32Alt = altOrder === order ? null : decodeUint32WithOrder(rawHi, rawLo, altOrder);
  const type = getInversorExpectedType(register);
  const candidates = [];

  if (Number.isFinite(raw32)) {
    candidates.push(raw32 / 100, raw32 / 10, raw32);
  }
  if (Number.isFinite(raw32Alt) && raw32Alt !== raw32) {
    candidates.push(raw32Alt / 100, raw32Alt / 10, raw32Alt);
  }
  if (Number.isFinite(rawHi)) {
    candidates.push(rawHi / 100, rawHi / 10, rawHi);
  }
  if (Number.isFinite(rawLo)) {
    candidates.push(rawLo / 100, rawLo / 10, rawLo);
  }

  return pickInversorValue(candidates, type);
}

function roundToTwo(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function readPm2130SedesValuesByUnit(unitId) {
  const valuesByRegister = new Map();
  let hasAnyData = false;
  let lastError = null;
  let responsive = false;

  const isIllegalDataAddress = (err) => /illegal data address|exception 2/i.test(String(err?.message || err || ""));
  const operations = [
    { name: "holding_base0", fn: readHoldingRegistersForUnit, addressOffset: -1 },
    typeof readInputRegistersForUnit === "function"
      ? { name: "input_base0", fn: readInputRegistersForUnit, addressOffset: -1 }
      : null,
    { name: "holding_base1", fn: readHoldingRegistersForUnit, addressOffset: 0 },
    typeof readInputRegistersForUnit === "function"
      ? { name: "input_base1", fn: readInputRegistersForUnit, addressOffset: 0 }
      : null
  ].filter(Boolean);

  for (const range of PM2130_SEDES_READ_RANGES) {
    let selectedBlock = null;
    let zeroBlock = null;
    let optionalIllegalAddress = false;

    for (const operation of operations) {
      try {
        const address = Math.max(0, range.start + operation.addressOffset);
        const block = await operation.fn(unitId, address, range.count);
        responsive = true;

        const hasNonZero = Array.isArray(block?.data) && block.data.some(value => Number(value) !== 0);
        if (!zeroBlock && Array.isArray(block?.data)) {
          zeroBlock = block;
        }
        if (hasNonZero) {
          selectedBlock = block;
          break;
        }
      } catch (err) {
        if (range.optional && isIllegalDataAddress(err)) {
          optionalIllegalAddress = true;
          continue;
        }
        lastError = new Error(
          `PM2130 unitId=${unitId} range=${range.start}-${range.start + range.count - 1} ${operation.name}: ${err?.message || err}`
        );
      }
    }

    if (!selectedBlock && zeroBlock) {
      selectedBlock = zeroBlock;
    }

    if (!selectedBlock) {
      if (range.optional && optionalIllegalAddress) {
        continue;
      }
      continue;
    }

    for (let index = 0; index < selectedBlock.data.length; index++) {
      valuesByRegister.set(range.start + index, selectedBlock.data[index]);
    }

    hasAnyData = true;
  }

  return {
    valuesByRegister,
    responsive,
    hasAnyData,
    lastError
  };
}

async function readPm2130SedesDevices(connectionInfo) {
  const unitIds = getPm2130SedesUnitIds();
  if (unitIds.length === 0) {
    return { devices: {}, detectedPoints: 0 };
  }

  const activeBlocks = getPm2130SedesActiveBlocks();
  const devices = {};
  let detectedPoints = 0;

  for (let index = 0; index < unitIds.length; index++) {
    const unitId = unitIds[index];
    const deviceIndex = index + 1;
    const deviceKey = `pm_2130_${deviceIndex}`;
    const deviceName = `PM2130-${deviceIndex}`;

    if (activeBlocks && !activeBlocks.has(deviceIndex)) {
      devices[deviceKey] = {
        device_id: deviceKey,
        name: deviceName,
        type: "power_meter",
        model: "2130",
        status: "offline",
        online: false,
        ...getSedesDeviceTags(deviceName),
        modbus_source: {
          ...connectionInfo,
          unitId
        },
        register_range: {
          start: 3000,
          end: 3061
        },
        metrics: {}
      };
      continue;
    }

    try {
      const pmRead = await readPm2130SedesValuesByUnit(unitId);
      const valuesByRegister = pmRead.valuesByRegister;
      const metrics = {};

      PM2130_SEDES_POINTS.forEach(point => {
        const decoded = decodeFloat32(point.register, valuesByRegister);
        metrics[point.metricKey] = {
          value: Number.isFinite(decoded) ? roundToTwo(decoded) : 0,
          unit: point.unit
        };
      });

      if (pmRead.hasAnyData) {
        detectedPoints += PM2130_SEDES_POINTS.length;
      }

      devices[deviceKey] = {
        device_id: deviceKey,
        name: deviceName,
        type: "power_meter",
        model: "2130",
        status: pmRead.hasAnyData ? "online" : "offline",
        online: pmRead.hasAnyData,
        ...getSedesDeviceTags(deviceName),
        modbus_source: {
          ...connectionInfo,
          unitId
        },
        register_range: {
          start: 3000,
          end: 3061
        },
        metrics,
        ...(pmRead.lastError ? { error: pmRead.lastError.message } : {})
      };
    } catch (err) {
      const emptyMetrics = {};
      PM2130_SEDES_POINTS.forEach(point => {
        emptyMetrics[point.metricKey] = {
          value: 0,
          unit: point.unit
        };
      });

      devices[deviceKey] = {
        device_id: deviceKey,
        name: deviceName,
        type: "power_meter",
        model: "2130",
        status: "offline",
        online: false,
        ...getSedesDeviceTags(deviceName),
        modbus_source: {
          ...connectionInfo,
          unitId
        },
        register_range: {
          start: 3000,
          end: 3061
        },
        metrics: emptyMetrics,
        error: err?.message || String(err)
      };
    }
  }

  return { devices, detectedPoints };
}

async function readIon7400SedesPoint(unitId, point) {
  let responsive = false;
  let lastError = null;
  let optionalIllegalAddress = false;
  const operations = [
    { name: "holding_base0", fn: readHoldingRegistersForUnit, addressOffset: -1 },
    typeof readInputRegistersForUnit === "function"
      ? { name: "input_base0", fn: readInputRegistersForUnit, addressOffset: -1 }
      : null,
    { name: "holding_base1", fn: readHoldingRegistersForUnit, addressOffset: 0 },
    typeof readInputRegistersForUnit === "function"
      ? { name: "input_base1", fn: readInputRegistersForUnit, addressOffset: 0 }
      : null
  ].filter(Boolean);

  for (const operation of operations) {
    try {
      const address = Math.max(0, point.register + operation.addressOffset);
      const block = await operation.fn(unitId, address, point.words || 2);
      responsive = true;
      if (Array.isArray(block?.data)) {
        return { data: block.data, responsive, lastError };
      }
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (point.optional && /illegal data address|exception 2/i.test(msg)) {
        optionalIllegalAddress = true;
        continue;
      }
      lastError = new Error(
        `ANALIZADOR unitId=${unitId} reg=${point.register} ${operation.name}: ${msg}`
      );
    }
  }

  if (point.optional && optionalIllegalAddress) {
    return { data: null, responsive, lastError: null };
  }

  return { data: null, responsive, lastError };
}

async function readIon7400SedesValuesByUnit(unitId) {
  const valuesByRegister = new Map();
  let responsive = false;
  let lastError = null;

  for (const point of ION7400_SEDES_POINTS) {
    const pointRead = await readIon7400SedesPoint(unitId, point);
    if (pointRead.responsive) {
      responsive = true;
    }
    if (pointRead.lastError) {
      lastError = pointRead.lastError;
    }
    if (!Array.isArray(pointRead.data)) {
      continue;
    }
    for (let index = 0; index < pointRead.data.length; index++) {
      valuesByRegister.set(point.register + index, pointRead.data[index]);
    }
  }

  return {
    valuesByRegister,
    responsive,
    hasAnyData: valuesByRegister.size > 0,
    lastError
  };
}

async function readIon7400SedesDevices(connectionInfo) {
  const unitIds = getIon7400SedesUnitIds();
  if (unitIds.length === 0) {
    return { devices: {}, detectedPoints: 0, enabled: false };
  }

  const activeBlocks = getIon7400SedesActiveBlocks();
  const devices = {};
  let detectedPoints = 0;

  const normalizeTransfer = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const text = String(value ?? "").trim().toLowerCase();
    if (text === "true" || text === "1" || text === "on") return true;
    if (text === "false" || text === "0" || text === "off") return false;
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return numeric === 1;
    return false;
  };

  for (let index = 0; index < unitIds.length; index++) {
    const unitId = unitIds[index];
    const deviceIndex = index + 1;
    const deviceKey = `analizador_${deviceIndex}`;
    const deviceName = `ANALIZADOR-${deviceIndex}`;

    if (activeBlocks && !activeBlocks.has(deviceIndex)) {
      devices[deviceKey] = {
        device_id: deviceKey,
        name: deviceName,
        type: "analizador",
        model: "ION7400",
        status: "offline",
        online: false,
        ...getSedesDeviceTags(deviceName),
        modbus_source: {
          ...connectionInfo,
          unitId
        },
        metrics: {}
      };
      continue;
    }

    const ionRead = await readIon7400SedesValuesByUnit(unitId);
    const metrics = {};

    ION7400_SEDES_POINTS.forEach(point => {
      if (point.boolean) {
        metrics[point.metricKey] = {
          value: normalizeTransfer(ionRead.valuesByRegister.get(point.register)),
          unit: point.unit
        };
        return;
      }

      const decoded = decodeFloat32(point.register, ionRead.valuesByRegister);
      metrics[point.metricKey] = {
        value: Number.isFinite(decoded) ? roundToTwo(decoded) : 0,
        unit: point.unit
      };
    });

    if (ionRead.hasAnyData || ionRead.responsive) {
      detectedPoints += ION7400_SEDES_POINTS.length;
    }

    devices[deviceKey] = {
      device_id: deviceKey,
      name: deviceName,
      type: "analizador",
      model: "ION7400",
      status: ionRead.responsive ? "online" : "offline",
      online: ionRead.responsive,
      ...getSedesDeviceTags(deviceName),
      modbus_source: {
        ...connectionInfo,
        unitId
      },
      metrics,
      ...(ionRead.lastError ? { error: ionRead.lastError.message } : {})
    };
  }

  return { devices, detectedPoints, enabled: true };
}

function mapModbusMetricKeyByRegister(register) {
  const pm2130Field = getLegacyPm2130Field(register);
  if (pm2130Field) {
    return pm2130Field.metricKey;
  }

  const ion7400Field = getLegacyIon7400Field(register);
  if (ion7400Field) {
    return ion7400Field.metricKey;
  }

  const generadorField = getGeneradorPlantaHospitalField(register);
  if (generadorField) {
    return generadorField.metricKey;
  }

  switch (register) {
    /*
    // Reservado para futuro: modbus_auto actual no expone Generador A/B.
    // Generador A
    case 175: return "active_fault_type";
    case 177: return "current_l1";
    case 179: return "voltage_l12";
    case 181: return "voltage_l1_n";
    case 183: return "current_l2";
    case 185: return "voltage_l23";
    case 187: return "voltage_l2_n";
    case 189: return "current_l3";
    case 191: return "voltage_l31";
    case 193: return "voltage_l3_n";
    case 195: return "voltage_average";
    case 197: return "battery_voltage";
    case 199: return "coolant_temperature";
    case 201: return "engine_run_time_high";
    case 203: return "engine_speed";
    case 205: return "frequency";
    case 207: return "lta_temperature";
    case 209: return "oil_pressure";
    case 211: return "operation_mode_switch_position";
    case 213: return "total_runs";
    // Generador B
    case 215: return "active_fault_type";
    case 217: return "current_l1";
    case 219: return "voltage_l12";
    case 221: return "voltage_l1_n";
    case 223: return "current_l2";
    case 225: return "voltage_l23";
    case 227: return "voltage_l2_n";
    case 229: return "current_l3";
    case 231: return "voltage_l31";
    case 233: return "voltage_l3_n";
    case 235: return "voltage_average";
    case 237: return "battery_voltage";
    case 239: return "coolant_temperature";
    case 241: return "engine_run_time_high";
    case 243: return "engine_speed";
    case 245: return "frequency";
    case 247: return "lta_temperature";
    case 249: return "oil_pressure";
    case 251: return "operation_mode_switch_position";
    case 253: return "total_runs";
    */
    // ION7400
    case 255: return "active_power_a";
    case 257: return "active_power_b";
    case 259: return "active_power_c";
    case 261: return "active_power_total";
    case 263: return "apparent_power_a";
    case 265: return "apparent_power_b";
    case 267: return "apparent_power_c";
    case 269: return "apparent_power_del_a_peak_demand";
    case 271: return "apparent_power_del_b_peak_demand";
    case 273: return "apparent_power_del_c_peak_demand";
    case 275: return "apparent_power_total";
    case 277: return "apparent_power_total_peak_demand";
    case 279: return "current_a";
    case 281: return "current_b";
    case 283: return "current_c";
    case 285: return "power_factor_total";
    case 287: return "frequency";
    case 289: return "power_factor_a";
    case 291: return "power_factor_b";
    case 293: return "power_factor_c";
    case 295: return "short_term_flicker_pst_a_n";
    case 297: return "short_term_flicker_pst_b_n";
    case 299: return "short_term_flicker_pst_c_n";
    case 301: return "thd_current_a_high";
    case 303: return "thd_current_b_high";
    case 305: return "thd_current_c_high";
    case 307: return "thd_voltage_v1_high";
    case 309: return "thd_voltage_v2_high";
    case 311: return "thd_voltage_v3_high";
    case 313: return "voltage_a_b";
    case 315: return "voltage_a_n";
    case 317: return "voltage_b_c";
    case 319: return "voltage_b_n";
    case 321: return "voltage_c_a";
    case 323: return "voltage_c_n";
    // PM2130-1 SEDES
    /*
    case 3010: return "frequency";
    case 3020: return "voltage_a_b";
    case 3022: return "voltage_b_c";
    case 3024: return "voltage_c_a";
    case 3028: return "voltage_a_n";
    case 3030: return "voltage_b_n";
    case 3032: return "voltage_c_n";
    case 3000: return "current_a";
    case 3002: return "current_b";
    case 3004: return "current_c";
    case 3060: return "demand_total";
    */
    default: return null;
  }
}
async function readModbusAutoRegisters(options = {}) {
  try {
    await connectModbus();
    const connectionInfo = require("./modbus_rtu").getModbusConnectionInfo();
    const isSupportedAutoBlock = (block) =>
      /^PM2130-\d+$/.test(String(block || "")) ||
      /^(ION7400|ANALIZADOR)-\d+$/.test(String(block || "")) ||
      /^generador_(planta_hospital|modulos)$/.test(String(block || "")) ||
      /^(ION7400|ANALIZADOR)$/.test(String(block || ""));

    const defaults = getModbusAutoDefaults();
    const includeRaw = String(options.raw ?? options.includeRaw ?? "").toLowerCase() === "true";
    const useDefaults =
      options.auto === true ||
      String(options.auto ?? "").toLowerCase() === "true" ||
      (options.startRegister == null && options.start == null &&
       options.totalRegisters == null && options.count == null);

    const startRegister = Number(
      useDefaults ? defaults.start : (options.startRegister ?? options.start ?? defaults.start)
    );
    const totalRegisters = Number(
      useDefaults ? defaults.count : (options.totalRegisters ?? options.count ?? defaults.count)
    );
    const chunkSize = Number(options.chunkSize ?? options.chunk ?? defaults.chunk);

    if (!Number.isFinite(startRegister) || startRegister < 1) {
      throw new Error("startRegister invalido");
    }
    if (!Number.isFinite(totalRegisters) || totalRegisters < 1) {
      throw new Error("totalRegisters invalido");
    }

    const safeChunk = Math.max(1, Math.min(120, Number.isFinite(chunkSize) ? chunkSize : 60));
    const valuesByRegister = new Map();
    let skippedIllegal = 0;

    const isIllegalDataAddress = (err) => {
      const msg = String(err?.message ?? err ?? "");
      return /illegal data address|exception 2/i.test(msg);
    };
    const isDataLengthError = (err) => {
      const msg = String(err?.message ?? err ?? "");
      return /data length error/i.test(msg);
    };
    const isSlaveDeviceFailure = (err) => {
      const msg = String(err?.message ?? err ?? "");
      return /slave device failure|exception 4/i.test(msg);
    };
    const isTimeoutError = (err) => {
      const msg = String(err?.message ?? err ?? "");
      return /timed out|timeout|etimedout/i.test(msg);
    };

    const readBlock = async (fn, address, count) => fn(address, count);
    const readInputAvailable = typeof client.readInputRegisters === "function";
    const endRegister = startRegister + totalRegisters - 1;
    const extraWords = getExtraWordCount(endRegister);
    const readEndRegister = extraWords > 0 ? endRegister + extraWords : endRegister;
    const inputPreferredRanges = readInputAvailable ? [
      { start: 325, end: 346 }
    ] : [];
    const boundaries = new Set([startRegister, readEndRegister + 1]);
    inputPreferredRanges.forEach(r => {
      boundaries.add(r.start);
      boundaries.add(r.end + 1);
    });
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const getNextBoundary = (reg) => {
      for (const b of sortedBoundaries) {
        if (b > reg) return b;
      }
      return endRegister + 1;
    };
    const isInputPreferred = (reg) =>
      inputPreferredRanges.some(r => reg >= r.start && reg <= r.end);

    const wantedRegisters = new Set();
    for (let reg = startRegister; reg <= endRegister; reg++) {
      const meta = mapModbusMetaByRegister(reg);
      if (!meta || !isSupportedAutoBlock(meta.block)) continue;
      wantedRegisters.add(reg);
      const extra = getExtraWordCount(reg);
      for (let i = 1; i <= extra; i++) {
        wantedRegisters.add(reg + i);
      }
    }

    const wanted = Array.from(wantedRegisters)
      .filter(r => r >= startRegister && r <= readEndRegister)
      .sort((a, b) => a - b);

    const ranges = [];
    let rangeStart = null;
    let prev = null;
    for (const reg of wanted) {
      if (rangeStart === null) {
        rangeStart = reg;
        prev = reg;
        continue;
      }
      if (reg === prev + 1) {
        prev = reg;
        continue;
      }
      ranges.push({ start: rangeStart, end: prev });
      rangeStart = reg;
      prev = reg;
    }
    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: prev });
    }

    for (const range of ranges) {
      let current = range.start;
      while (current <= range.end) {
        const nextBoundary = getNextBoundary(current);
        const segmentEnd = Math.min(range.end, nextBoundary - 1);
        const segmentLength = segmentEnd - current + 1;
        let segmentOffset = 0;

        while (segmentOffset < segmentLength) {
          const remaining = segmentLength - segmentOffset;
          const readCount = Math.min(safeChunk, remaining);
          const registerBase = current + segmentOffset;
          const modbusAddress = registerBase - 1;
          const preferInput = isInputPreferred(registerBase) && readInputAvailable;
          const primaryRead = preferInput ? client.readInputRegisters : client.readHoldingRegisters;
          const secondaryRead = preferInput
            ? client.readHoldingRegisters
            : (readInputAvailable ? client.readInputRegisters : null);

          try {
            let block;
            try {
              block = await readBlock(primaryRead.bind(client), modbusAddress, readCount);
            } catch (err) {
              if (secondaryRead && (isIllegalDataAddress(err) || isDataLengthError(err) || isSlaveDeviceFailure(err))) {
                block = await readBlock(secondaryRead.bind(client), modbusAddress, readCount);
              } else {
                throw err;
              }
            }

            for (let i = 0; i < block.data.length; i++) {
              const register = registerBase + i;
              valuesByRegister.set(register, block.data[i]);
            }
          } catch (err) {
            const isIllegal = isIllegalDataAddress(err);
            const isLength = isDataLengthError(err);
            const isSlaveFail = isSlaveDeviceFailure(err);
            const isTimeout = isTimeoutError(err);
            if (!isIllegal && !isLength && !isSlaveFail && !isTimeout) {
              throw err;
            }

            // Un timeout indica un problema de comunicación. Reintentar cada
            // registro del bloque multiplicaría la espera por readCount.
            if (isTimeout) {
              throw err;
            }

            // V2 cubre miles de registros. Dividir un bloque rechazado en
            // lecturas individuales hace que una petición tarde varios
            // minutos. Se omite el bloque y las métricas quedan en cero/null.
            skippedIllegal += readCount;
          }

          segmentOffset += readCount;
        }

        current = segmentEnd + 1;
      }
    }

    const overwriteRangeWithInputIfAllZero = async (rangeStart, rangeCount) => {
      if (!readInputAvailable) return;
      let hasNonZero = false;
      for (let reg = rangeStart; reg < rangeStart + rangeCount; reg++) {
        const value = valuesByRegister.get(reg);
        if (Number.isFinite(value) && value !== 0) {
          hasNonZero = true;
          break;
        }
      }
      if (hasNonZero) return;
      try {
        const block = await readBlock(client.readInputRegisters.bind(client), rangeStart - 1, rangeCount);
        for (let i = 0; i < block.data.length; i++) {
          valuesByRegister.set(rangeStart + i, block.data[i]);
        }
      } catch (_) {
        // ignore input fallback errors
      }
    };

    // Los fallbacks sobre valores cero agregan muchas lecturas y pueden tardar
    // minutos cuando Input Registers no está disponible en el AS-P. En V2 se
    // habilitan solamente de forma explícita.
    const enableZeroInputFallback =
      String(process.env.MODBUS_AUTO_V2_ZERO_INPUT_FALLBACK ?? "false").toLowerCase() === "true";
    if (enableZeroInputFallback) {
    await overwriteRangeWithInputIfAllZero(101, 28);
    await overwriteRangeWithInputIfAllZero(129, 28);
    // PM2130 legacy: algunos bloques pueden venir en Input aunque Holding
    // responda en cero, así que intentamos sobrescribir el bloque completo.
    for (const cfg of LEGACY_PM2130_BLOCKS) {
      await overwriteRangeWithInputIfAllZero(cfg.start, LEGACY_PM2130_FIELDS.length * 2);
    }
    // ION7400: fallback a Input si Holding viene todo en 0
    await overwriteRangeWithInputIfAllZero(255, 69);
    for (const cfg of GENERADOR_BLOCKS) {
      await overwriteRangeWithInputIfAllZero(
        cfg.start,
        cfg.end - cfg.start + 2
      );
    }

    // ION7400: fallback por registro si Holding viene en 0 (aunque el bloque no est� todo en 0)
    if (readInputAvailable) {
      const ionFallbackRegisters = [
        255, 257, 259, 261, 263, 265, 267,
        269, 271, 273, 275, 277,
        279, 281, 283, 285, 287,
        295, 297, 299, 301, 303, 305, 307, 309, 311
      ];
      for (const reg of ionFallbackRegisters) {
        const hi = valuesByRegister.get(reg);
        const lo = valuesByRegister.get(reg + 1);
        const missing = !Number.isFinite(hi) || !Number.isFinite(lo);
        const zeroPair = Number(hi) === 0 && Number(lo) === 0;
        if (!missing && !zeroPair) continue;
        try {
          const block = await readBlock(client.readInputRegisters.bind(client), reg - 1, 2);
          valuesByRegister.set(reg, block.data[0]);
          valuesByRegister.set(reg + 1, block.data[1]);
        } catch (_) {
          // ignore input fallback errors
        }
      }
    }
    }

    const ionFloatOrder = getIon7400FloatWordOrder(valuesByRegister);
    const rowsWithMeta = [];
    for (let register = startRegister; register <= endRegister; register++) {
      const meta = mapModbusMetaByRegister(register);
      if (!meta || !isSupportedAutoBlock(meta.block)) continue;
      // modbus_auto solo publica PM2130/ION7400; las ramas ATS/Inversor
      // se atienden en endpoints separados y no se evalúan aquí.
      const isIonBlock = /^(ION7400|ANALIZADOR)(?:-\d+)?$/.test(String(meta.block || ""));
      const isGeneradorBlock = /^generador_(planta_hospital|modulos)$/.test(String(meta.block || ""));
      const rawValue = isGeneradorBlock
        ? decodeGeneradorPlantaHospitalValue(register, valuesByRegister)
        : isIonBlock
        ? decodeIon7400Value(register, valuesByRegister, meta.unit, ionFloatOrder)
        : (isFloat32Register(register)
          ? decodeFloat32(register, valuesByRegister)
          : (valuesByRegister.has(register) ? valuesByRegister.get(register) : null));
      const value = roundToTwo(rawValue);
      const valueTimestamp = isIonBlock
        ? decodeIon7400Timestamp(register, valuesByRegister)
        : null;
      const rawHi = valuesByRegister.get(register);
      const rawLo = valuesByRegister.get(register + 1);
      rowsWithMeta.push({
        register,
        value,
        name: meta.name,
        unit: meta.unit,
        block: meta.block,
        metricKey: meta.metricKey,
        harmonic: meta.harmonic === true,
        modified: new Date().toISOString(),
        ...(includeRaw && isIonBlock
          ? { raw_hi: rawHi, raw_lo: rawLo }
          : {}),
        ...(valueTimestamp ? { value_timestamp: valueTimestamp } : {})
      });
    }

    const scannedAt = new Date().toISOString();
    const scanMode = useDefaults ? "auto" : "manual";
    const devices = {};

    rowsWithMeta.forEach(item => {
      const deviceKey = mapModbusDeviceKey(item.block);
      if (!deviceKey) return;

      if (!devices[deviceKey]) {
        const baseDevice = {
          device_id: deviceKey,
          name: item.block,
          type: mapModbusDeviceType(item.block),
          model: mapModbusDeviceModel(item.block),
          status: "online",
          online: true,
          ...getSedesDeviceTags(item.block)
        };
        const pmMatch = String(item.block || "").match(/^PM2130-(\d+)$/);
        if (pmMatch) {
          const pmIndex = Number(pmMatch[1]);
          const pmCfg = LEGACY_PM2130_BLOCKS[pmIndex - 1];
          const rangeStart = pmCfg?.start ?? (101 + ((pmIndex - 1) * 22));
          baseDevice.modbus_source = connectionInfo;
          baseDevice.register_range = {
            start: rangeStart,
            end: rangeStart + 20
          };
        }
        const ionMatch = String(item.block || "").match(/^(?:ION7400|ANALIZADOR)-(\d+)$/);
        if (ionMatch) {
          const ionIndex = Number(ionMatch[1]);
          const ionCfg = LEGACY_ION7400_BLOCKS[ionIndex - 1];
          const harmonicCfg = LEGACY_ION7400_HARMONIC_BLOCKS[ionIndex - 1];
          baseDevice.modbus_source = connectionInfo;
          baseDevice.register_range = {
            start: ionCfg?.start ?? 255,
            end: ionCfg?.end ?? 323
          };
          if (harmonicCfg) {
            baseDevice.harmonic_register_range = {
              start: harmonicCfg.start,
              end: harmonicCfg.end
            };
          }
        }
        if (/^generador_(planta_hospital|modulos)$/.test(String(item.block || ""))) {
          const generatorCfg = GENERADOR_BLOCKS.find(cfg => cfg.block === item.block);
          baseDevice.modbus_source = connectionInfo;
          baseDevice.register_range = {
            start: generatorCfg?.start,
            end: generatorCfg?.end
          };
        }
        devices[deviceKey] = {
          ...baseDevice,
          metrics: {},
          ...(mapModbusDeviceType(item.block) === "energy_analyzer" ? { metrics_harmonic: {} } : {})
        };
      }

      const metricKey = item.metricKey || mapModbusMetricKeyByRegister(item.register) || `reg_${item.register}`;
      const metricPayload = {
        value: item.value,
        unit: item.unit
      };
      if (item.value_timestamp) {
        metricPayload.value_timestamp = item.value_timestamp;
      }
      if (item.raw_hi !== undefined || item.raw_lo !== undefined) {
        metricPayload.raw_hi = item.raw_hi;
        metricPayload.raw_lo = item.raw_lo;
      }
      if (item.harmonic && devices[deviceKey].metrics_harmonic) {
        devices[deviceKey].metrics_harmonic[metricKey] = metricPayload;
      } else {
        devices[deviceKey].metrics[metricKey] = metricPayload;
      }

      /*
      // Reservado para futuro: modbus_auto actual no arma payload ATS,
      // así que este cálculo de conexión queda comentado.
      if (item.block === "ATS A" || item.block === "ATS B") {
        const device = devices[deviceKey];
        if (!device._ln1Positive) device._ln1Positive = false;
        if (!device._ln2Positive) device._ln2Positive = false;

        const value = Number(item.value);
        const isPositive = Number.isFinite(value) && value > 0;
        const isAtsA = item.block === "ATS A";
        const isLn1 =
          (isAtsA && item.register >= 103 && item.register <= 113) ||
          (!isAtsA && item.register >= 131 && item.register <= 141);
        const isLn2 =
          (isAtsA && item.register >= 117 && item.register <= 127) ||
          (!isAtsA && item.register >= 145 && item.register <= 155);

        if (isLn1 && isPositive) device._ln1Positive = true;
        if (isLn2 && isPositive) device._ln2Positive = true;
      }
      */
    });

    /*
    // Reservado para futuro: modbus_auto actual no arma payload ATS,
    // así que la conexión ATS se conserva aquí comentada.
    Object.values(devices).forEach(device => {
      if (device.name !== "ATS A" && device.name !== "ATS B") return;
      const ln1 = !!device._ln1Positive;
      const ln2 = !!device._ln2Positive;
      if (ln1 && !ln2) {
        device.connection = "commercial";
      } else if (ln2 && !ln1) {
        device.connection = "generator";
      } else if (ln1 && ln2) {
        device.connection = "mixed";
      } else {
        device.connection = "unknown";
      }
      delete device._ln1Positive;
      delete device._ln2Positive;
    });
    */

    const pm7Device = devices["pm_2130_7"];
    const pm7Cfg = LEGACY_PM2130_BLOCKS.find(cfg => cfg.block === "PM2130-7");
    if (pm7Device && pm7Cfg && !hasAnyNonZeroPm2130Metric(pm7Device.metrics)) {
      const startCandidates = getLegacyPm2130StartCandidates(7, pm7Cfg.start);

      for (const candidateStart of startCandidates) {
        const candidateMetrics = buildLegacyPm2130MetricsFromStart(candidateStart, valuesByRegister);
        if (!hasAnyNonZeroPm2130Metric(candidateMetrics)) continue;
        if (!isLikelyPm2130Metrics(candidateMetrics)) continue;

        pm7Device.metrics = candidateMetrics;
        pm7Device.status = "online";
        pm7Device.online = true;
        pm7Device.register_range = {
          start: candidateStart,
          end: candidateStart + 20
        };
        break;
      }
    }

        const pm2130Sedes = await readPm2130SedesDevices(connectionInfo);
    Object.assign(devices, pm2130Sedes.devices);

    const ion7400Sedes = await readIon7400SedesDevices(connectionInfo);
    if (ion7400Sedes.enabled) {
      delete devices["ion_7400"];
      delete devices["analizador"];
      Object.assign(devices, ion7400Sedes.devices);
    }

    return {
      modbus_ebo: {
        source: connectionInfo,
        scan: {
          mode: scanMode,
          scanned_at: scannedAt,
          range: {
            start_register: startRegister,
            total_registers: totalRegisters,
            chunk_size: safeChunk
          },
          result: {
            detected_points: rowsWithMeta.length + pm2130Sedes.detectedPoints + ion7400Sedes.detectedPoints,
            skipped_illegal_registers: skippedIllegal
          }
        },
        devices
      }
    };
  } catch (err) {
    return {
      modbus_ebo: {
        error: err.message
      },
      error: err.message
    };
  }
}



module.exports = { /*readATSA_ModbusVariables,
  readATSB_ModbusVariables,
  readInversorMateo_ModbusVariables,*/
  readModbusAutoRegisters };






