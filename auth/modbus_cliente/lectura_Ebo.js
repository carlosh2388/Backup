const { client, connectModbus } = require("./modbus_rtu");
//const { client: clientASP, connectModbusASP } = require("./modbus_AS-P");

/**
 * Lee variables ATS A exactamente como en EBO WorkStation
 */
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

   console.log("? Inversor Mateo Modbus Variables LECTURA EBO:", { block, timestamp, data: dataWithMeta });
    return dataWithMeta;

  } catch (err) {
    console.error("? Error leyendo Inversor Mateo Modbus:", err.message);
    return [];
  }
}

/*
async function readVoltajeIIMedidorPrincipal() {
  if (String(process.env.MODBUS_ASP_ENABLED ?? "true").toLowerCase() === "false") {
    return null;
  }
  await connectModbusASP();

  try {
    const registerNumber = Number(process.env.MODBUS_ASP_REGISTER || 3020);
    const address = Math.max(0, registerNumber - 1); // Modbus es base 0
    const ids = String(process.env.MODBUS_ASP_IDS || process.env.MODBUS_ASP_ID || "1")
      .split(",")
      .map(v => Number(String(v).trim()))
      .filter(v => Number.isFinite(v));

    const readFns = [
      { name: "holding", fn: clientASP.readHoldingRegisters.bind(clientASP) },
      clientASP.readInputRegisters
        ? { name: "input", fn: clientASP.readInputRegisters.bind(clientASP) }
        : null
    ].filter(Boolean);

    const shouldRetry = (err) => {
      const msg = String(err?.message ?? err ?? "");
      return /gateway path unavailable|exception 10|illegal data address|exception 2/i.test(msg);
    };

    let lastErr;
    for (const id of ids) {
      clientASP.setID(id);
      for (const rf of readFns) {
        try {
          const res = await rf.fn(address, 1);
          console.log("Respuesta Modbus ION7400 (reg", registerNumber, ", id", id, ",", rf.name, "):", res.data);
          const raw = res.data[0];
          return {
            name: "Voltaje II Medidor principal-ION7400",
            value: raw,
            unit: "V"
          };
        } catch (err) {
          lastErr = err;
          if (!shouldRetry(err)) {
            throw err;
          }
        }
      }
    }

    throw lastErr || new Error("No se pudo leer registro ION7400");
  } catch (err) {
    console.error("? Error leyendo Voltaje II AS-P-EBO:", err.message);
    return null;
  }
}
  */
function getModbusAutoDefaults() {
  const startEnv = Number(process.env.MODBUS_AUTO_START);
  const endEnv = Number(process.env.MODBUS_AUTO_END);
  const countEnv = Number(process.env.MODBUS_AUTO_COUNT);
  const chunkEnv = Number(process.env.MODBUS_AUTO_CHUNK);

  const start = Number.isFinite(startEnv) && startEnv > 0 ? startEnv : 101;
  const end = Number.isFinite(endEnv) && endEnv >= start ? endEnv : null;
  const countFromEnd = end ? end - start + 1 : null;
  const count = Number.isFinite(countEnv) && countEnv > 0
    ? countEnv
    : (Number.isFinite(countFromEnd) && countFromEnd > 0 ? countFromEnd : 60);
  const chunk = Number.isFinite(chunkEnv) && chunkEnv > 0 ? chunkEnv : 60;

  return { start, count, chunk, end };
}

function mapModbusMetaByRegister(register) {
  switch (register) {
    // ATS A
    case 101: return { block: "ATS A", name: "LN1 Frequency", unit: "Hz" };
    case 103: return { block: "ATS A", name: "LN1 V1 Voltage", unit: "V" };
    case 105: return { block: "ATS A", name: "LN1 V2 Voltage", unit: "V" };
    case 107: return { block: "ATS A", name: "LN1 V3 Voltage", unit: "V" };
    case 109: return { block: "ATS A", name: "LN1 V12 Voltage", unit: "V" };
    case 111: return { block: "ATS A", name: "LN1 V23 Voltage", unit: "V" };
    case 113: return { block: "ATS A", name: "LN1 V31 Voltage", unit: "V" };
    case 115: return { block: "ATS A", name: "LN2 Frequency", unit: "Hz" };
    case 117: return { block: "ATS A", name: "LN2 V1 Voltage", unit: "V" };
    case 119: return { block: "ATS A", name: "LN2 V2 Voltage", unit: "V" };
    case 121: return { block: "ATS A", name: "LN2 V3 Voltage", unit: "V" };
    case 123: return { block: "ATS A", name: "LN2 V12 Voltage", unit: "V" };
    case 125: return { block: "ATS A", name: "LN2 V23 Voltage", unit: "V" };
    case 127: return { block: "ATS A", name: "LN2 V31 Voltage", unit: "V" };
    // ATS B
    case 129: return { block: "ATS B", name: "LN1 Frequency", unit: "Hz" };
    case 131: return { block: "ATS B", name: "LN1 V1 Voltage", unit: "V" };
    case 133: return { block: "ATS B", name: "LN1 V2 Voltage", unit: "V" };
    case 135: return { block: "ATS B", name: "LN1 V3 Voltage", unit: "V" };
    case 137: return { block: "ATS B", name: "LN1 V12 Voltage", unit: "V" };
    case 139: return { block: "ATS B", name: "LN1 V23 Voltage", unit: "V" };
    case 141: return { block: "ATS B", name: "LN1 V31 Voltage", unit: "V" };
    case 143: return { block: "ATS B", name: "LN2 Frequency", unit: "Hz" };
    case 145: return { block: "ATS B", name: "LN2 V1 Voltage", unit: "V" };
    case 147: return { block: "ATS B", name: "LN2 V2 Voltage", unit: "V" };
    case 149: return { block: "ATS B", name: "LN2 V3 Voltage", unit: "V" };
    case 151: return { block: "ATS B", name: "LN2 V12 Voltage", unit: "V" };
    case 153: return { block: "ATS B", name: "LN2 V23 Voltage", unit: "V" };
    case 155: return { block: "ATS B", name: "LN2 V31 Voltage", unit: "V" };
    // Inversor Mateo
    case 157: return { block: "Inversor Mateo", name: "Bateria Corriente", unit: "A" };
    case 159: return { block: "Inversor Mateo", name: "Bateria Voltaje", unit: "V" };
    case 161: return { block: "Inversor Mateo", name: "Entrada Corriente fase 1", unit: "A" };
    case 163: return { block: "Inversor Mateo", name: "Entrada Frecuencia fase 1", unit: "Hz" };
    case 165: return { block: "Inversor Mateo", name: "Entrada Voltaje fase 1", unit: "V" };
    case 167: return { block: "Inversor Mateo", name: "Estado de carga", unit: "%" };
    case 169: return { block: "Inversor Mateo", name: "Salida Corriente fase 1", unit: "A" };
    case 171: return { block: "Inversor Mateo", name: "Salida Frecuencia fase 1", unit: "Hz" };
    case 173: return { block: "Inversor Mateo", name: "Salida Voltaje fase 1", unit: "V" };
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
    case 199: return { block: "Generador A", name: "Coolant Temperature", unit: "°C" };
    case 201: return { block: "Generador A", name: "Engine Run Time (High Byte)", unit: "h" };
    case 203: return { block: "Generador A", name: "Engine Speed", unit: "RPM" };
    case 205: return { block: "Generador A", name: "Frequency", unit: "Hz" };
    case 207: return { block: "Generador A", name: "LTA Temperature", unit: "°C" };
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
    case 239: return { block: "Generador B", name: "Coolant Temperature", unit: "°C" };
    case 241: return { block: "Generador B", name: "Engine Run Time (High Byte)", unit: "h" };
    case 243: return { block: "Generador B", name: "Engine Speed", unit: "RPM" };
    case 245: return { block: "Generador B", name: "Frequency", unit: "Hz" };
    case 247: return { block: "Generador B", name: "LTA Temperature", unit: "°C" };
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
    // PM2130
    case 325: return { block: "PM2130", name: "Voltage A-N", unit: "V" };
    case 327: return { block: "PM2130", name: "Voltage B-N", unit: "V" };
    case 329: return { block: "PM2130", name: "Voltage C-N", unit: "V" };
    case 331: return { block: "PM2130", name: "Voltage A-B", unit: "V" };
    case 333: return { block: "PM2130", name: "Voltage B-C", unit: "V" };
    case 335: return { block: "PM2130", name: "Voltage C-A", unit: "V" };
    case 337: return { block: "PM2130", name: "Current A", unit: "A" };
    case 339: return { block: "PM2130", name: "Current B", unit: "A" };
    case 341: return { block: "PM2130", name: "Current C", unit: "A" };
    case 343: return { block: "PM2130", name: "Frequency", unit: "Hz" };
    case 345: return { block: "PM2130", name: "Demanda Total", unit: "kW" };
    default: return null;
  }
}
function mapModbusDeviceKey(block) {
  switch (block) {
    case "ATS A": return "ats_a";
    case "ATS B": return "ats_b";
    case "Inversor Mateo": return "inverter_mateo";
    case "Generador A": return "generator_a";
    case "Generador B": return "generator_b";
    case "ION7400": return "ion_7400";
    case "PM2130": return "pm_2130";
    default: return null;
  }
}

function mapModbusDeviceType(block) {
  switch (block) {
    case "ATS A":
    case "ATS B":
      return "ats";
    case "Inversor Mateo":
      return "inverter";
    case "Generador A":
    case "Generador B":
      return "generator";
    case "ION7400":
      return "ion";
    case "PM2130":
      return "pm";
    default:
      return "unknown";
  }
}

function mapModbusDeviceModel(block) {
  switch (block) {
    case "ATS A":
    case "ATS B":
      return "PM2130";
    case "Inversor Mateo":
      return "MATEO";
    case "Generador A":
    case "Generador B":
      return "ION7400";
    case "ION7400":
      return "7400";
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
  if (isOdd && register >= 101 && register <= 127) return true; // ATS A
  if (isOdd && register >= 129 && register <= 155) return true; // ATS B
  if (isOdd && register >= 255 && register <= 323) return true; // ION7400
  if (isOdd && register >= 325 && register <= 345) return true; // PM2130
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
  const isOdd = register % 2 === 1;
  if (!isOdd) return false;
  if (register >= 101 && register <= 127) return true; // ATS A
  if (register >= 129 && register <= 155) return true; // ATS B
  if (isInversorRegister(register)) return true; // Inversor Mateo (low word holds value)
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
  const alternateUsable = Number.isFinite(alternate) && alternate !== 0;

  if (isIon7400ScaledRegister(register) && (unit === "%" || unit === "Pst")) {
    return pickIon7400ByUnit(candidates, unit);
  }

  if (primaryUsable) return primary;
  if (Number.isFinite(alternate)) return alternate;

  return Number.isFinite(primary) ? primary : 0;
}

function isIon7400AtsOrderRegister(register) {
  return false;
}

function isIon7400ScaledRegister(register) {
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
  const probeRegisters = [
    255, 257, 259, 261,
    263, 265, 267, 275,
    279, 281, 283, 287,
    313, 315, 317, 319,
    321, 323
  ];

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
function mapModbusMetricKeyByRegister(register) {
  switch (register) {
    // ATS A
    case 101: return "frequency_ln1";
    case 103: return "voltage_ln1_v1";
    case 105: return "voltage_ln1_v2";
    case 107: return "voltage_ln1_v3";
    case 109: return "voltage_ln1_v12";
    case 111: return "voltage_ln1_v23";
    case 113: return "voltage_ln1_v31";
    case 115: return "frequency_ln2";
    case 117: return "voltage_ln2_v1";
    case 119: return "voltage_ln2_v2";
    case 121: return "voltage_ln2_v3";
    case 123: return "voltage_ln2_v12";
    case 125: return "voltage_ln2_v23";
    case 127: return "voltage_ln2_v31";
    // ATS B
    case 129: return "frequency_ln1";
    case 131: return "voltage_ln1_v1";
    case 133: return "voltage_ln1_v2";
    case 135: return "voltage_ln1_v3";
    case 137: return "voltage_ln1_v12";
    case 139: return "voltage_ln1_v23";
    case 141: return "voltage_ln1_v31";
    case 143: return "frequency_ln2";
    case 145: return "voltage_ln2_v1";
    case 147: return "voltage_ln2_v2";
    case 149: return "voltage_ln2_v3";
    case 151: return "voltage_ln2_v12";
    case 153: return "voltage_ln2_v23";
    case 155: return "voltage_ln2_v31";
    // Inversor Mateo
    case 157: return "battery_current";
    case 159: return "battery_voltage";
    case 161: return "input_current_l1";
    case 163: return "input_frequency";
    case 165: return "input_voltage_l1";
    case 167: return "charge_state";
    case 169: return "output_current_l1";
    case 171: return "output_frequency";
    case 173: return "output_voltage_l1";
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
    // PM2130
    case 325: return "voltage_a_n";
    case 327: return "voltage_b_n";
    case 329: return "voltage_c_n";
    case 331: return "voltage_a_b";
    case 333: return "voltage_b_c";
    case 335: return "voltage_c_a";
    case 337: return "current_a";
    case 339: return "current_b";
    case 341: return "current_c";
    case 343: return "frequency";
    case 345: return "demand_total";

    //ION7400
    case 347: return "s1_transfer_normal";
    case 349: return "s2_transfer_generator";
    default: return null;
  }
}
async function readModbusAutoRegisters(options = {}) {
  try {
    await connectModbus();

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
    const totalRegistersToRead = readEndRegister - startRegister + 1;
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
      if (!meta) continue;
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
              if (secondaryRead && (isIllegalDataAddress(err) || isDataLengthError(err) || isSlaveDeviceFailure(err) || isTimeoutError(err))) {
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

            for (let i = 0; i < readCount; i++) {
              try {
                let single;
                try {
                  single = await primaryRead.call(client, modbusAddress + i, 1);
                } catch (errSingle) {
                  if (secondaryRead && (isIllegalDataAddress(errSingle) || isDataLengthError(errSingle) || isSlaveDeviceFailure(errSingle) || isTimeoutError(errSingle))) {
                    single = await secondaryRead.call(client, modbusAddress + i, 1);
                  } else {
                    throw errSingle;
                  }
                }
                const register = registerBase + i;
                valuesByRegister.set(register, single.data[0]);
              } catch (errSingle) {
                if (!isIllegalDataAddress(errSingle) && !isDataLengthError(errSingle) && !isSlaveDeviceFailure(errSingle) && !isTimeoutError(errSingle)) {
                  throw errSingle;
                }
                if (isIllegalDataAddress(errSingle)) {
                  skippedIllegal += 1;
                }
              }
            }
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

    await overwriteRangeWithInputIfAllZero(101, 28);
    await overwriteRangeWithInputIfAllZero(129, 28);
    // ION7400: fallback a Input si Holding viene todo en 0
    await overwriteRangeWithInputIfAllZero(255, 69);

    // ION7400: fallback por registro si Holding viene en 0 (aunque el bloque no esté todo en 0)
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

    const readCoilBlock = async (address, count) => {
      if (typeof client.readCoils === "function") {
        return await readBlock(client.readCoils.bind(client), address, count);
      }
      if (typeof client.readDiscreteInputs === "function") {
        return await readBlock(client.readDiscreteInputs.bind(client), address, count);
      }
      return null;
    };

    try {
      const coilStart = 347;
      const coilEnd = 349;
      const coilCount = coilEnd - coilStart + 1;
      const coilBlock = await readCoilBlock(coilStart - 1, coilCount);
      if (coilBlock && Array.isArray(coilBlock.data)) {
        if (coilBlock.data.length >= 1) {
          valuesByRegister.set(347, coilBlock.data[0]);
        }
        if (coilBlock.data.length >= 3) {
          valuesByRegister.set(349, coilBlock.data[2]);
        }
      }
    } catch (_) {
      // ignore coil read errors
    }

    const readSingleCoil = async (register) => {
      const address = register - 1;
      const block = await readCoilBlock(address, 1);
      if (block && Array.isArray(block.data) && block.data.length >= 1) {
        return block.data[0];
      }
      return undefined;
    };

    const readSingleRegister = async (fn, register) => {
      if (typeof fn !== "function") return undefined;
      const address = register - 1;
      const block = await readBlock(fn.bind(client), address, 1);
      if (block && Array.isArray(block.data) && block.data.length >= 1) {
        return block.data[0];
      }
      return undefined;
    };

    const ensureTransferFlag = async (register) => {
      if (valuesByRegister.has(register)) return;
      try {
        const coilValue = await readSingleCoil(register);
        if (coilValue !== undefined) {
          valuesByRegister.set(register, coilValue);
          return;
        }
      } catch (_) {
        // ignore coil errors
      }
      try {
        const inputValue = await readSingleRegister(client.readInputRegisters, register);
        if (inputValue !== undefined) {
          valuesByRegister.set(register, inputValue);
          return;
        }
      } catch (_) {
        // ignore input errors
      }
      try {
        const holdingValue = await readSingleRegister(client.readHoldingRegisters, register);
        if (holdingValue !== undefined) {
          valuesByRegister.set(register, holdingValue);
        }
      } catch (_) {
        // ignore holding errors
      }
    };

    await ensureTransferFlag(347);
    await ensureTransferFlag(349);


    const primaryOrder = getFloatWordOrder();
    const alternateOrder = getAlternateFloatWordOrder(primaryOrder);
    const atsOrderByBlock = {};
    const atsRanges = [
      { block: "ATS A", start: 101, end: 127 },
      { block: "ATS B", start: 129, end: 155 }
    ];

    atsRanges.forEach(({ block, start, end }) => {
      let hasPrimary = false;
      for (let reg = start; reg <= end; reg += 2) {
        const value = decodeAtsValue(reg, valuesByRegister, primaryOrder);
        if (Number.isFinite(value) && roundToTwo(value) !== 0) {
          hasPrimary = true;
          break;
        }
      }
      if (hasPrimary) {
        atsOrderByBlock[block] = primaryOrder;
        return;
      }

      let hasAlternate = false;
      for (let reg = start; reg <= end; reg += 2) {
        const value = decodeAtsValue(reg, valuesByRegister, alternateOrder);
        if (Number.isFinite(value) && roundToTwo(value) !== 0) {
          hasAlternate = true;
          break;
        }
      }
      atsOrderByBlock[block] = hasAlternate ? alternateOrder : primaryOrder;
    });

    const ionFloatOrder = getIon7400FloatWordOrder(valuesByRegister);
    const rowsWithMeta = [];
    for (let register = startRegister; register <= endRegister; register++) {
      const meta = mapModbusMetaByRegister(register);
      if (!meta) continue;
      const atsOrder = atsOrderByBlock[meta.block];
      const rawValue = (meta.block === "ATS A" || meta.block === "ATS B")
        ? decodeAtsValue(register, valuesByRegister, atsOrder)
        : (meta.block === "Inversor Mateo"
          ? decodeInversorValue(register, valuesByRegister)
          : (meta.block === "ION7400"
            ? decodeIon7400Value(register, valuesByRegister, meta.unit, ionFloatOrder)
            : (isFloat32Register(register)
              ? decodeFloat32(register, valuesByRegister)
              : (valuesByRegister.has(register) ? valuesByRegister.get(register) : null))));
      const value = roundToTwo(rawValue);
      const valueTimestamp = meta.block === "ION7400"
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
        modified: new Date().toISOString(),
        ...(includeRaw && meta.block === "ION7400"
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
          name: item.block,
          type: mapModbusDeviceType(item.block),
          status: "online",
          model: mapModbusDeviceModel(item.block)
        };
        if (item.block === "ATS A" || item.block === "ATS B") {
          baseDevice.connection = "unknown";
        }
        devices[deviceKey] = {
          ...baseDevice,
          metrics: {}
        };
      }

      const metricKey = mapModbusMetricKeyByRegister(item.register) || `reg_${item.register}`;
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
      devices[deviceKey].metrics[metricKey] = metricPayload;

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
    });

    const ionDevice = devices["ion_7400"];
    if (ionDevice) {
      const normalizeTransfer = (value) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value === 1 || value > 0;
        const text = String(value ?? "").trim().toLowerCase();
        if (text === "true" || text === "1" || text === "on") return true;
        if (text === "false" || text === "0" || text === "off") return false;
        return Boolean(value);
      };

      const transferNormalRaw = valuesByRegister.get(347);
      const transferGeneratorRaw = valuesByRegister.get(349);

      if (transferNormalRaw !== undefined && transferNormalRaw !== null) {
        ionDevice.metrics.s1_transfer_normal = {
          value: normalizeTransfer(transferNormalRaw),
          unit: "state"
        };
      }
      if (transferGeneratorRaw !== undefined && transferGeneratorRaw !== null) {
        ionDevice.metrics.s2_transfer_generator = {
          value: normalizeTransfer(transferGeneratorRaw),
          unit: "state"
        };
      }
    }

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

    return {
      modbus_ebo: {
        scan: {
          mode: scanMode,
          scanned_at: scannedAt,
          range: {
            start_register: startRegister,
            total_registers: totalRegisters,
            chunk_size: safeChunk
          },
          result: {
            detected_points: rowsWithMeta.length,
            skipped_illegal_registers: skippedIllegal
          }
        },
        devices
      }
    };
  } catch (err) {
    console.error("Error lectura modbus automatica:", err.message);
    return {
      modbus_ebo: {
        error: err.message
      },
      error: err.message
    };
  }
}



module.exports = { readATSA_ModbusVariables,
  readATSB_ModbusVariables,
  readInversorMateo_ModbusVariables,
  //readVoltajeIIMedidorPrincipal,
  readModbusAutoRegisters };
