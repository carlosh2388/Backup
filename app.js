// ======================================================
//  APP MQTT + PostgreSQL + JWT (PRODUCCIÃ“N)
// ======================================================

require("dotenv").config();

const express = require("express");
const mqtt = require("mqtt");
//const { Pool } = require("pg");
const pool = require("./auth/db"); 
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mssql = require("mssql");
const net = require("net");

const { verifyJWT, requireRole, requireAnyRole } = require("./auth/middleware");

const app = express();
const modbusAutoApp = express();

// ======================================================
//  SENSOR CALCULADO (PRESION PSI)
// ======================================================
const TARGET_DEV_EUI = "74fe48ffffb34e9e";
const TARGET_DEV_EUI_TEMP = "74fe48ffffb18f1d";
const AIO_PRESION = { slope: 9.2165, intercept: -51.88 };
const AIO_TEMPERATURA = { slope: 9.5147, intercept: -138.45 };

// ======================================================
//  MIDDLEWARES
// ======================================================
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});
app.use(express.static("public", {
  etag: false,
  lastModified: false
}));

const wiseRoutes = require('./wise_cliente/wise_auth');
const { WISE_BASE_URL, WISE_TIMEOUT_MS } = require("./wise_cliente/lectura_wise");
app.use('/api/wise', wiseRoutes);
modbusAutoApp.use('/api/wise', apiKeyAuth, wiseRoutes);

function getJwtSignOptions() {
  const expiresIn = String(process.env.JWT_EXPIRES || "").trim();
  if (!expiresIn || /^(never|none|false|0|off)$/i.test(expiresIn)) {
    return {};
  }
  return { expiresIn };
}

// MODBUS
const { /*readATSA_ModbusVariables,
  readATSB_ModbusVariables,
  readInversorMateo_ModbusVariables,*/
  readModbusAutoRegisters } = require("./modbus_cliente/lectura_Ebo");
const {
  readModbusAutoTec,
  getModbusTecConnectionInfo
} = require("./modbus_cliente/lectura_Ebo_TEC");
const { getModbusConnectionInfo } = require("./modbus_cliente/modbus_rtu");

const hasAtsAModbusReader = typeof readATSA_ModbusVariables === "function";
const hasAtsBModbusReader = typeof readATSB_ModbusVariables === "function";
const hasInversorMateoModbusReader = typeof readInversorMateo_ModbusVariables === "function";

const { getObjectList } = require("./bacnet/ebo_device");

// ======================================================
//  MODBUS AUTO API KEY (PUERTO SEPARADO)
// ======================================================
const MODBUS_AUTO_API_KEY = process.env.MODBUS_AUTO_API_KEY || "";
const MODBUS_AUTO_PORT = Number(process.env.MODBUS_AUTO_PORT || 3001);
const MODBUS_AUTO_HOST = process.env.MODBUS_AUTO_HOST || "0.0.0.0";
const MODBUS_AUTO_CACHE_MS = Number(process.env.MODBUS_AUTO_CACHE_MS || 1000);
const MODBUS_AUTO_POLL_MS = Number(process.env.MODBUS_AUTO_POLL_MS || 1000);
const MODBUS_AUTO_SNAPSHOT_MAX_AGE_MS = Number(
  process.env.MODBUS_AUTO_SNAPSHOT_MAX_AGE_MS ||
  Math.max(MODBUS_AUTO_POLL_MS > 0 ? MODBUS_AUTO_POLL_MS * 2 : 0, MODBUS_AUTO_CACHE_MS, 2000)
);
const MODBUS_ATS_ENDPOINTS_ENABLED = String(process.env.MODBUS_ATS_ENDPOINTS_ENABLED ?? "true").toLowerCase() !== "false";
const MODBUS_ASP_ENABLED = String(process.env.MODBUS_ASP_ENABLED ?? "true").toLowerCase() !== "false";
const MODBUS_AUTO_ONLY = String(process.env.MODBUS_AUTO_ONLY ?? "false").toLowerCase() === "true";
const MSSQL_SERVER_NAME = process.env.MSSQL_SERVER_NAME || "10.30.39.172\\ION";
const MSSQL_HOST = process.env.MSSQL_HOST || "10.30.39.172";
const MSSQL_INSTANCE = process.env.MSSQL_INSTANCE || "ION";
const MSSQL_PORT = Number(process.env.MSSQL_PORT || 1433);
const MSSQL_USER = process.env.MSSQL_USER || "sbo_user";
const MSSQL_PASSWORD = process.env.MSSQL_PASSWORD || "Siasa2026**";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "sbo_db";
const MSSQL_MODBUS_PROC =
  process.env.MSSQL_MODBUS_PROC || "nsp.usp_modbus_auto_json";
const MSSQL_IGSS_CALIDAD_PROC =
  process.env.MSSQL_IGSS_CALIDAD_PROC || "nsp.usp_CalidadEnergia_IGSS";
const MSSQL_IGSS_HISTORICO_JSON_PROC =
  process.env.MSSQL_IGSS_HISTORICO_JSON_PROC || "nsp.usp_CalidadEnergia_IGSS_Historico_Estructura";
const MSSQL_IGSS_SEDES_PROC =
  process.env.MSSQL_IGSS_SEDES_PROC || "nsp.usp_CatalogoSedesIGSS";
const MSSQL_REQUEST_TIMEOUT_MS = Number(process.env.MSSQL_REQUEST_TIMEOUT_MS || 300000);
const MSSQL_IGSS_REQUEST_TIMEOUT_MS = Number(
  process.env.MSSQL_IGSS_REQUEST_TIMEOUT_MS || MSSQL_REQUEST_TIMEOUT_MS
);

function parseMssqlServerName(raw, fallbackHost, fallbackInstance) {
  const text = String(raw || "").trim();
  if (!text) {
    return { host: fallbackHost, instance: fallbackInstance };
  }
  const parts = text.split("\\");
  const host = parts[0] || fallbackHost;
  const instance = parts[1] || fallbackInstance;
  return { host, instance };
}

const STARTUP_TARGET_CHECK_TIMEOUT_MS = Number(
  process.env.STARTUP_TARGET_CHECK_TIMEOUT_MS || 3000
);
const WISE_STARTUP_CHECK_TIMEOUT_MS = Number(
  process.env.WISE_STARTUP_CHECK_TIMEOUT_MS || WISE_TIMEOUT_MS || 10000
);

function isValidTimeout(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getHttpTargetInfo(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    const protocol = String(parsed.protocol || "").toLowerCase();
    const defaultPort = protocol === "https:" ? 443 : 80;
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : defaultPort
    };
  } catch (_) {
    return null;
  }
}

async function checkTcpTarget(host, port, timeoutMs) {
  const effectiveTimeout = isValidTimeout(timeoutMs, 3000);
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    socket.setTimeout(effectiveTimeout);
    socket.once("connect", () => finish());
    socket.once("timeout", () => finish(new Error(`timeout tras ${effectiveTimeout}ms`)));
    socket.once("error", (err) => finish(err));
    socket.connect(port, host);
  });
}

async function checkTcpTargetWithRetry(host, port, timeoutMs, attempts = 2) {
  let lastError = null;
  const totalAttempts = Math.max(1, Number(attempts) || 1);

  for (let index = 0; index < totalAttempts; index++) {
    try {
      await checkTcpTarget(host, port, timeoutMs);
      return;
    } catch (err) {
      lastError = err;
      if (index < totalAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }

  throw lastError || new Error("Sin respuesta");
}

async function validateStartupTargets() {
  const modbusTarget = getModbusConnectionInfo();
  const wiseTarget = getHttpTargetInfo(WISE_BASE_URL);
  const modbusTimeout = isValidTimeout(
    Math.min(modbusTarget.timeoutMs || STARTUP_TARGET_CHECK_TIMEOUT_MS, STARTUP_TARGET_CHECK_TIMEOUT_MS),
    3000
  );
  const wiseTimeout = isValidTimeout(
    WISE_STARTUP_CHECK_TIMEOUT_MS,
    WISE_TIMEOUT_MS || 10000
  );

  const checks = [
    (async () => {
      try {
        await checkTcpTarget(modbusTarget.host, modbusTarget.port, modbusTimeout);
        console.log(`? Config Modbus OK -> ${modbusTarget.host}:${modbusTarget.port}`);
      } catch (err) {
        console.warn(`? Config Modbus sin respuesta -> ${modbusTarget.host}:${modbusTarget.port} (${err.message})`);
      }
    })(),
    (async () => {
      if (!wiseTarget?.host || !wiseTarget?.port) {
        console.warn(`? Config WISE invalida -> ${WISE_BASE_URL}`);
        return;
      }
      try {
        await checkTcpTargetWithRetry(wiseTarget.host, wiseTarget.port, wiseTimeout, 2);
        console.log(`? Config WISE OK -> ${wiseTarget.host}:${wiseTarget.port}`);
      } catch (err) {
        console.warn(`? Config WISE sin respuesta -> ${wiseTarget.host}:${wiseTarget.port} (${err.message})`);
      }
    })()
  ];

  await Promise.allSettled(checks);
}

const MSSQL_SERVER = parseMssqlServerName(
  MSSQL_SERVER_NAME,
  MSSQL_HOST,
  MSSQL_INSTANCE
);

const MSSQL_CONFIG = {
  user: MSSQL_USER,
  password: MSSQL_PASSWORD,
  server: MSSQL_SERVER.host,
  port: MSSQL_PORT,
  database: MSSQL_DATABASE || undefined,
  requestTimeout: MSSQL_REQUEST_TIMEOUT_MS,
  connectionTimeout: Number(process.env.MSSQL_CONNECTION_TIMEOUT_MS || 30000),
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: MSSQL_SERVER.instance
  }
};

let mssqlPool = null;
let mssqlPoolPromise = null;

let modbusAutoCache = { key: null, ts: 0, data: null };
const modbusAutoInFlight = new Map();
let modbusAutoSnapshot = { ts: 0, data: null, error: null, inFlight: false };
let modbusAutoPollTimer = null;
let shuttingDown = false;

if (MODBUS_AUTO_ONLY) {
  app.use((req, res, next) => {
    if (req.path === "/api/ebo/modbus-auto") return next();
    if (req.path === "/api/ebo/modbus_auto_tec") return next();
    if (req.path === "/api/ebo/modbus_calidadenergia") return next();
    if (req.path === "/api/ebo/modbus-auto/health") return next();
    if (req.path === "/api/ebo/modbus_auto_tec/health") return next();
    if (req.path === "/api/ebo/modbus_calidadenergia/health") return next();
    return res.status(404).json({ message: "Solo modbus-auto habilitado" });
  });
}

function getModbusAutoOptions(req) {
  return {
    startRegister: req.query.start,
    totalRegisters: req.query.count,
    chunkSize: req.query.chunk,
    includeZero: req.query.includeZero,
    auto: req.query.auto,
    raw: req.query.raw
  };
}

function isAutoRequest(options) {
  const autoFlag =
    options.auto === true ||
    String(options.auto ?? "").toLowerCase() === "true";
  const hasManual =
    options.startRegister != null ||
    options.totalRegisters != null ||
    options.chunkSize != null;
  return autoFlag || !hasManual;
}

function getModbusAutoError(raw) {
  return raw?.modbus_ebo?.error || raw?.error || null;
}

function buildModbusAutoErrorResponse(err) {
  const detail = getModbusAutoError(err?.raw) || err?.message || String(err);
  return {
    message: "Error leyendo registros modbus automaticamente",
    error: detail
  };
}

function hasFreshModbusAutoSnapshot(now = Date.now()) {
  if (!modbusAutoSnapshot.data) return false;
  if (!Number.isFinite(modbusAutoSnapshot.ts) || modbusAutoSnapshot.ts <= 0) return false;
  if (!hasCompleteModbusAutoPayload(modbusAutoSnapshot.data)) return false;
  return (now - modbusAutoSnapshot.ts) <= MODBUS_AUTO_SNAPSHOT_MAX_AGE_MS;
}

function hasAnyModbusAutoSnapshot() {
  return Boolean(modbusAutoSnapshot.data) &&
    Number.isFinite(modbusAutoSnapshot.ts) &&
    modbusAutoSnapshot.ts > 0;
}

function hasCompleteModbusAutoPayload(raw) {
  const devices = raw?.modbus_ebo?.devices || {};
  const hasGenerators = Boolean(devices.generador_planta_hospital && devices.generador_modulos);
  const analyzer = devices.analizador_1 || devices.ion_7400_1;
  const harmonicMetrics = analyzer?.metrics_harmonic || {};
  const hasHarmonics =
    Object.keys(harmonicMetrics).length > 0 ||
    Object.keys(analyzer?.metrics || {}).some(key => /_harmonic_\d{2}$/.test(key));
  return hasGenerators && hasHarmonics;
}

function hasCompleteModbusAutoSnapshot() {
  return hasAnyModbusAutoSnapshot() && hasCompleteModbusAutoPayload(modbusAutoSnapshot.data);
}

function formatModbusAutoPayload(raw) {
  const modbus = raw?.modbus_ebo || {};
  const devicesObj = modbus?.devices || {};
  const order = ["pm_2130", "analizador", "generador_planta_hospital", "generador_modulos"];
  const generatorOrder = ["generador_planta_hospital", "generador_modulos"];
  const palinDevicePattern = /^(analizador(?:_\d+)?|ion_7400(?:_\d+)?|pm_2130(?:_\d+)?|generador_(planta_hospital|modulos))$/;
  const hasPalinName = (name) =>
    /^(ION7400|ANALIZADOR)(?:-\d+)?$/.test(name) ||
    /^PM2130-\d+$/.test(name) ||
    generatorOrder.includes(name);
  const ionTransferKeys = new Set([
    "comercial",
    "generador",
    "s1_transfer_normal",
    "s2_transfer_generator",
    "s1_commercial_energy_status",
    "s2_generator_energy_status",
    "s1_commercial_transition_count",
    "s1_commercial_power_status",
    "s2_generator_power_status",
    "s2_generator_s1_commercial_transition_count",
    "s2_generator_transition_count"
  ]);
  const tagKeys = ["area", "building", "floor", "group", "room", "fase_energy", "module_group", "code_inventory"];
  const vigilantConfigs = [
    { sourceDeviceIds: ["analizador_1", "ion_7400_1"], deviceId: "vigilante_analizador-1" },
    { sourceDeviceIds: ["analizador_5", "ion_7400_5"], deviceId: "vigilante_analizador-5" }
  ];
  const pm2130DeviceMap = {
    1: { deviceId: "540220103317", name: "MEDIDOR DE ENERGIA 1" },
    2: { deviceId: "540220103817", name: "MEDIDOR DE ENERGIA 2" },
    3: { deviceId: "540220103798", name: "MEDIDOR DE ENERGIA 3" },
    4: { deviceId: "540220103796", name: "MEDIDOR DE ENERGIA 4" },
    5: { deviceId: "5402203835", name: "MEDIDOR DE ENERGIA 5" },
    6: { deviceId: "540220103790", name: "MEDIDOR DE ENERGIA 6" },
    7: { deviceId: "540220103662", name: "MEDIDOR DE ENERGIA 7" }
  };
  const analyzerDeviceMap = {
    1: { deviceId: "MR2511C35303", name: "ANALIZADOR DE ENERGIA 1", code: "HES107" },
    2: { deviceId: "MR2511D52003", name: "ANALIZADOR DE ENERGIA 2", code: "HES108" },
    3: { deviceId: "MR2511D37703", name: "ANALIZADOR DE ENERGIA 3", code: "HES105" },
    4: { deviceId: "MR2111C34903", name: "ANALIZADOR DE ENERGIA 4", code: "HES106" },
    5: { deviceId: "MR2410A45603", name: "ANALIZADOR DE ENERGIA 5", code: "HES109" },
    6: { deviceId: "MR2509C22103", name: "ANALIZADOR DE ENERGIA 6", code: "HES110" }
  };
  const generatorDeviceMap = {
    generador_planta_hospital: { deviceId: "GENO1", name: "PLANTA HOSPITAL", code: "HES107" },
    generador_modulos: { deviceId: "GENO2", name: "PLANTA MODULOS", code: "HES109" }
  };

  const getDeviceTags = (device, options = {}) => {
    const effectiveTagKeys = options.includeCapacity
      ? [...tagKeys, "capacity"]
      : tagKeys;
    const deviceTags = {};
    [...effectiveTagKeys, "code"].forEach(key => {
      if (device?.[key] !== undefined) {
        deviceTags[key] = device[key];
      }
    });
    return deviceTags;
  };

  const getPm2130Index = (deviceId, deviceName) => {
    const match =
      String(deviceId || "").match(/^pm_2130_(\d+)$/i) ||
      String(deviceName || "").match(/^PM2130-(\d+)$/i);
    return match ? Number(match[1]) : null;
  };

  const getAnalyzerIndex = (deviceId, deviceName) => {
    const match =
      String(deviceId || "").match(/^(?:analizador|ion_7400)_(\d+)$/i) ||
      String(deviceName || "").match(/^(?:ANALIZADOR|ION7400)-(\d+)$/i);
    return match ? Number(match[1]) : null;
  };

  const getMetricValue = (metrics, keys) => {
    for (const key of keys) {
      if (!metrics || typeof metrics !== "object" || !(key in metrics)) continue;
      const entry = metrics[key];
      return entry && typeof entry === "object" && "value" in entry
        ? entry.value
        : entry;
    }
    return undefined;
  };

  const normalizeStateNumber = (value) => {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value === 1 ? 1 : 0;
    const text = String(value ?? "").trim().toLowerCase();
    if (text === "true" || text === "1" || text === "on") return 1;
    if (text === "false" || text === "0" || text === "off") return 0;
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return numeric === 1 ? 1 : 0;
    return 0;
  };

  const normalizeCount = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const normalizeAnalyzerName = (name) =>
    String(name || "").replace(/^ION7400-(\d+)$/i, "ANALIZADOR-$1");

  const normalizeAnalyzerDeviceId = (deviceId) =>
    String(deviceId || "").replace(/^ion_7400_(\d+)$/i, "analizador_$1");

  const stripIonKeys = (source) => {
    const cleaned = {};
    Object.entries(source || {}).forEach(([key, val]) => {
      if (ionTransferKeys.has(key)) return;
      cleaned[key] = val;
    });
    return cleaned;
  };

  const splitIonMetrics = (metrics, harmonicMetrics) => {
    const normal = {};
    const harmonic = { ...(harmonicMetrics || {}) };
    Object.entries(metrics || {}).forEach(([key, val]) => {
      if (/_harmonic_\d{2}$/.test(key)) {
        harmonic[key] = val;
        return;
      }
      normal[key] = val;
    });
    return { normal, harmonic };
  };

  const buildVigilantDevice = (formattedDevices, config) => {
    const sourceDeviceIds = config.sourceDeviceIds || [config.sourceDeviceId];
    const normalizedSourceIds = sourceDeviceIds.map(normalizeAnalyzerDeviceId);
    const sourceDevice = formattedDevices.find(device =>
      normalizedSourceIds.includes(String(device.device_id)) ||
      normalizedSourceIds.includes(String(device._legacy_device_id || ""))
    );
    if (!sourceDevice) return null;

    const rawSourceId = sourceDeviceIds.find(deviceId => devicesObj?.[deviceId]?.metrics);
    const sourceMetrics = devicesObj?.[rawSourceId]?.metrics || {};
    const vigilantTags = getDeviceTags(sourceDevice);
    delete vigilantTags.fase_energy;
    delete vigilantTags.module_group;
    delete vigilantTags.code_inventory;

    return {
      device_id: config.deviceId,
      name: config.deviceId,
      type: "vigilant",
      model: "GRV8-10",
      online: sourceDevice.online,
      ...vigilantTags,
      metrics: {
        s1_commercial_energy_status: {
          value: normalizeStateNumber(getMetricValue(sourceMetrics, [
            "s1_commercial_energy_status",
            "s1_commercial_power_status",
            "S1_comercial_status",
            "s1_comercial_status",
            "s1_transfer_normal"
          ])),
          unit: "state"
        },
        s2_generator_energy_status: {
          value: normalizeStateNumber(getMetricValue(sourceMetrics, [
            "s2_generator_energy_status",
            "s2_generator_power_status",
            "S2_generator_status",
            "s2_generator_status",
            "s2_transfer_generator"
          ])),
          unit: "state"
        },
        s1_commercial_transition_count: {
          value: normalizeCount(getMetricValue(sourceMetrics, [
            "s1_commercial_transition_count",
            "s2_generator_s1_commercial_transition_count",
            "S2_generator_status_s1_comercial_conteo",
            "s2_generator_status_s1_comercial_conteo"
          ])),
          unit: "count"
        },
        s2_generator_transition_count: {
          value: normalizeCount(getMetricValue(sourceMetrics, [
            "s2_generator_transition_count",
            "S2_GENERATOR_CONTEO",
            "s2_generator_conteo"
          ])),
          unit: "count"
        }
      }
    };
  };

  const normalizeVigilantMetrics = (device) => {
    if (!["vigilante", "vigilant"].includes(String(device?.type || "").toLowerCase())) return device;
    const metrics = device.metrics || {};
    return {
      ...device,
      type: "vigilant",
      metrics: {
        s1_commercial_energy_status: {
          value: normalizeStateNumber(getMetricValue(metrics, [
            "s1_commercial_energy_status",
            "s1_commercial_power_status"
          ])),
          unit: "state"
        },
        s2_generator_energy_status: {
          value: normalizeStateNumber(getMetricValue(metrics, [
            "s2_generator_energy_status",
            "s2_generator_power_status"
          ])),
          unit: "state"
        },
        s1_commercial_transition_count: {
          value: normalizeCount(getMetricValue(metrics, [
            "s1_commercial_transition_count",
            "s2_generator_s1_commercial_transition_count"
          ])),
          unit: "count"
        },
        s2_generator_transition_count: {
          value: normalizeCount(getMetricValue(metrics, [
            "s2_generator_transition_count"
          ])),
          unit: "count"
        }
      }
    };
  };

  const devices = Object.entries(devicesObj)
    .filter(([deviceId, device]) =>
      palinDevicePattern.test(String(deviceId)) || hasPalinName(String(device?.name || ""))
    )
    .map(([deviceId, device]) => {
      const metrics = device?.metrics || {};
      const deviceType = String(device?.type || "").toLowerCase();
      const deviceName = String(device?.name || "");
      const upperDeviceName = deviceName.toUpperCase();
      const isIon = deviceType === "ion" ||
        deviceType === "analizador" ||
        deviceType === "energy_analyzer" ||
        upperDeviceName.includes("ION7400") ||
        upperDeviceName.includes("ANALIZADOR");
      const deviceTags = getDeviceTags(device, { includeCapacity: isIon });

      let formattedMetrics = metrics;
      let formattedHarmonicMetrics = null;
      if (isIon) {
        const sourceHarmonicMetrics = device?.metrics_harmonic &&
          typeof device.metrics_harmonic === "object"
          ? device.metrics_harmonic
          : {};
        const splitMetrics = splitIonMetrics(stripIonKeys(metrics), sourceHarmonicMetrics);
        formattedMetrics = {
          comercial: splitMetrics.normal
        };
        formattedHarmonicMetrics = splitMetrics.harmonic;
      }

      const onlineFlag =
        (device?.status === "online" || device?.status === true || device?.status === "true") ? "true" : "false";

      const pmIndex = getPm2130Index(deviceId, deviceName);
      const pmConfig = pmIndex ? pm2130DeviceMap[pmIndex] : null;
      const analyzerIndex = isIon ? getAnalyzerIndex(deviceId, deviceName) : null;
      const analyzerConfig = analyzerIndex ? analyzerDeviceMap[analyzerIndex] : null;
      const generatorConfig = generatorDeviceMap[String(deviceId)] || generatorDeviceMap[String(deviceName)];
      const legacyDeviceId = normalizeAnalyzerDeviceId(deviceId);
      const type = isIon ? "energy_analyzer" : (generatorConfig ? "electric_generator" : (device?.type || "unknown"));
      const model = isIon
        ? "ION7400"
        : (String(device?.type || "").toLowerCase() === "ats" ? "Schneider ATS" : (device?.model || ""));

      const formattedDevice = {
        _legacy_device_id: legacyDeviceId,
        device_id: pmConfig
          ? pmConfig.deviceId
          : analyzerConfig
          ? analyzerConfig.deviceId
          : generatorConfig
          ? generatorConfig.deviceId
          : legacyDeviceId,
        name: pmConfig
          ? pmConfig.name
          : analyzerConfig
          ? analyzerConfig.name
          : generatorConfig
          ? generatorConfig.name
          : normalizeAnalyzerName(device?.name || deviceId),
        type: pmConfig ? "power_meter" : type,
        model,
        online: onlineFlag,
        ...deviceTags,
        ...(pmIndex === 1 ? { code: "HES107" } : {}),
        ...(generatorConfig?.code ? { code: generatorConfig.code } : {}),
        metrics: formattedMetrics,
        ...(isIon ? { metrics_harmonic: formattedHarmonicMetrics } : {}),
        ...(device?.error ? { error: device.error } : {})
      };
      if (pmConfig || analyzerConfig || generatorConfig) {
        delete formattedDevice.module_group;
      }
      if (pmConfig && pmIndex !== 1) {
        delete formattedDevice.code;
      }
      if (generatorConfig) {
        delete formattedDevice.code_inventory;
      }
      return formattedDevice;
    })
    .filter(device => device.online === "true");

  vigilantConfigs
    .map(config => buildVigilantDevice(devices, config))
    .filter(Boolean)
    .forEach(device => devices.push(device));

  for (let index = 0; index < devices.length; index++) {
    devices[index] = normalizeVigilantMetrics(devices[index]);
  }

  devices.sort((a, b) => {
    const vigilantOrder = new Map([
      ["vigilante_analizador-1", 1.1],
      ["vigilante_analizador-5", 5.1]
    ]);
    const getIonOrVigilantOrder = (device) => {
      if (vigilantOrder.has(String(device.device_id))) {
        return vigilantOrder.get(String(device.device_id));
      }
      const serialMatch = Object.entries(analyzerDeviceMap)
        .find(([, config]) => String(config.deviceId) === String(device.device_id));
      if (serialMatch) return Number(serialMatch[0]);
      const ionMatch = String(device._legacy_device_id || device.device_id).match(/^(?:analizador|ion_7400)_(\d+)$/);
      return ionMatch ? Number(ionMatch[1]) : null;
    };
    const getPm2130Order = (device) => {
      const legacyMatch = String(device.device_id).match(/^pm_2130_(\d+)$/);
      if (legacyMatch) return Number(legacyMatch[1]);
      const found = Object.entries(pm2130DeviceMap)
        .find(([, config]) => String(config.deviceId) === String(device.device_id));
      return found ? Number(found[0]) : null;
    };

    const getGeneratorOrder = (device) => {
      const legacyId = String(device._legacy_device_id || device.device_id);
      const directIndex = generatorOrder.indexOf(legacyId);
      if (directIndex !== -1) return directIndex;
      const found = Object.entries(generatorDeviceMap)
        .find(([, config]) => String(config.deviceId) === String(device.device_id));
      return found ? generatorOrder.indexOf(found[0]) : -1;
    };
    const generatorIndexA = getGeneratorOrder(a);
    const generatorIndexB = getGeneratorOrder(b);
    if (generatorIndexA !== -1 || generatorIndexB !== -1) {
      if (generatorIndexA !== -1 && generatorIndexB !== -1) {
        return generatorIndexA - generatorIndexB;
      }
      return generatorIndexA !== -1 ? 1 : -1;
    }

    const ionOrderA = getIonOrVigilantOrder(a);
    const ionOrderB = getIonOrVigilantOrder(b);
    if (ionOrderA !== null || ionOrderB !== null) {
      if (ionOrderA !== null && ionOrderB !== null) {
        return ionOrderA - ionOrderB;
      }
      return ionOrderA !== null ? 1 : -1;
    }

    const pmOrderA = getPm2130Order(a);
    const pmOrderB = getPm2130Order(b);
    if (pmOrderA !== null || pmOrderB !== null) {
      if (pmOrderA !== null && pmOrderB !== null) {
        return pmOrderA - pmOrderB;
      }
      return pmOrderA !== null ? 1 : -1;
    }

    const aIdx = order.indexOf(a.device_id);
    const bIdx = order.indexOf(b.device_id);
    const aKey = aIdx === -1 ? order.length : aIdx;
    const bKey = bIdx === -1 ? order.length : bIdx;
    if (aKey !== bKey) return aKey - bKey;
    return String(a.device_id).localeCompare(String(b.device_id));
  });

  devices.forEach(device => {
    delete device._legacy_device_id;
  });

  return { devices };
}

async function pollModbusAutoSnapshot() {
  if (modbusAutoSnapshot.inFlight) return;
  modbusAutoSnapshot.inFlight = true;
  try {
    const data = await readModbusAutoRegisters({ auto: true });
    const hasError = Boolean(getModbusAutoError(data));
    if (!hasError) {
      modbusAutoSnapshot.data = data;
      modbusAutoSnapshot.error = null;
      modbusAutoSnapshot.ts = Date.now();
    } else {
      // conserva el �ltimo snapshot bueno si esta lectura falla
      modbusAutoSnapshot.error = getModbusAutoError(data) || "modbus_auto_error";
    }
  } catch (err) {
    modbusAutoSnapshot.error = err?.message || String(err);
  } finally {
    modbusAutoSnapshot.inFlight = false;
  }
}

function startModbusAutoPolling() {
  if (!Number.isFinite(MODBUS_AUTO_POLL_MS) || MODBUS_AUTO_POLL_MS <= 0) return;
  if (modbusAutoPollTimer) return;
  pollModbusAutoSnapshot();
  modbusAutoPollTimer = setInterval(pollModbusAutoSnapshot, MODBUS_AUTO_POLL_MS);
}

async function getMssqlPool() {
  if (mssqlPool?.connected) {
    return mssqlPool;
  }
  if (mssqlPoolPromise) {
    return mssqlPoolPromise;
  }

  const pool = new mssql.ConnectionPool(MSSQL_CONFIG);
  pool.on("error", (err) => {
    console.error("Error en pool MSSQL:", err.message);
  });
  mssqlPool = pool;
  mssqlPoolPromise = pool.connect()
    .then(() => {
      mssqlPoolPromise = null;
      return mssqlPool;
    })
    .catch((err) => {
      mssqlPoolPromise = null;
      throw err;
    });
  return mssqlPoolPromise;
}

function safeParseJson(value) {
  if (typeof value !== "string") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (err) {
    return { ok: false };
  }
}

function extractMssqlJson(result) {
  if (!result) return null;

  const parseValue = (value) => {
    if (typeof value === "string") {
      const parsed = safeParseJson(value);
      if (parsed.ok) return parsed.value;
    }
    return value;
  };

  if (result.output && typeof result.output === "object") {
    for (const value of Object.values(result.output)) {
      const parsed = parseValue(value);
      if (parsed !== value) return parsed;
    }
  }

  const recordset = result.recordset;
  if (Array.isArray(recordset) && recordset.length > 0) {
    if (recordset.length === 1 && recordset[0] && typeof recordset[0] === "object") {
      const keys = Object.keys(recordset[0]);
      if (keys.length === 1) {
        return parseValue(recordset[0][keys[0]]);
      }
    }
    return recordset;
  }

  return null;
}

function parseSqlDateParam(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== text) return null;

  return text;
}

function parsePositiveIntParam(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getIgssCalidadEnergiaParams(req) {
  const fechaInicio = parseSqlDateParam(req.query.fechaInicio);
  const fechaFin = parseSqlDateParam(req.query.fechaFin);
  const rawSedeId = req.params.sede || req.query.sedeId || req.query.sede_id;
  const sedeId = rawSedeId ? parsePositiveIntParam(rawSedeId, null) : null;

  return {
    fechaInicio,
    fechaFin,
    sedeId
  };
}

function getIgssHistoricoJsonParams(req) {
  const fechaInicio = parseSqlDateParam(req.query.fecha_inicio || req.query.fechaInicio);
  const fechaFin = parseSqlDateParam(req.query.fecha_fin || req.query.fechaFin);
  const rawSedeId = req.query.sede_id || req.query.sedeId || req.params.sede;
  const sedeId = rawSedeId ? parsePositiveIntParam(rawSedeId, null) : null;

  return {
    fechaInicio,
    fechaFin,
    sedeId
  };
}

function normalizeMetricKey(key) {
  return String(key || "")
    .trim()
    .replace(/_+$/g, "")
    .replace(/__+/g, "_");
}

function buildIgssHistoricoJson(rows, fechaInicio, fechaFin, sedeId) {
  const payload = {
    ok: true,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    sede_id: sedeId,
    sede: rows[0]?.sede || null,
    total_registros: rows.length,
    total_devices: 0,
    devices: []
  };
  const devices = new Map();

  for (const row of rows) {
    const deviceId = String(row.device_id || row.DeviceId || row.DispositivoFuente || "").trim();
    if (!deviceId) continue;

    let device = devices.get(deviceId);
    if (!device) {
      device = {
        device_id: deviceId,
        name: row.name || row.Nombre || null,
        type: row.type || row.Tipo || null,
        model: row.model || row.Modelo || null,
        capacity: row.capacity ?? row.Capacity ?? null,
        fase_energy: row.fase_energy || row.FaseEnergy || null,
        metrics: [],
        _metricIndex: new Map()
      };
      devices.set(deviceId, device);
      payload.devices.push(device);
    }

    const fechaHora = row.fecha_hora || row.FechaHora || "";
    let metricGroup = device._metricIndex.get(fechaHora);
    if (!metricGroup) {
      metricGroup = { fecha_hora: fechaHora };
      device._metricIndex.set(fechaHora, metricGroup);
      device.metrics.push(metricGroup);
    }

    const metricKey = normalizeMetricKey(row.metric_key || row.MetricKey);
    if (!metricKey) continue;

    metricGroup[metricKey] = {
      value: row.value ?? row.Valor ?? null,
      unit: row.unit || row.Unit || ""
    };
  }

  for (const device of payload.devices) {
    delete device._metricIndex;
  }

  payload.total_devices = payload.devices.length;
  return payload;
}

async function handleIgssCalidadEnergia(req, res) {
  try {
    res.setTimeout(MSSQL_IGSS_REQUEST_TIMEOUT_MS);

    const { fechaInicio, fechaFin, sedeId } = getIgssCalidadEnergiaParams(req);

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar fechaInicio y fechaFin en formato YYYY-MM-DD"
      });
    }

    if (fechaInicio > fechaFin) {
      return res.status(400).json({
        ok: false,
        error: "fechaInicio no puede ser mayor que fechaFin"
      });
    }

    if (!sedeId) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar sedeId como numero entero positivo"
      });
    }

    const pool = await getMssqlPool();
    const request = pool.request();
    request.timeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS;
    request.stream = true;

    request
      .input("FechaInicio", mssql.Date, fechaInicio)
      .input("FechaFin", mssql.Date, fechaFin)
      .input("SedeId", mssql.Int, sedeId);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");

    let started = false;
    let first = true;
    let total = 0;
    let settled = false;

    const startJson = () => {
      if (started) return;
      started = true;
      res.write(
        `{"sedeId":${sedeId},"fechaInicio":${JSON.stringify(fechaInicio)},` +
        `"fechaFin":${JSON.stringify(fechaFin)},"data":[`
      );
    };

    const finishJson = (ok, errorMessage = null) => {
      if (settled) return;
      settled = true;
      startJson();
      res.write(`],"ok":${ok ? "true" : "false"},"total":${total}`);
      if (errorMessage) {
        res.write(`,"error":${JSON.stringify(errorMessage)}`);
      }
      res.end("}");
    };

    req.on("close", () => {
      if (!settled) {
        request.cancel();
      }
    });

    await new Promise((resolve) => {
      request.on("row", (row) => {
        startJson();
        if (!first) {
          res.write(",");
        }
        first = false;
        total += 1;
        res.write(JSON.stringify(row));
      });

      request.on("error", (err) => {
        console.error("Error stream igss calidad energia:", err.message);
        if (!res.headersSent) {
          settled = true;
          res.status(500).json({
            ok: false,
            error: "Error consultando calidad de energia",
            detail: err.message
          });
          return resolve();
        }
        finishJson(false, err.message);
        resolve();
      });

      request.on("done", () => {
        finishJson(true);
        resolve();
      });

      request.execute(MSSQL_IGSS_CALIDAD_PROC, (err) => {
        if (err) {
          console.error("Error endpoint igss calidad energia:", err.message);
          if (!res.headersSent) {
            settled = true;
            res.status(500).json({
              ok: false,
              error: "Error consultando calidad de energia",
              detail: err.message
            });
            return resolve();
          }
          finishJson(false, err.message);
          resolve();
        }
      });
    });
  } catch (err) {
    console.error("Error endpoint igss calidad energia:", err.message);
    res.status(500).json({
      ok: false,
      error: "Error consultando calidad de energia",
      detail: err.message
    });
  }
}

async function handleIgssCalidadEnergiaHistoricoJson(req, res) {
  try {
    res.setTimeout(MSSQL_IGSS_REQUEST_TIMEOUT_MS);

    const { fechaInicio, fechaFin, sedeId } = getIgssHistoricoJsonParams(req);

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar fecha_inicio y fecha_fin en formato YYYY-MM-DD"
      });
    }

    if (fechaInicio > fechaFin) {
      return res.status(400).json({
        ok: false,
        error: "fecha_inicio no puede ser mayor que fecha_fin"
      });
    }

    if (!sedeId) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar sede_id como numero entero positivo"
      });
    }

    const pool = await getMssqlPool();
    const request = pool.request();
    request.timeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS;

    const result = await request
      .input("fecha_inicio", mssql.Date, fechaInicio)
      .input("fecha_fin", mssql.Date, fechaFin)
      .input("sede_id", mssql.Int, sedeId)
      .execute(MSSQL_IGSS_HISTORICO_JSON_PROC);

    const rows = result.recordset || [];
    res.json(buildIgssHistoricoJson(rows, fechaInicio, fechaFin, sedeId));
  } catch (err) {
    console.error("Error endpoint igss historico json:", err.message);
    res.status(500).json({
      ok: false,
      error: "Error consultando historico de calidad de energia",
      detail: err.message
    });
  }
}

async function handleIgssSedes(req, res) {
  try {
    res.setTimeout(MSSQL_IGSS_REQUEST_TIMEOUT_MS);

    const pool = await getMssqlPool();
    const request = pool.request();
    request.timeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS;

    const result = await request.execute(MSSQL_IGSS_SEDES_PROC);
    const data = result.recordset || [];

    res.json({
      ok: true,
      total: data.length,
      data
    });
  } catch (err) {
    console.error("Error endpoint igss sedes:", err.message);
    res.status(500).json({
      ok: false,
      error: "Error consultando catalogo de sedes",
      detail: err.message
    });
  }
}

function apiKeyAuth(req, res, next) {
  const sendJsonMessage = (statusCode, message) =>
    res.status(statusCode).json({ message });

  if (!MODBUS_AUTO_API_KEY) {
    return sendJsonMessage(500, "Error interno del servidor");
  }
  const provided =
    req.headers["x-api-key"] ||
    req.headers["X-API-KEY"] ||
    req.query.api_key;
  if (!provided) {
    return sendJsonMessage(401, "API key requerida");
  }

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(MODBUS_AUTO_API_KEY));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return sendJsonMessage(403, "API key invalida");
  }

  next();
}

// ======================================================
//  POSTGRESQL PRODUCCION POOL (ANTI-FUGAS)
// ======================================================
/*
const pool = new Pool({
    user: "chirpstack",
    host: "10.60.10.239",
    database: "chirpstack",
    password: "chirpstack",
    port: 5432,

    max: 3,                     //  BAJO Y CONTROLADO
    idleTimeoutMillis: 10000,   // CIERRA IDLE RÃPIDO
    connectionTimeoutMillis: 3000,
    allowExitOnIdle: true
});
*/

// ======================================================
//  POSTGRESQL LOCAL PRUEBAS
// ======================================================
/*

const pool = new Pool({
    user: "admin",
    host: "localhost",
    database: "mi_basedatos",
    password: "admin123",
    port: 5432,

    max: 3,                     // BAJO Y CONTROLADO
    idleTimeoutMillis: 10000,   // CIERRA IDLE RÃPIDO
    connectionTimeoutMillis: 3000,
    allowExitOnIdle: true
});
*/
pool.on("connect", () => {
    console.log("?? PostgreSQL conectado");

});

pool.on("error", (err) => {
    console.error("Error en pool PostgreSQL:", err);
});

// ======================================================
//  MQTT CONFIG + CLIENTES (DASHBOARD / INVENTARIO)
// ======================================================
const MQTT_TOPIC = "application/+/device/+/event/up";
const DEFAULT_MQTT_PORT = 1883;
const DEFAULT_MQTT_DASHBOARD_HOST = "192.168.70.6";
const DEFAULT_MQTT_XELA_DASHBOARD_HOST = "10.30.10.23";
const DEFAULT_MQTT_INVENTORY_HOST = "10.0.6.35";
const MQTT_ENABLED = String(process.env.MQTT_ENABLED ?? "true").toLowerCase() !== "false";

let mqttConfig = {
  dashboard: { host: DEFAULT_MQTT_DASHBOARD_HOST, port: DEFAULT_MQTT_PORT },
  xelaDashboard: { host: DEFAULT_MQTT_XELA_DASHBOARD_HOST, port: DEFAULT_MQTT_PORT },
  inventory: { host: DEFAULT_MQTT_INVENTORY_HOST, port: DEFAULT_MQTT_PORT }
};
const mqttClients = { dashboard: null, xelaDashboard: null, inventory: null };
const mqttStatus = {
  dashboard: { connected: false, lastMessageAt: null },
  xelaDashboard: { connected: false, lastMessageAt: null },
  inventory: { connected: false, lastMessageAt: null }
};

function normalizeHost(host) {
  return String(host || "").trim();
}

function isValidHost(host) {
  const clean = normalizeHost(host);
  if (!clean) return false;
  return /^[a-zA-Z0-9.\-]+$/.test(clean);
}

function parsePort(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const port = Math.trunc(num);
  if (port < 1 || port > 65535) return null;
  return port;
}

function formatDbError(err) {
  return err?.message || err?.code || err?.cause?.message || String(err);
}

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS public.app_settings
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);
  await pool.query(
    `INSERT INTO public.app_settings (key, value, updated_at)
     VALUES ('mqtt_port', $1, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [String(DEFAULT_MQTT_PORT)]
  );
  await syncMqttDashboardSettings({
    dashboardHost: await getSetting("dashboard_tec3_ip", await getSetting("mqtt_dashboard_host", DEFAULT_MQTT_DASHBOARD_HOST)),
    xelaDashboardHost: await getSetting("dashboard_xela_ip", await getSetting("mqtt_xela_dashboard_host", DEFAULT_MQTT_XELA_DASHBOARD_HOST)),
    inventoryHost: await getSetting("mqtt_inventory_host", DEFAULT_MQTT_INVENTORY_HOST),
    port: await getSetting("mqtt_port", String(DEFAULT_MQTT_PORT))
  });
  await pool.query(
    `UPDATE public.app_settings
     SET value = $1, updated_at = NOW()
     WHERE key IN ('dashboard_xela_ip', 'mqtt_xela_dashboard_host')
       AND value IN ('10.0.5.35', '10.0.9.35', '')`,
    [DEFAULT_MQTT_XELA_DASHBOARD_HOST]
  );
}

async function ensureSensoresSourceColumn() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS public.sensores_mqtt
        ADD COLUMN IF NOT EXISTS source TEXT
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS public.sensores_mqtt
        ADD COLUMN IF NOT EXISTS mqtt_host TEXT
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS public.sensores_mqtt
        ADD COLUMN IF NOT EXISTS mqtt_port INTEGER
    `);
    await pool.query(`
      UPDATE public.sensores_mqtt
      SET source = 'dashboard'
      WHERE source IS NULL
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensores_mqtt_source
        ON public.sensores_mqtt(source)
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensores_mqtt_source_timestamp_desc
        ON public.sensores_mqtt(source, timestamp DESC)
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensores_mqtt_timestamp_desc
        ON public.sensores_mqtt(timestamp DESC)
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensores_mqtt_source_device_timestamp_desc
        ON public.sensores_mqtt(source, device_id, timestamp DESC)
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensores_mqtt_source_host_device_timestamp_desc
        ON public.sensores_mqtt(source, mqtt_host, device_id, timestamp DESC)
    `);
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_inventory_created_at_desc
        ON public.device_inventory(created_at DESC)
    `);
  } catch (err) {
    console.error("Error asegurando columna source:", err.message);
  }
}

async function getSetting(key, fallback) {
  try {
    const res = await pool.query(
      "SELECT value FROM public.app_settings WHERE key = $1",
      [key]
    );
    if (res.rowCount > 0) return res.rows[0].value;
  } catch (err) {
    console.error("Error leyendo app_settings:", formatDbError(err));
  }
  return fallback;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO public.app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

async function syncMqttDashboardSettings({ dashboardHost, xelaDashboardHost, inventoryHost, port }) {
  const safeDashboardHost = normalizeHost(dashboardHost || DEFAULT_MQTT_DASHBOARD_HOST);
  const safeXelaDashboardHost = normalizeHost(xelaDashboardHost || DEFAULT_MQTT_XELA_DASHBOARD_HOST);
  const safeInventoryHost = normalizeHost(inventoryHost || DEFAULT_MQTT_INVENTORY_HOST);
  const safePort = String(parsePort(port) || DEFAULT_MQTT_PORT);

  await pool.query(
    `INSERT INTO public.app_settings (key, value, updated_at)
     VALUES
       ('dashboard_tec3_ip', $1, NOW()),
       ('dashboard_xela_ip', $2, NOW()),
       ('mqtt_dashboard_host', $1, NOW()),
       ('mqtt_xela_dashboard_host', $2, NOW()),
       ('mqtt_inventory_host', $3, NOW()),
       ('mqtt_port', $4, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [safeDashboardHost, safeXelaDashboardHost, safeInventoryHost, safePort]
  );

  return {
    dashboardHost: safeDashboardHost,
    xelaDashboardHost: safeXelaDashboardHost,
    inventoryHost: safeInventoryHost,
    port: parsePort(safePort) || DEFAULT_MQTT_PORT
  };
}

async function loadMqttConfigFromDb() {
  await ensureSettingsTable();
  await ensureSensoresSourceColumn();
  const legacyDashboardHost = await getSetting(
    "mqtt_dashboard_host",
    DEFAULT_MQTT_DASHBOARD_HOST
  );
  const legacyXelaDashboardHost = await getSetting(
    "mqtt_xela_dashboard_host",
    DEFAULT_MQTT_XELA_DASHBOARD_HOST
  );
  const dashboardHost = await getSetting(
    "dashboard_tec3_ip",
    legacyDashboardHost
  );
  const xelaDashboardHost = await getSetting(
    "dashboard_xela_ip",
    legacyXelaDashboardHost
  );
  const inventoryHost = await getSetting(
    "mqtt_inventory_host",
    DEFAULT_MQTT_INVENTORY_HOST
  );
  const portValue = await getSetting("mqtt_port", String(DEFAULT_MQTT_PORT));
  const port = parsePort(portValue) || DEFAULT_MQTT_PORT;
  return {
    dashboard: { host: normalizeHost(dashboardHost), port },
    xelaDashboard: { host: normalizeHost(xelaDashboardHost), port },
    inventory: { host: normalizeHost(inventoryHost), port }
  };
}

function connectMqttClient(source, cfg) {
  if (!cfg || !cfg.host) return;
  const url = `mqtt://${cfg.host}:${cfg.port}`;
  if (mqttClients[source]) {
    mqttClients[source].end(true);
  }
  const client = mqtt.connect(url, {
    reconnectPeriod: 5000,
    queueQoSZero: false
  });
  mqttClients[source] = client;

  client.on("connect", () => {
    console.log(`?? MQTT ${source} conectado -> ${url}`);
    mqttStatus[source].connected = true;
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.error(`Error suscripci�n MQTT ${source}:`, err);
      else console.log(`? Suscrito (${source}) a ${MQTT_TOPIC}`);
    });
  });
  client.on("reconnect", () => {
    mqttStatus[source].connected = false;
  });
  client.on("close", () => {
    mqttStatus[source].connected = false;
  });
  client.on("offline", () => {
    mqttStatus[source].connected = false;
  });

  client.on("error", (err) => {
    console.error(`Error MQTT ${source}:`, err.message);
  });

  client.on("message", (topic, message) => {
    mqttStatus[source].lastMessageAt = Date.now();
    mqttQueue.push({
      source,
      message,
      mqttHost: normalizeHost(cfg.host),
      mqttPort: parsePort(cfg.port) || DEFAULT_MQTT_PORT
    });
    processQueue();
  });
}

function sameMqttEndpoint(a, b) {
  return normalizeHost(a?.host) === normalizeHost(b?.host) &&
    (parsePort(a?.port) || DEFAULT_MQTT_PORT) === (parsePort(b?.port) || DEFAULT_MQTT_PORT);
}

function reuseMqttClient(source, targetSource) {
  if (mqttClients[source] && mqttClients[source] !== mqttClients[targetSource]) {
    mqttClients[source].end(true);
  }
  mqttClients[source] = mqttClients[targetSource] || null;
  mqttStatus[source] = mqttStatus[targetSource] || { connected: false, lastMessageAt: null };
}

function applyMqttConfig(config) {
  mqttConfig = config;
  if (!MQTT_ENABLED) return;
  connectMqttClient("dashboard", mqttConfig.dashboard);
  connectMqttClient("inventory", mqttConfig.inventory);
  if (sameMqttEndpoint(mqttConfig.xelaDashboard, mqttConfig.dashboard)) {
    reuseMqttClient("xelaDashboard", "dashboard");
  } else if (sameMqttEndpoint(mqttConfig.xelaDashboard, mqttConfig.inventory)) {
    reuseMqttClient("xelaDashboard", "inventory");
  } else {
    connectMqttClient("xelaDashboard", mqttConfig.xelaDashboard);
  }
}

async function initMqtt() {
  if (!MQTT_ENABLED) {
    console.log("MQTT deshabilitado por configuracion");
    return;
  }
  try {
    const cfg = await loadMqttConfigFromDb();
    applyMqttConfig(cfg);
  } catch (err) {
    console.error("Error inicializando MQTT config:", formatDbError(err));
    applyMqttConfig(mqttConfig);
  }
}

// ======================================================
//  UTILIDADES
// ======================================================
function detectDeviceId(json) {
    return (
        json?.deviceInfo?.devEui ||
        json?.end_device_ids?.dev_eui ||
        json?.devEui ||
        json?.dev_eui ||
        json?.deviceId ||
        json?.device_id ||
        json?.devAddr ||
        "unknown"
    );
}

// ======================================================
//  COLA MQTT (ANTI-SATURACIÃ“N)
// ======================================================

const mqttQueue = [];
let isProcessing = false;

async function processQueue() {
    if (!MQTT_ENABLED) {
        mqttQueue.length = 0;
        return;
    }
    if (isProcessing || mqttQueue.length === 0) return;

    isProcessing = true;
    const item = mqttQueue.shift();
    if (!item || !item.message) {
        isProcessing = false;
        setImmediate(processQueue);
        return;
    }

    try {
        const source = item?.source || "dashboard";
        const mqttHost = normalizeHost(item?.mqttHost || mqttConfig[source]?.host || "");
        const mqttPort = parsePort(item?.mqttPort) || mqttConfig[source]?.port || DEFAULT_MQTT_PORT;
        const message = item?.message;
        const raw = JSON.parse(message.toString());
        const deviceId = detectDeviceId(raw);
        const object = raw?.object || {};
        const deviceName = raw?.deviceInfo?.deviceName || null;
        console.log(`?? [${source}] Device:`, deviceId, "?", deviceName);




        await pool.query(
            `INSERT INTO public.sensores_mqtt
             (device_id, value_numeric, value_text, raw_payload, device_name, source, mqtt_host, mqtt_port)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                deviceId,
                object?.temperature ?? null,
                JSON.stringify(object),
                JSON.stringify(raw),
                deviceName,
                source,
                mqttHost,
                mqttPort
            ]
        );

        console.log(`MQTT guardado (${deviceId}) [${source} ${mqttHost}:${mqttPort}]`);

    } catch (err) {
        console.error("Error MQTT BD:", formatDbError(err));
    } finally {
        isProcessing = false;
        setImmediate(processQueue); // sigue con el siguiente
    }
}

initMqtt();
// ======================================================
//  LOGIN JWT
// ======================================================

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("USERNAME:", JSON.stringify(username));
  console.log("PASSWORD:", JSON.stringify(password));
  console.log("PASSWORD LENGTH:", password?.length);

  try {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const result = await pool.query(
      "SELECT * FROM public.api_users_mqtt WHERE username = $1",
      [cleanUsername]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Credenciales invÃ¡lidas" });
    }

    const user = result.rows[0];

    console.log("HASH BD:", user.password);
    console.log("USER TYPE:", user.user_type);

    /* ================= VALIDAR TIPO DE USUARIO ================= */

    // Este login SOLO permite usuarios de aplicaci�n activos
    if (String(user.user_type || "").toLowerCase() !== "app") {
      return res.status(403).json({
        message: "Este usuario no esta autorizado para acceder a la aplicaci�n"
      });
    }

    /* ================= VALIDAR PASSWORD ================= */

    const valid = bcrypt.compareSync(cleanPassword, user.password);
    console.log("RESULTADO BCRYPT:", valid);

    if (!valid) {
      return res.status(401).json({ message: "Credenciales inv�lidas" });
    }

    /* ================= GENERAR JWT ================= */

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.user_type,     // ðŸ‘ˆ CLAVE
        tokenVersion: user.token_version
      },
      process.env.JWT_SECRET,
      getJwtSignOptions()
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.user_type
      }
    });

  } catch (err) {
    console.error("ERROR LOGIN:", err);
    res.status(500).json({ message: "Error en login" });
  }
});

// ======================================================
//  LOGOUT JWT (INVALIDAR TOKEN)
// ======================================================
app.post("/api/logout", verifyJWT, async (req, res) => {
    try {
        await pool.query(
            "UPDATE public.api_users_mqtt SET token_version = token_version + 1 WHERE id = $1",
            [req.user.id]
        );

        res.json({ message: "Sesi�n cerrada correctamente" });

    } catch (err) {
        console.error("ERROR LOGOUT:", err);
        res.status(500).json({ message: "Error al cerrar sesi�n" });
    }
});

// ======================================================
//  CAMBIO DE CONTRASE�A (USUARIO LOGUEADO)
// ======================================================
app.post("/api/users/me/password", verifyJWT, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Contrase�a actual y nueva son requeridas" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "La nueva contrase�a debe tener al menos 6 caracteres" });
  }

  try {
    const result = await pool.query(
      "SELECT id, password, user_type FROM public.api_users_mqtt WHERE id = $1",
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const user = result.rows[0];
    if (String(user.user_type || "").toLowerCase() !== "app") {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const valid = bcrypt.compareSync(String(currentPassword), user.password);
    if (!valid) {
      return res.status(401).json({ message: "Contrase�a actual incorrecta" });
    }

    const newHash = bcrypt.hashSync(String(newPassword), 10);
    await pool.query(
      "UPDATE public.api_users_mqtt SET password = $1, token_version = token_version + 1 WHERE id = $2",
      [newHash, user.id]
    );

    res.json({ message: "Contrase�a actualizada. Inicia sesi�n nuevamente." });
  } catch (err) {
    console.error("Error cambiando contrase�a:", err);
    res.status(500).json({ message: "Error cambiando contrase�a" });
  }
});

// ======================================================
//  MANTENIMIENTO DE USUARIOS
// ======================================================
app.get("/api/users", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, user_type, created_at, token_version
       FROM public.api_users_mqtt
       ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error listando usuarios:", err);
    res.status(500).json({ message: "Error listando usuarios" });
  }
});

app.post("/api/users", verifyJWT, requireRole("admin"), async (req, res) => {
  const usernameRaw = req.body?.username || "";
  const passwordRaw = req.body?.password || "";
  const role = (req.body?.role || "viewer").trim() || "viewer";
  const userType = (req.body?.userType || "app").trim() || "app";

  const username = String(usernameRaw).trim().toLowerCase();
  const password = String(passwordRaw).trim();

  if (!username || !password) {
    return res.status(400).json({ message: "Username y password son requeridos" });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO public.api_users_mqtt
       (username, password, role, user_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, user_type, created_at, token_version`,
      [username, hash, role, userType]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Usuario ya existe" });
    }
    console.error("Error creando usuario:", err);
    res.status(500).json({ message: "Error creando usuario" });
  }
});

app.put("/api/users/:id", verifyJWT, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  try {
    const currentRes = await pool.query(
      "SELECT * FROM public.api_users_mqtt WHERE id = $1",
      [id]
    );
    if (currentRes.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const current = currentRes.rows[0];
    const username = String(req.body?.username ?? current.username).trim().toLowerCase();
    const role = String(req.body?.role ?? current.role).trim() || current.role;
    const userType = String(req.body?.userType ?? current.user_type).trim() || current.user_type;
    const passwordInput = String(req.body?.password || "").trim();
    let passwordHash = current.password;
    let passwordChanged = false;
    if (passwordInput) {
      passwordHash = bcrypt.hashSync(passwordInput, 10);
      passwordChanged = true;
    }
    const userTypeChanged =
      String(userType).toLowerCase() !== String(current.user_type || "").toLowerCase();
    const bumpToken = passwordChanged || userTypeChanged ? 1 : 0;

    const result = await pool.query(
      `UPDATE public.api_users_mqtt
       SET username = $1,
           password = $2,
           role = $3,
           user_type = $4,
           token_version = token_version + $5
       WHERE id = $6
       RETURNING id, username, role, user_type, created_at, token_version`,
      [username, passwordHash, role, userType, bumpToken, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Usuario ya existe" });
    }
    console.error("Error actualizando usuario:", err);
    res.status(500).json({ message: "Error actualizando usuario" });
  }
});

app.delete("/api/users/:id", verifyJWT, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE public.api_users_mqtt
       SET user_type = 'disabled',
           token_version = token_version + 1
       WHERE id = $1
       RETURNING id, username, role, user_type, created_at, token_version`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error desactivando usuario:", err);
    res.status(500).json({ message: "Error desactivando usuario" });
  }
});

// ======================================================
//  CONFIGURACION MQTT (DASHBOARD / INVENTARIO)
// ======================================================
app.get("/api/config/mqtt", verifyJWT, requireAnyRole(["admin", "operador"]), async (req, res) => {
  try {
    const cfg = await loadMqttConfigFromDb();
    res.json({
      ...cfg,
      status: {
        dashboard: {
          connected: Boolean(mqttClients.dashboard?.connected),
          lastMessageAt: mqttStatus.dashboard.lastMessageAt
        },
        xelaDashboard: {
          connected: Boolean(mqttClients.xelaDashboard?.connected),
          lastMessageAt: mqttStatus.xelaDashboard.lastMessageAt
        },
        inventory: {
          connected: Boolean(mqttClients.inventory?.connected),
          lastMessageAt: mqttStatus.inventory.lastMessageAt
        }
      }
    });
  } catch (err) {
    console.error("Error cargando config MQTT:", err);
    res.status(500).json({
      message: "Error cargando configuracion MQTT",
      detail: err.message
    });
  }
});

app.put("/api/config/mqtt", verifyJWT, requireAnyRole(["admin", "operador"]), async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    if (!isAdmin && (req.body?.dashboardHost || req.body?.xelaDashboardHost || req.body?.port)) {
      return res.status(403).json({
        message: "Solo admin puede modificar las IPs de Xela, TEC_3 o el puerto"
      });
    }
    const dashboardHost = normalizeHost(
      isAdmin ? (req.body?.dashboardHost || mqttConfig.dashboard.host) : mqttConfig.dashboard.host
    );
    const xelaDashboardHost = normalizeHost(
      isAdmin ? (req.body?.xelaDashboardHost || mqttConfig.xelaDashboard.host) : mqttConfig.xelaDashboard.host
    );
    const inventoryHost = normalizeHost(
      req.body?.inventoryHost || mqttConfig.inventory.host
    );
    const nextPort = isAdmin
      ? (parsePort(req.body?.port) ?? mqttConfig.dashboard.port ?? DEFAULT_MQTT_PORT)
      : (mqttConfig.dashboard.port ?? DEFAULT_MQTT_PORT);

    if (!isValidHost(dashboardHost)) {
      return res.status(400).json({ message: "Host MQTT Dashboard TEC_3 invalido" });
    }
    if (!isValidHost(xelaDashboardHost)) {
      return res.status(400).json({ message: "Host MQTT Dashboard Xela invalido" });
    }
    if (!isValidHost(inventoryHost)) {
      return res.status(400).json({ message: "Host MQTT Inventario invalido" });
    }

    await ensureSettingsTable();
    const synced = await syncMqttDashboardSettings({
      dashboardHost,
      xelaDashboardHost,
      inventoryHost,
      port: nextPort
    });

    const cfg = {
      dashboard: { host: synced.dashboardHost, port: synced.port },
      xelaDashboard: { host: synced.xelaDashboardHost, port: synced.port },
      inventory: { host: synced.inventoryHost, port: synced.port }
    };
    applyMqttConfig(cfg);
    res.json({
      ...cfg,
      status: {
        dashboard: {
          connected: Boolean(mqttClients.dashboard?.connected),
          lastMessageAt: mqttStatus.dashboard.lastMessageAt
        },
        xelaDashboard: {
          connected: Boolean(mqttClients.xelaDashboard?.connected),
          lastMessageAt: mqttStatus.xelaDashboard.lastMessageAt
        },
        inventory: {
          connected: Boolean(mqttClients.inventory?.connected),
          lastMessageAt: mqttStatus.inventory.lastMessageAt
        }
      }
    });
  } catch (err) {
    console.error("Error guardando config MQTT:", err);
    res.status(500).json({
      message: "Error guardando configuracion MQTT",
      detail: err.message
    });
  }
});


// ======================================================
//  API PROTEGIDA
// ======================================================

function mapSensorRow(r) {
  let raw = r.raw_payload;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      raw = {};
    }
  }

  return {
    deviceId: r.device_id,
    deviceName: r.device_name,
    timestamp: r.timestamp,
    source: r.source || "dashboard",
    mqttHost: r.mqtt_host || null,
    raw,
    object: (() => {
      const obj = raw?.object || {};
      const deviceId = String(r.device_id || "").toLowerCase();

      const xRaw =
        obj?.aio_value ??
        obj?.ai0_value ??
        obj?.ai0 ??
        obj?.aio ??
        obj?.ai0Value ??
        obj?.aioValue;
      const x = Number(xRaw);
      const ai1Raw = obj?.ai1_value ?? obj?.ai1 ?? obj?.ai1Value;
      const ai1 = Number(ai1Raw);

      let mapped = obj;

      if (deviceId === TARGET_DEV_EUI && Number.isFinite(x)) {
        const y = (AIO_PRESION.slope * x) + AIO_PRESION.intercept;
        if (Number.isFinite(y)) {
          mapped = { ...mapped, presion_psi: y };
        }
      }

      if (deviceId === TARGET_DEV_EUI_TEMP && Number.isFinite(x)) {
        const t = (AIO_TEMPERATURA.slope * x) + AIO_TEMPERATURA.intercept;
        if (Number.isFinite(t)) {
          mapped = { ...mapped, temperatura_calc: t };
        }
      }

      if (deviceId === TARGET_DEV_EUI_TEMP && Number.isFinite(ai1)) {
        const t = (AIO_TEMPERATURA.slope * ai1) + AIO_TEMPERATURA.intercept;
        if (Number.isFinite(t)) {
          mapped = { ...mapped, temperatura_ai1_calc: t };
        }
      }

      return mapped;
    })()
  };
}

function getDashboardMqttHost() {
  return normalizeHost(mqttConfig?.dashboard?.host || DEFAULT_MQTT_DASHBOARD_HOST);
}

function getRequestedDashboardMqttHost(req) {
  const requestedHost = normalizeHost(req?.query?.host);
  return isValidHost(requestedHost) ? requestedHost : getDashboardMqttHost();
}

function parseSensorHistoryDate(value, endOfDay = false) {
  const text = String(value || "").trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    const date = new Date(`${text}${suffix}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

app.get(
  "/api/sensores",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const dashboardHost = getRequestedDashboardMqttHost(req);
    try {
      const result = await pool.query(`
        SELECT
            device_id,
            device_name,
            raw_payload,
            timestamp,
            source,
            mqtt_host
        FROM public.sensores_mqtt
        WHERE source IN ('dashboard', 'xelaDashboard', 'inventory')
          AND mqtt_host = $1
        ORDER BY timestamp DESC
        LIMIT 350
        `, [dashboardHost]);

    const data = result.rows.map(mapSensorRow);

      res.json(data);

    } catch (err) {
      console.error("Error API:", err);
      res.status(500).json({ message: "Error consultando sensores" });
    }
  }
);

app.get(
  "/api/sensores/devices",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const dashboardHost = getRequestedDashboardMqttHost(req);
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON (device_id)
            device_id,
            device_name,
            raw_payload,
            timestamp,
            source,
            mqtt_host
        FROM public.sensores_mqtt
        WHERE device_id IS NOT NULL
          AND device_id <> ''
          AND source IN ('dashboard', 'xelaDashboard', 'inventory')
          AND mqtt_host = $1
        ORDER BY device_id, timestamp DESC
      `, [dashboardHost]);

      res.json(result.rows.map(r => ({
        id: r.device_id,
        name: r.device_name || "Sin nombre",
        deviceId: r.device_id,
        deviceName: r.device_name || "Sin nombre",
        timestamp: r.timestamp,
        source: r.source || "dashboard",
        mqttHost: r.mqtt_host || null,
        raw: r.raw_payload
      })));
    } catch (err) {
      console.error("Error API dispositivos MQTT:", err);
      res.status(500).json({ message: "Error consultando dispositivos MQTT" });
    }
  }
);

app.get(
  "/api/sensores/device/:deviceId",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const deviceId = String(req.params.deviceId || "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit) || 500, 1), 50000);
    const dashboardHost = getRequestedDashboardMqttHost(req);
    const start = parseSensorHistoryDate(req.query?.start || req.query?.fechaInicio);
    const end = parseSensorHistoryDate(req.query?.end || req.query?.fechaFin, true);

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId es requerido" });
    }
    if ((req.query?.start || req.query?.fechaInicio || req.query?.end || req.query?.fechaFin) && (!start || !end)) {
      return res.status(400).json({ message: "start y end deben tener formato de fecha valido" });
    }
    if (start && end && start > end) {
      return res.status(400).json({ message: "start no puede ser mayor que end" });
    }

    try {
      const params = [dashboardHost, deviceId];
      const where = [
        "source IN ('dashboard', 'xelaDashboard', 'inventory')",
        "mqtt_host = $1",
        "device_id = $2"
      ];
      if (start && end) {
        params.push(start, end);
        where.push(`timestamp BETWEEN $${params.length - 1} AND $${params.length}`);
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT device_id, device_name, raw_payload, timestamp, source, mqtt_host
         FROM public.sensores_mqtt
         WHERE ${where.join(" AND ")}
         ORDER BY timestamp DESC
         LIMIT $${params.length}`,
        params
      );

      res.json(result.rows.map(mapSensorRow));
    } catch (err) {
      console.error("Error API lecturas MQTT por dispositivo:", err);
      res.status(500).json({ message: "Error consultando lecturas del dispositivo" });
    }
  }
);

app.get(
  "/api/sensores/history",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const start = parseSensorHistoryDate(req.query?.start || req.query?.fechaInicio);
    const end = parseSensorHistoryDate(req.query?.end || req.query?.fechaFin, true);
    const deviceId = String(req.query?.deviceId || "").trim();
    const deviceIds = String(req.query?.deviceIds || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);
    if (deviceId && !deviceIds.includes(deviceId)) {
      deviceIds.push(deviceId);
    }
    const limitRaw = String(req.query?.limit || "10000").trim().toLowerCase();
    const limit = limitRaw === "all"
      ? 50000
      : Math.min(Math.max(Number(limitRaw) || 10000, 1), 50000);
    const dashboardHost = getRequestedDashboardMqttHost(req);

    if (!start || !end) {
      return res.status(400).json({ message: "start y end son requeridos en formato fecha valido" });
    }
    if (start > end) {
      return res.status(400).json({ message: "start no puede ser mayor que end" });
    }

    const params = [start, end];
    const where = ["timestamp BETWEEN $1 AND $2", "source IN ('dashboard', 'xelaDashboard', 'inventory')"];

    if (deviceIds.length) {
      params.push(deviceIds);
      where.push(`device_id = ANY($${params.length})`);
    } else {
      params.push(dashboardHost);
      where.push(`(
        mqtt_host = $3
        OR (
          (mqtt_host IS NULL OR mqtt_host = '')
          AND device_id IN (
            SELECT DISTINCT device_id
            FROM public.sensores_mqtt
            WHERE source IN ('dashboard', 'xelaDashboard', 'inventory')
              AND mqtt_host = $3
              AND device_id IS NOT NULL
              AND device_id <> ''
          )
        )
      )`);
    }

    params.push(limit);

    try {
      const result = await pool.query(
        `SELECT device_id, device_name, raw_payload, timestamp, source, mqtt_host,
                COUNT(*) OVER() AS total_count
         FROM public.sensores_mqtt
         WHERE ${where.join(" AND ")}
         ORDER BY timestamp DESC
         LIMIT $${params.length}`,
        params
      );

      res.json({
        filters: {
          start: start.toISOString(),
          end: end.toISOString(),
          deviceId: deviceIds.length === 1 ? deviceIds[0] : null,
          deviceIds,
          source: "dashboard",
          mqttHost: dashboardHost,
          limit,
          includesLegacyRowsWithoutMqttHost: true
        },
        count: Number(result.rows[0]?.total_count || result.rowCount),
        returned: result.rowCount,
        rows: result.rows.map(mapSensorRow)
      });
    } catch (err) {
      console.error("Error API historico sensores MQTT:", err);
      res.status(500).json({ message: "Error consultando historico de sensores MQTT" });
    }
  }
);

// ======================================================
//  HIST�RICO CO2 (RANGO LIBRE)
// ======================================================
app.get(
  "/api/sensores/co2-trend",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const deviceId = String(req.query?.deviceId || "").trim();
    const startRaw = req.query?.start;
    const endRaw = req.query?.end;

    if (!deviceId || !startRaw || !endRaw) {
      return res.status(400).json({ message: "deviceId, start y end son requeridos" });
    }

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "Fechas inv�lidas" });
    }
    if (start > end) {
      return res.status(400).json({ message: "start no puede ser mayor que end" });
    }

    const limit = Math.min(Number(req.query?.limit) || 10000, 30000);
    const dashboardHost = getRequestedDashboardMqttHost(req);

    try {
      const result = await pool.query(
        `SELECT device_id, device_name, raw_payload, timestamp, source, mqtt_host
         FROM public.sensores_mqtt
         WHERE device_id = $1
           AND timestamp BETWEEN $2 AND $3
           AND source IN ('dashboard', 'xelaDashboard', 'inventory')
           AND mqtt_host = $4
         ORDER BY timestamp ASC
         LIMIT $5`,
        [deviceId, start, end, dashboardHost, limit]
      );

      const rows = result.rows.map(r => {
        let payload = r.raw_payload;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch (err) {
            payload = {};
          }
        }
        const obj = payload?.object || payload || {};
        const value = Number(obj?.co2);
        return {
          deviceId: r.device_id,
          deviceName: r.device_name,
          timestamp: r.timestamp,
          value
        };
      }).filter(r => Number.isFinite(r.value));

      res.json(rows);
    } catch (err) {
      console.error("Error cargando hist�rico CO2:", err);
      res.status(500).json({ message: "Error cargando hist�rico CO2" });
    }
  }
);

// ======================================================
//  INVENTARIO DE DISPOSITIVOS
// ======================================================

app.get(
  "/api/inventario/catalogs",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const [
        types,
        locations,
        manufacturers,
        models,
        sedes,
        contactos,
        infra,
        catalogoEquipos,
        protocolos,
        aplicaciones,
        estadoDisp,
        ubiExacta
      ] = await Promise.all([
        pool.query(
          "SELECT id, name, description FROM public.device_types ORDER BY name"
        ),
        pool.query(
          "SELECT id, name, description FROM public.locations ORDER BY name"
        ),
        pool.query(
          "SELECT id, name, description FROM public.manufacturers ORDER BY name"
        ),
        pool.query(
          `SELECT m.id, m.name, m.description, m.manufacturer_id,
                  f.name AS manufacturer_name
           FROM public.device_models m
           LEFT JOIN public.manufacturers f
           ON f.id = m.manufacturer_id
           ORDER BY m.name`
        ),
        pool.query(
          `SELECT id_sitio, sede_principal, prefijo_sitio, punto_monitoreo,
                  direccion, localizacion_gps
           FROM public.sedes
           ORDER BY id_sitio`
        ),
        pool.query(
          `SELECT id_contacto, nombre_encargado, cargo, telefono,
                  nombre_hospital, id_sitio
           FROM public.contactos
           ORDER BY id_contacto`
        ),
        pool.query(
          `SELECT id_infra, nombre_hospital, id_sitio, gabinete, rack, pdu, ups
           FROM public.infra_dc
           ORDER BY id_infra`
        ),
        pool.query(
          `SELECT marca_modelo, fabricante, voltaje_operacion,
                  tipo_sensor, vida_util, datasheet
           FROM public.catalogo_equipos
           ORDER BY marca_modelo`
        ),
        pool.query(
          `SELECT id, descripcion, valor
           FROM public.protocolos
           ORDER BY id`
        ),
        pool.query(
          `SELECT aplicacion_variable, sufijo_id, unidad,
                  rango_min, rango_max, tipo_sensor_sugerido
           FROM public.cat_aplicaciones
           ORDER BY aplicacion_variable`
        ),
        pool.query(
          `SELECT id, descripcion, valor, motivo_cambio
           FROM public.estado_disp
           ORDER BY id`
        ),
        pool.query(
          `SELECT id, descripcion, valor, tipo_entorno
           FROM public.bd_ubi_exac
           ORDER BY id`
        )
      ]);

      res.json({
        types: types.rows,
        locations: locations.rows,
        manufacturers: manufacturers.rows,
        models: models.rows,
        sedes: sedes.rows,
        contactos: contactos.rows,
        infra: infra.rows,
        catalogoEquipos: catalogoEquipos.rows,
        protocolos: protocolos.rows,
        aplicaciones: aplicaciones.rows,
        estadoDisp: estadoDisp.rows,
        ubiExacta: ubiExacta.rows
      });
    } catch (err) {
      console.error("Error cargando cat�logos:", err);
      res.status(500).json({ message: "Error cargando cat�logos" });
    }
  }
);

app.post(
  "/api/inventario/catalogs/:catalog",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { catalog } = req.params;
    const name = (req.body?.name || "").trim();
    const description = (req.body?.description || "").trim() || null;
    const manufacturerId = req.body?.manufacturerId || null;

    const requiresName = ["types", "locations", "manufacturers", "models"].includes(catalog);
    if (requiresName && !name) {
      return res.status(400).json({ message: "Nombre requerido" });
    }

    try {
      let result;

      switch (catalog) {
        case "types":
          result = await pool.query(
            `INSERT INTO public.device_types (name, description)
             VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
             RETURNING *`,
            [name, description]
          );
          break;
        case "locations":
          result = await pool.query(
            `INSERT INTO public.locations (name, description)
             VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
             RETURNING *`,
            [name, description]
          );
          break;
        case "manufacturers":
          result = await pool.query(
            `INSERT INTO public.manufacturers (name, description)
             VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
             RETURNING *`,
            [name, description]
          );
          break;
        case "models":
          result = await pool.query(
            `INSERT INTO public.device_models
             (name, description, manufacturer_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (manufacturer_id, name)
             DO UPDATE SET description = EXCLUDED.description
             RETURNING *`,
            [name, description, manufacturerId]
          );
          break;
        case "sedes": {
          const idSitio = (req.body?.idSitio || "").trim();
          if (!idSitio) {
            return res.status(400).json({ message: "id_sitio requerido" });
          }
          const sedePrincipal = (req.body?.sedePrincipal || "").trim() || null;
          const prefijoSitio = (req.body?.prefijoSitio || "").trim() || null;
          const puntoMonitoreo = (req.body?.puntoMonitoreo || "").trim() || null;
          const direccion = (req.body?.direccion || "").trim() || null;
          const localizacionGps = (req.body?.localizacionGps || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.sedes
             (id_sitio, sede_principal, prefijo_sitio, punto_monitoreo, direccion, localizacion_gps)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id_sitio) DO UPDATE
             SET sede_principal = EXCLUDED.sede_principal,
                 prefijo_sitio = EXCLUDED.prefijo_sitio,
                 punto_monitoreo = EXCLUDED.punto_monitoreo,
                 direccion = EXCLUDED.direccion,
                 localizacion_gps = EXCLUDED.localizacion_gps
             RETURNING *`,
            [idSitio, sedePrincipal, prefijoSitio, puntoMonitoreo, direccion, localizacionGps]
          );
          break;
        }
        case "contactos": {
          const idContacto = (req.body?.idContacto || "").trim();
          if (!idContacto) {
            return res.status(400).json({ message: "id_contacto requerido" });
          }
          const nombreEncargado = (req.body?.nombreEncargado || "").trim() || null;
          const cargo = (req.body?.cargo || "").trim() || null;
          const telefono = (req.body?.telefono || "").trim() || null;
          const nombreHospital = (req.body?.nombreHospital || "").trim() || null;
          const idSitio = (req.body?.idSitio || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.contactos
             (id_contacto, nombre_encargado, cargo, telefono, nombre_hospital, id_sitio)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id_contacto) DO UPDATE
             SET nombre_encargado = EXCLUDED.nombre_encargado,
                 cargo = EXCLUDED.cargo,
                 telefono = EXCLUDED.telefono,
                 nombre_hospital = EXCLUDED.nombre_hospital,
                 id_sitio = EXCLUDED.id_sitio
             RETURNING *`,
            [idContacto, nombreEncargado, cargo, telefono, nombreHospital, idSitio]
          );
          break;
        }
        case "infra": {
          const idInfra = (req.body?.idInfra || "").trim();
          if (!idInfra) {
            return res.status(400).json({ message: "id_infra requerido" });
          }
          const nombreHospital = (req.body?.nombreHospital || "").trim() || null;
          const idSitio = (req.body?.idSitio || "").trim() || null;
          const gabinete = (req.body?.gabinete || "").trim() || null;
          const rack = (req.body?.rack || "").trim() || null;
          const pdu = (req.body?.pdu || "").trim() || null;
          const ups = (req.body?.ups || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.infra_dc
             (id_infra, nombre_hospital, id_sitio, gabinete, rack, pdu, ups)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id_infra) DO UPDATE
             SET nombre_hospital = EXCLUDED.nombre_hospital,
                 id_sitio = EXCLUDED.id_sitio,
                 gabinete = EXCLUDED.gabinete,
                 rack = EXCLUDED.rack,
                 pdu = EXCLUDED.pdu,
                 ups = EXCLUDED.ups
             RETURNING *`,
            [idInfra, nombreHospital, idSitio, gabinete, rack, pdu, ups]
          );
          break;
        }
        case "catalogo_equipos": {
          const marcaModelo = (req.body?.marcaModelo || "").trim();
          if (!marcaModelo) {
            return res.status(400).json({ message: "marca_modelo requerido" });
          }
          const fabricante = (req.body?.fabricante || "").trim() || null;
          const voltajeRaw = req.body?.voltajeOperacion;
          const voltajeOperacion =
            voltajeRaw === "" || voltajeRaw == null ? null : Number(voltajeRaw);
          const tipoSensor = (req.body?.tipoSensor || "").trim() || null;
          const vidaUtil = (req.body?.vidaUtil || "").trim() || null;
          const datasheet = (req.body?.datasheet || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.catalogo_equipos
             (marca_modelo, fabricante, voltaje_operacion, tipo_sensor, vida_util, datasheet)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (marca_modelo) DO UPDATE
             SET fabricante = EXCLUDED.fabricante,
                 voltaje_operacion = EXCLUDED.voltaje_operacion,
                 tipo_sensor = EXCLUDED.tipo_sensor,
                 vida_util = EXCLUDED.vida_util,
                 datasheet = EXCLUDED.datasheet
             RETURNING *`,
            [marcaModelo, fabricante, voltajeOperacion, tipoSensor, vidaUtil, datasheet]
          );
          break;
        }
        case "protocolos": {
          const id = (req.body?.id || "").trim();
          if (!id) {
            return res.status(400).json({ message: "id requerido" });
          }
          const descripcion = (req.body?.descripcion || "").trim() || null;
          const valor = (req.body?.valor || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.protocolos (id, descripcion, valor)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE
             SET descripcion = EXCLUDED.descripcion,
                 valor = EXCLUDED.valor
             RETURNING *`,
            [id, descripcion, valor]
          );
          break;
        }
        case "cat_aplicaciones": {
          const aplicacionVariable = (req.body?.aplicacionVariable || "").trim();
          if (!aplicacionVariable) {
            return res.status(400).json({ message: "aplicacion_variable requerido" });
          }
          const sufijoId = (req.body?.sufijoId || "").trim() || null;
          const unidad = (req.body?.unidad || "").trim() || null;
          const rangoMinRaw = req.body?.rangoMin;
          const rangoMaxRaw = req.body?.rangoMax;
          const rangoMin = rangoMinRaw === "" || rangoMinRaw == null ? null : Number(rangoMinRaw);
          const rangoMax = rangoMaxRaw === "" || rangoMaxRaw == null ? null : Number(rangoMaxRaw);
          const tipoSensorSugerido = (req.body?.tipoSensorSugerido || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.cat_aplicaciones
             (aplicacion_variable, sufijo_id, unidad, rango_min, rango_max, tipo_sensor_sugerido)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [aplicacionVariable, sufijoId, unidad, rangoMin, rangoMax, tipoSensorSugerido]
          );
          break;
        }
        case "estado_disp": {
          const id = (req.body?.id || "").trim();
          if (!id) {
            return res.status(400).json({ message: "id requerido" });
          }
          const descripcion = (req.body?.descripcion || "").trim() || null;
          const valor = (req.body?.valor || "").trim() || null;
          const motivoCambio = (req.body?.motivoCambio || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.estado_disp (id, descripcion, valor, motivo_cambio)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE
             SET descripcion = EXCLUDED.descripcion,
                 valor = EXCLUDED.valor,
                 motivo_cambio = EXCLUDED.motivo_cambio
             RETURNING *`,
            [id, descripcion, valor, motivoCambio]
          );
          break;
        }
        case "bd_ubi_exac": {
          const id = (req.body?.id || "").trim();
          if (!id) {
            return res.status(400).json({ message: "id requerido" });
          }
          const descripcion = (req.body?.descripcion || "").trim() || null;
          const valor = (req.body?.valor || "").trim() || null;
          const tipoEntorno = (req.body?.tipoEntorno || "").trim() || null;
          result = await pool.query(
            `INSERT INTO public.bd_ubi_exac (id, descripcion, valor, tipo_entorno)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE
             SET descripcion = EXCLUDED.descripcion,
                 valor = EXCLUDED.valor,
                 tipo_entorno = EXCLUDED.tipo_entorno
             RETURNING *`,
            [id, descripcion, valor, tipoEntorno]
          );
          break;
        }
        default:
          return res.status(400).json({ message: "Catalogo invalido" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creando catalogo:", err);
      res.status(500).json({ message: "Error creando catalogo" });
    }
  }
);

app.get(
  "/api/inventario/devices",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT d.id, d.device_id, d.codigo, d.name, d.description,
                d.status, d.install_date, d.created_at,
                d.device_type_id, t.name AS device_type,
                d.location_id, l.name AS location,
                d.manufacturer_id, f.name AS manufacturer,
                d.model_id, m.name AS model,
                d.code_compuesto, d.numero_interno, d.brand_model, d.hospital,
                d.site_code, d.area_functional, d.area_code,
                d.infra_id, d.variable_measure, d.variable_suffix,
                d.value_min, d.value_max, d.unit, d.accessory,
                d.port_associated, d.protocol, d.location_exact,
                d.cabinet, d.cabinet_module, d.rack, d.pdu, d.ups,
                d.ip, d.ip_gateway, d.mascara,
                d.area_manager, d.area_role, d.area_phone, d.estado,
                d.change_reason, d.sede_id, d.contacto_id,
                d.protocolo_id, d.estado_id
         FROM public.device_inventory d
         LEFT JOIN public.device_types t
           ON t.id = d.device_type_id
         LEFT JOIN public.locations l
           ON l.id = d.location_id
         LEFT JOIN public.manufacturers f
           ON f.id = d.manufacturer_id
         LEFT JOIN public.device_models m
           ON m.id = d.model_id
         ORDER BY d.created_at DESC`
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando inventario:", err);
      res.status(500).json({ message: "Error cargando inventario" });
    }
  }
);

app.get(
  "/api/inventario/devices/next-code/:sedeId",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const sedeId = String(req.params.sedeId || "").trim();
    try {
      const result = await pool.query(
        `SELECT UPPER(BTRIM(s.prefijo_sitio)) ||
                LPAD((COALESCE(c.last_number, 0) + 1)::text, 3, '0') AS codigo
         FROM public.sedes s
         LEFT JOIN public.device_code_counters c ON c.sede_id = s.id_sitio
         WHERE s.id_sitio = $1 AND NULLIF(BTRIM(s.prefijo_sitio), '') IS NOT NULL`,
        [sedeId]
      );
      if (!result.rowCount) {
        return res.status(400).json({ message: "La sede seleccionada no tiene prefijo configurado" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error consultando siguiente codigo de inventario:", err);
      res.status(500).json({ message: "Error consultando el siguiente codigo" });
    }
  }
);

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, columns) {
  if (!columns || columns.length === 0) {
    if (!rows || rows.length === 0) return "";
    columns = Object.keys(rows[0]);
  }
  const header = columns.map(csvEscape).join(",");
  const body = (rows || [])
    .map(row => columns.map(c => csvEscape(row[c])).join(","))
    .join("\n");
  if (!body) return header;
  return `${header}\n${body}`;
}

async function getStockRowsBySede(sedeId, excludeAssignmentId = null) {
  const totals = await pool.query(
    `SELECT s.sede_id,
            s.device_type_id,
            t.name AS device_type,
            COALESCE(s.total, 0)::int AS total
     FROM public.device_stock_sede_type s
     LEFT JOIN public.device_types t
       ON t.id = s.device_type_id
     WHERE ($1 = '' OR s.sede_id = $1)
     ORDER BY t.name`,
    [sedeId || ""]
  );

  const assigned = await pool.query(
    `SELECT a.sede_id,
            d.device_type_id,
            t.name AS device_type,
            COUNT(*)::int AS assigned
     FROM public.device_assignment_items ai
     JOIN public.device_assignments a
       ON a.id = ai.assignment_id
     JOIN public.device_inventory d
       ON d.device_id = ai.device_id
     LEFT JOIN public.device_types t
       ON t.id = d.device_type_id
     WHERE ($1 = '' OR a.sede_id = $1)
       AND COALESCE(a.status, '') <> 'cancelado'
       AND ($2::int IS NULL OR a.id <> $2)
     GROUP BY a.sede_id, d.device_type_id, t.name
     ORDER BY t.name`,
    [sedeId || "", excludeAssignmentId]
  );

  const map = new Map();
  totals.rows.forEach(row => {
    const key = `${row.sede_id || ""}|${row.device_type_id || ""}`;
    map.set(key, {
      sede_id: row.sede_id,
      device_type_id: row.device_type_id,
      device_type: row.device_type,
      total: Number(row.total) || 0,
      assigned: 0
    });
  });
  assigned.rows.forEach(row => {
    const key = `${row.sede_id || ""}|${row.device_type_id || ""}`;
    const current = map.get(key) || {
      sede_id: row.sede_id,
      device_type_id: row.device_type_id,
      device_type: row.device_type,
      total: 0,
      assigned: 0
    };
    current.assigned = Number(row.assigned) || 0;
    map.set(key, current);
  });

  return Array.from(map.values()).map(r => ({
    ...r,
    available: Math.max(0, (Number(r.total) || 0) - (Number(r.assigned) || 0))
  }));
}

app.get(
  "/api/inventario/maestra",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM public.maestra"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando vista maestra:", err);
      res.status(500).json({ message: "Error cargando vista maestra" });
    }
  }
);

app.get(
  "/api/inventario/maestra/export",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM public.maestra"
      );
      const columns = result.fields?.map(f => f.name) || [];
      const csv = toCsv(result.rows, columns);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=\"vista_maestra_inventario.csv\""
      );
      res.send(csv);
    } catch (err) {
      console.error("Error exportando vista maestra:", err);
      res.status(500).json({ message: "Error exportando vista maestra" });
    }
  }
);

app.get(
  "/api/inventario/device-ids",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (device_id) device_id, device_name
         FROM public.sensores_mqtt
         WHERE source = 'inventory'
         ORDER BY device_id, timestamp DESC`
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando device_id:", err);
      res.status(500).json({ message: "Error cargando device_id" });
    }
  }
);

app.get(
  "/api/inventario/stock",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const sedeId = (req.query?.sedeId || "").trim();
    try {
      const rows = await getStockRowsBySede(sedeId);

      res.json({
        sedeId: sedeId || null,
        rows
      });
    } catch (err) {
      console.error("Error calculando stock:", err);
      res.status(500).json({ message: "Error calculando stock" });
    }
  }
);

app.get(
  "/api/inventario/stock-config",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const sedeId = (req.query?.sedeId || "").trim();
    try {
      const result = await pool.query(
        `SELECT s.id, s.sede_id, s.device_type_id, s.total, s.updated_at,
                t.name AS device_type
         FROM public.device_stock_sede_type s
         LEFT JOIN public.device_types t
           ON t.id = s.device_type_id
         WHERE ($1 = '' OR s.sede_id = $1)
         ORDER BY s.sede_id, t.name`,
        [sedeId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando stock manual:", err);
      res.status(500).json({ message: "Error cargando stock" });
    }
  }
);

app.post(
  "/api/inventario/stock-config",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const sedeId = (req.body?.sedeId || "").trim();
    const deviceTypeId = req.body?.deviceTypeId;
    const total = Number(req.body?.total) || 0;
    if (!sedeId || !deviceTypeId) {
      return res.status(400).json({ message: "Sede y tipo son requeridos" });
    }
    if (total < 0) {
      return res.status(400).json({ message: "El total no puede ser negativo" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO public.device_stock_sede_type
         (sede_id, device_type_id, total, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (sede_id, device_type_id)
         DO UPDATE SET total = EXCLUDED.total, updated_at = now()
         RETURNING *`,
        [sedeId, deviceTypeId, total]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error guardando stock:", err);
      res.status(500).json({ message: "Error guardando stock" });
    }
  }
);

app.delete(
  "/api/inventario/stock-config/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM public.device_stock_sede_type WHERE id = $1 RETURNING *",
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Registro no encontrado" });
      }
      res.json({ message: "Stock eliminado" });
    } catch (err) {
      console.error("Error eliminando stock:", err);
      res.status(500).json({ message: "Error eliminando stock" });
    }
  }
);

app.get(
  "/api/inventario/contractors",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, phone, email FROM public.contractor_companies ORDER BY name"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando contratistas:", err);
      res.status(500).json({ message: "Error cargando contratistas" });
    }
  }
);

app.post(
  "/api/inventario/contractors",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim() || null;
    const email = (req.body?.email || "").trim() || null;

    if (!name) {
      return res.status(400).json({ message: "Nombre requerido" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO public.contractor_companies (name, phone, email)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, phone, email]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creando contratista:", err);
      res.status(500).json({ message: "Error creando contratista" });
    }
  }
);

app.put(
  "/api/inventario/contractors/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim() || null;
    const email = (req.body?.email || "").trim() || null;

    if (!name) {
      return res.status(400).json({ message: "Nombre requerido" });
    }

    try {
      const result = await pool.query(
        `UPDATE public.contractor_companies
         SET name = $1, phone = $2, email = $3
         WHERE id = $4
         RETURNING *`,
        [name, phone, email, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Contratista no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ message: "Nombre ya existe" });
      }
      console.error("Error actualizando contratista:", err);
      res.status(500).json({ message: "Error actualizando contratista" });
    }
  }
);

app.delete(
  "/api/inventario/contractors/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM public.contractor_companies WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Contratista no encontrado" });
      }

      res.json({ message: "Contratista eliminado" });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(409).json({
          message: "No se puede eliminar: hay instaladores asociados"
        });
      }
      console.error("Error eliminando contratista:", err);
      res.status(500).json({ message: "Error eliminando contratista" });
    }
  }
);

app.get(
  "/api/inventario/installers",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT i.id, i.name, i.phone, i.email, i.company_id,
                c.name AS company_name
         FROM public.installers i
         LEFT JOIN public.contractor_companies c
           ON c.id = i.company_id
         ORDER BY i.name`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando instaladores:", err);
      res.status(500).json({ message: "Error cargando instaladores" });
    }
  }
);

app.post(
  "/api/inventario/installers",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim() || null;
    const email = (req.body?.email || "").trim() || null;
    const companyId = req.body?.companyId || null;

    if (!name) {
      return res.status(400).json({ message: "Nombre requerido" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO public.installers (name, phone, email, company_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, phone, email, companyId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creando instalador:", err);
      res.status(500).json({ message: "Error creando instalador" });
    }
  }
);

app.get(
  "/api/inventario/assignments",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT a.id, a.quantity, a.status, a.notes, a.assigned_at,
                COALESCE(
                  a.folio,
                  CONCAT('SIASA-ASG-', to_char(a.assigned_at,'YYYY'), '-', LPAD(a.id::text, 6, '0'))
                ) AS folio,
                a.installer_id, i.name AS installer_name,
                i.company_id, c.name AS company_name,
                a.sede_id, s.sede_principal,
                a.location_id, l.name AS location_name,
                COALESCE(
                  ARRAY_AGG(ai.device_id ORDER BY ai.device_id)
                    FILTER (WHERE ai.device_id IS NOT NULL),
                  '{}'::text[]
                ) AS device_ids
         FROM public.device_assignments a
         LEFT JOIN public.installers i ON i.id = a.installer_id
         LEFT JOIN public.contractor_companies c ON c.id = i.company_id
         LEFT JOIN public.sedes s ON s.id_sitio = a.sede_id
         LEFT JOIN public.locations l ON l.id = a.location_id
         LEFT JOIN public.device_assignment_items ai
           ON ai.assignment_id = a.id
         GROUP BY a.id, a.quantity, a.status, a.notes, a.assigned_at,
                  a.installer_id, a.location_id, a.sede_id, i.name, i.company_id,
                  c.name, s.sede_principal, l.name
         ORDER BY a.assigned_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error cargando asignaciones:", err);
      res.status(500).json({ message: "Error cargando asignaciones" });
    }
  }
);

app.post(
  "/api/inventario/assignments",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const {
      installerId,
      sedeId,
      locationId,
      deviceId,
      deviceIds,
      deviceTypeId,
      quantity,
      status,
      notes,
      allowActive
    } = req.body || {};

    if (!installerId) {
      return res.status(400).json({ message: "Instalador requerido" });
    }

    try {
      let ids = Array.isArray(deviceIds) ? deviceIds : deviceId ? [deviceId] : [];
      ids = ids.map(v => String(v).trim()).filter(Boolean);
      ids = Array.from(new Set(ids));

      let qty = Number(quantity) || 1;
      if (ids.length > 0) {
        qty = ids.length;
      }

      if (qty === 1 && ids.length !== 1) {
        return res.status(400).json({
          message: "Debe asignar un device_id cuando la cantidad es 1"
        });
      }

      const stockRows = await getStockRowsBySede(sedeId);
      if (stockRows.length === 0) {
        return res.status(409).json({
          code: "STOCK_EMPTY",
          message: "No hay stock configurado para la sede seleccionada"
        });
      }
      if (stockRows.length > 0) {
        const stockMap = new Map(
          stockRows.map(r => [String(r.device_type_id || ""), r])
        );
        if (ids.length > 0) {
          const typesRes = await pool.query(
            `SELECT d.device_id, d.device_type_id, t.name AS device_type
             FROM public.device_inventory d
             LEFT JOIN public.device_types t
               ON t.id = d.device_type_id
             WHERE d.device_id = ANY($1::text[])`,
            [ids]
          );
          const counts = {};
          const names = {};
          typesRes.rows.forEach(r => {
            const key = String(r.device_type_id || "");
            counts[key] = (counts[key] || 0) + 1;
            if (!names[key]) names[key] = r.device_type || "Sin tipo";
          });
          const violations = Object.keys(counts)
            .map(key => {
              const available = stockMap.get(key)?.available ?? 0;
              return {
                device_type: names[key] || "Sin tipo",
                requested: counts[key],
                available
              };
            })
            .filter(v => v.requested > v.available);
          if (violations.length > 0) {
            return res.status(409).json({
              code: "STOCK",
              message: "Stock insuficiente para uno o m�s tipos",
              details: violations
            });
          }
        } else if (deviceTypeId) {
          const available = stockMap.get(String(deviceTypeId))?.available ?? 0;
          if (qty > available) {
            return res.status(409).json({
              code: "STOCK",
              message: `Stock insuficiente. Disponibles: ${available}`
            });
          }
        } else {
          return res.status(400).json({
            message: "Seleccione un tipo de dispositivo o agregue device_id para validar stock"
          });
        }
      }

      let activeIds = [];
      if (ids.length > 0) {
        const check = await pool.query(
          `SELECT device_id
           FROM public.device_inventory
           WHERE device_id = ANY($1::text[])`,
          [ids]
        );
        if (check.rowCount !== ids.length) {
          return res.status(400).json({
            message: "Algunos device_id no existen en inventario. AgrÃ©galos primero."
          });
        }

        if (sedeId) {
          const sedeCheck = await pool.query(
            `SELECT device_id
             FROM public.device_inventory
             WHERE device_id = ANY($1::text[]) AND sede_id = $2`,
            [ids, sedeId]
          );
          if (sedeCheck.rowCount !== ids.length) {
            return res.status(400).json({
              message: "Algunos device_id no pertenecen a la sede seleccionada"
            });
          }
        }

        const active = await pool.query(
          `SELECT DISTINCT device_id
           FROM public.sensores_mqtt
           WHERE device_id = ANY($1::text[])
             AND source = 'inventory'`,
          [ids]
        );
        if (active.rowCount > 0) {
          activeIds = active.rows.map(r => r.device_id);
          if (!allowActive) {
            return res.status(409).json({
              code: "ACTIVE_DEVICES",
              message: "Existen device_id que ya reportan en sensores_mqtt",
              deviceIds: activeIds
            });
          }
        }

        const assigned = await pool.query(
          `SELECT DISTINCT ai.device_id
           FROM public.device_assignment_items ai
           JOIN public.device_assignments a
             ON a.id = ai.assignment_id
           WHERE ai.device_id = ANY($1::text[])
             AND a.status <> 'cancelado'`,
          [ids]
        );
        if (assigned.rowCount > 0) {
          return res.status(400).json({
            message: "No se puede asignar porque ya est� asignado",
            deviceIds: assigned.rows.map(r => r.device_id)
          });
        }
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `INSERT INTO public.device_assignments
           (installer_id, sede_id, location_id, quantity, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            installerId,
            sedeId || null,
            locationId || null,
            qty,
            status || "pendiente",
            notes || null
          ]
        );

        const assignment = result.rows[0];
        const assignedAt = assignment.assigned_at
          ? new Date(assignment.assigned_at)
          : new Date();
        const year = assignedAt.getFullYear();
        const seqResult = await client.query(
          `INSERT INTO public.assignment_folio_seq (year, last_number)
           VALUES ($1, 1)
           ON CONFLICT (year)
           DO UPDATE SET last_number = public.assignment_folio_seq.last_number + 1
           RETURNING last_number`,
          [year]
        );
        const seq = seqResult.rows[0]?.last_number || 1;
        const folio = `SIASA-ASG-${year}-${String(seq).padStart(6, "0")}`;

        if (ids.length > 0) {
          await client.query(
            `INSERT INTO public.device_assignment_items
             (assignment_id, device_id)
             SELECT $1, UNNEST($2::text[])`,
            [assignment.id, ids]
          );
        }

        const folioResult = await client.query(
          `UPDATE public.device_assignments
           SET folio = $1
           WHERE id = $2
           RETURNING *`,
          [folio, assignment.id]
        );

        await client.query("COMMIT");
        const response = folioResult.rows[0] || assignment;
        res.json({
          ...response,
          warningDeviceIds: activeIds
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Error creando asignacion:", err);
      res.status(500).json({ message: "Error creando asignacion" });
    }
  }
);

app.put(
  "/api/inventario/assignments/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    const {
      installerId,
      sedeId,
      locationId,
      deviceId,
      deviceIds,
      deviceTypeId,
      quantity,
      status,
      notes,
      allowActive
    } = req.body || {};

    if (!installerId) {
      return res.status(400).json({ message: "Instalador requerido" });
    }

    try {
      let ids = Array.isArray(deviceIds) ? deviceIds : deviceId ? [deviceId] : [];
      ids = ids.map(v => String(v).trim()).filter(Boolean);
      ids = Array.from(new Set(ids));

      let qty = Number(quantity) || 1;
      if (ids.length > 0) {
        qty = ids.length;
      }

      if (qty === 1 && ids.length !== 1) {
        return res.status(400).json({
          message: "Debe asignar un device_id cuando la cantidad es 1"
        });
      }

      const stockRows = await getStockRowsBySede(sedeId, Number(id) || null);
      if (stockRows.length === 0) {
        return res.status(409).json({
          code: "STOCK_EMPTY",
          message: "No hay stock configurado para la sede seleccionada"
        });
      }
      if (stockRows.length > 0) {
        const stockMap = new Map(
          stockRows.map(r => [String(r.device_type_id || ""), r])
        );
        if (ids.length > 0) {
          const typesRes = await pool.query(
            `SELECT d.device_id, d.device_type_id, t.name AS device_type
             FROM public.device_inventory d
             LEFT JOIN public.device_types t
               ON t.id = d.device_type_id
             WHERE d.device_id = ANY($1::text[])`,
            [ids]
          );
          const counts = {};
          const names = {};
          typesRes.rows.forEach(r => {
            const key = String(r.device_type_id || "");
            counts[key] = (counts[key] || 0) + 1;
            if (!names[key]) names[key] = r.device_type || "Sin tipo";
          });
          const violations = Object.keys(counts)
            .map(key => {
              const available = stockMap.get(key)?.available ?? 0;
              return {
                device_type: names[key] || "Sin tipo",
                requested: counts[key],
                available
              };
            })
            .filter(v => v.requested > v.available);
          if (violations.length > 0) {
            return res.status(409).json({
              code: "STOCK",
              message: "Stock insuficiente para uno o m�s tipos",
              details: violations
            });
          }
        } else if (deviceTypeId) {
          const available = stockMap.get(String(deviceTypeId))?.available ?? 0;
          if (qty > available) {
            return res.status(409).json({
              code: "STOCK",
              message: `Stock insuficiente. Disponibles: ${available}`
            });
          }
        } else {
          return res.status(400).json({
            message: "Seleccione un tipo de dispositivo o agregue device_id para validar stock"
          });
        }
      }

      let activeIds = [];
      if (ids.length > 0) {
        const check = await pool.query(
          `SELECT device_id
           FROM public.device_inventory
           WHERE device_id = ANY($1::text[])`,
          [ids]
        );
        if (check.rowCount !== ids.length) {
          return res.status(400).json({
            message: "Algunos device_id no existen en inventario. Agregalos primero."
          });
        }

        if (sedeId) {
          const sedeCheck = await pool.query(
            `SELECT device_id
             FROM public.device_inventory
             WHERE device_id = ANY($1::text[]) AND sede_id = $2`,
            [ids, sedeId]
          );
          if (sedeCheck.rowCount !== ids.length) {
            return res.status(400).json({
              message: "Algunos device_id no pertenecen a la sede seleccionada"
            });
          }
        }

        const active = await pool.query(
          `SELECT DISTINCT device_id
           FROM public.sensores_mqtt
           WHERE device_id = ANY($1::text[])
             AND source = 'inventory'`,
          [ids]
        );
        if (active.rowCount > 0) {
          activeIds = active.rows.map(r => r.device_id);
          if (!allowActive) {
            return res.status(409).json({
              code: "ACTIVE_DEVICES",
              message: "Existen device_id que ya reportan en sensores_mqtt",
              deviceIds: activeIds
            });
          }
        }

        const assigned = await pool.query(
          `SELECT DISTINCT ai.device_id
           FROM public.device_assignment_items ai
           JOIN public.device_assignments a
             ON a.id = ai.assignment_id
           WHERE ai.device_id = ANY($1::text[])
             AND a.status <> 'cancelado'
             AND a.id <> $2`,
          [ids, id]
        );
        if (assigned.rowCount > 0) {
          return res.status(400).json({
            message: "No se puede asignar porque ya esta asignado",
            deviceIds: assigned.rows.map(r => r.device_id)
          });
        }
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `UPDATE public.device_assignments
           SET installer_id = $1,
               sede_id = $2,
               location_id = $3,
               quantity = $4,
               status = $5,
               notes = $6
           WHERE id = $7
           RETURNING *`,
          [
            installerId,
            sedeId || null,
            locationId || null,
            qty,
            status || "pendiente",
            notes || null,
            id
          ]
        );

        if (result.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Asignacion no encontrada" });
        }

        await client.query(
          "DELETE FROM public.device_assignment_items WHERE assignment_id = $1",
          [id]
        );

        if (ids.length > 0) {
          await client.query(
            `INSERT INTO public.device_assignment_items
             (assignment_id, device_id)
             SELECT $1, UNNEST($2::text[])`,
            [id, ids]
          );
        }

        await client.query("COMMIT");
        res.json({
          ...result.rows[0],
          warningDeviceIds: activeIds
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Error actualizando asignacion:", err);
      res.status(500).json({ message: "Error actualizando asignacion" });
    }
  }
);

app.post(
  "/api/inventario/devices",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const {
      deviceId,
      name,
      description,
      installDate,
      deviceTypeId,
      locationId,
      manufacturerId,
      modelId,
      codeCompuesto,
      numeroInterno,
      brandModel,
      hospital,
      siteCode,
      areaFunctional,
      areaCode,
      infraId,
      variableMeasure,
      variableSuffix,
      valueMin,
      valueMax,
      unit,
      accessory,
      portAssociated,
      protocol,
      locationExact,
      cabinet,
      cabinetModule,
      rack,
      pdu,
      ups,
      ip,
      ipGateway,
      mascara,
      areaManager,
      areaRole,
      areaPhone,
      estado,
      changeReason,
      sedeId,
      contactoId,
      protocoloId,
      estadoId
    } = req.body || {};

    if (!deviceId || !name) {
      return res.status(400).json({ message: "deviceId y name son requeridos" });
    }

    try {
      const getNextNumeroInternoBySedeAreaAndType = async (
        sedeIdValue,
        areaFunctionalValue,
        deviceTypeIdValue,
        excludeId = null
      ) => {
        if (!sedeIdValue || !areaFunctionalValue || !deviceTypeIdValue) return null;
        const result = await pool.query(
          `SELECT COALESCE(MAX(numero_interno), 0) AS max_num
           FROM public.device_inventory
           WHERE sede_id = $1
             AND LOWER(TRIM(COALESCE(area_functional, ''))) = LOWER(TRIM(COALESCE($2, '')))
             AND device_type_id = $3
             AND ($4::int IS NULL OR id <> $4::int)`,
          [sedeIdValue, areaFunctionalValue, deviceTypeIdValue, excludeId]
        );
        const maxNum = Number(result.rows[0]?.max_num || 0);
        return Number.isFinite(maxNum) ? maxNum + 1 : 1;
      };

      const deviceIdClean = deviceId.trim();
      const valueMinNum =
        valueMin === "" || valueMin == null ? null : Number(valueMin);
      const valueMaxNum =
        valueMax === "" || valueMax == null ? null : Number(valueMax);
      const numeroInternoNum =
        numeroInterno === "" || numeroInterno == null ? null : Number(numeroInterno);
      let numeroInternoVal = Number.isFinite(numeroInternoNum)
        ? Math.trunc(numeroInternoNum)
        : null;
      if (numeroInternoVal == null) {
        numeroInternoVal = await getNextNumeroInternoBySedeAreaAndType(
          (sedeId || "").trim() || null,
          (areaFunctional || "").trim() || null,
          deviceTypeId || null
        );
      }
      const sedeIdClean = (sedeId || "").trim();
      if (!sedeIdClean) return res.status(400).json({ message: "La sede es requerida para generar el codigo" });
      const codeResult = await pool.query(
        `INSERT INTO public.device_code_counters (sede_id, last_number, updated_at)
         SELECT s.id_sitio, 1, NOW() FROM public.sedes s
         WHERE s.id_sitio = $1 AND NULLIF(BTRIM(s.prefijo_sitio), '') IS NOT NULL
         ON CONFLICT (sede_id) DO UPDATE
         SET last_number = public.device_code_counters.last_number + 1, updated_at = NOW()
         RETURNING last_number`, [sedeIdClean]
      );
      if (!codeResult.rowCount) return res.status(400).json({ message: "La sede seleccionada no tiene prefijo configurado" });
      const sedeResult = await pool.query("SELECT UPPER(BTRIM(prefijo_sitio)) AS prefijo FROM public.sedes WHERE id_sitio = $1", [sedeIdClean]);
      const codigo = `${sedeResult.rows[0].prefijo}${String(codeResult.rows[0].last_number).padStart(3, "0")}`;
      const result = await pool.query(
        `INSERT INTO public.device_inventory
         (device_id, name, description, status, install_date,
          device_type_id, location_id, manufacturer_id, model_id,
          code_compuesto, numero_interno, brand_model, hospital, site_code,
          area_functional, area_code, infra_id, variable_measure,
          variable_suffix, value_min, value_max, unit, accessory,
          port_associated, protocol, location_exact, cabinet,
          cabinet_module, rack, pdu, ups, ip, ip_gateway, mascara,
          area_manager, area_role, area_phone, estado, change_reason,
          sede_id, contacto_id, protocolo_id, estado_id, codigo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                 $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
                 $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44)
         RETURNING *`,
        [
          deviceIdClean,
          name.trim(),
          description || null,
          "activo",
          installDate || null,
          deviceTypeId || null,
          locationId || null,
          manufacturerId || null,
          modelId || null,
          (codeCompuesto || "").trim() || null,
          numeroInternoVal,
          (brandModel || "").trim() || null,
          (hospital || "").trim() || null,
          (siteCode || "").trim() || null,
          (areaFunctional || "").trim() || null,
          (areaCode || "").trim() || null,
          (infraId || "").trim() || null,
          (variableMeasure || "").trim() || null,
          (variableSuffix || "").trim() || null,
          valueMinNum,
          valueMaxNum,
          (unit || "").trim() || null,
          (accessory || "").trim() || null,
          (portAssociated || "").trim() || null,
          (protocol || "").trim() || null,
          (locationExact || "").trim() || null,
          (cabinet || "").trim() || null,
          (cabinetModule || "").trim() || null,
          (rack || "").trim() || null,
          (pdu || "").trim() || null,
          (ups || "").trim() || null,
          (ip || "").trim() || null,
          (ipGateway || "").trim() || null,
          (mascara || "").trim() || null,
          (areaManager || "").trim() || null,
          (areaRole || "").trim() || null,
          (areaPhone || "").trim() || null,
          (estado || "").trim() || null,
          (changeReason || "").trim() || null,
          (sedeId || "").trim() || null,
          (contactoId || "").trim() || null,
          (protocoloId || "").trim() || null,
          (estadoId || "").trim() || null,
          codigo
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ message: "deviceId ya existe" });
      }
      console.error("Error creando dispositivo:", err);
      res.status(500).json({ message: "Error creando dispositivo" });
    }
  }
);

app.put(
  "/api/inventario/devices/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    const {
      deviceId,
      name,
      description,
      installDate,
      deviceTypeId,
      locationId,
      manufacturerId,
      modelId,
      codeCompuesto,
      numeroInterno,
      brandModel,
      hospital,
      siteCode,
      areaFunctional,
      areaCode,
      infraId,
      variableMeasure,
      variableSuffix,
      valueMin,
      valueMax,
      unit,
      accessory,
      portAssociated,
      protocol,
      locationExact,
      cabinet,
      cabinetModule,
      rack,
      pdu,
      ups,
      ip,
      ipGateway,
      mascara,
      areaManager,
      areaRole,
      areaPhone,
      estado,
      changeReason,
      sedeId,
      contactoId,
      protocoloId,
      estadoId
    } = req.body || {};

    if (!deviceId || !name) {
      return res.status(400).json({ message: "deviceId y name son requeridos" });
    }

    try {
      const getNextNumeroInternoBySedeAreaAndType = async (
        sedeIdValue,
        areaFunctionalValue,
        deviceTypeIdValue,
        excludeId = null
      ) => {
        if (!sedeIdValue || !areaFunctionalValue || !deviceTypeIdValue) return null;
        const result = await pool.query(
          `SELECT COALESCE(MAX(numero_interno), 0) AS max_num
           FROM public.device_inventory
           WHERE sede_id = $1
             AND LOWER(TRIM(COALESCE(area_functional, ''))) = LOWER(TRIM(COALESCE($2, '')))
             AND device_type_id = $3
             AND ($4::int IS NULL OR id <> $4::int)`,
          [sedeIdValue, areaFunctionalValue, deviceTypeIdValue, excludeId]
        );
        const maxNum = Number(result.rows[0]?.max_num || 0);
        return Number.isFinite(maxNum) ? maxNum + 1 : 1;
      };

      const deviceIdClean = deviceId.trim();
      const valueMinNum =
        valueMin === "" || valueMin == null ? null : Number(valueMin);
      const valueMaxNum =
        valueMax === "" || valueMax == null ? null : Number(valueMax);
      const numeroInternoNum =
        numeroInterno === "" || numeroInterno == null ? null : Number(numeroInterno);
      let numeroInternoVal = Number.isFinite(numeroInternoNum)
        ? Math.trunc(numeroInternoNum)
        : null;
      if (numeroInternoVal == null) {
        numeroInternoVal = await getNextNumeroInternoBySedeAreaAndType(
          (sedeId || "").trim() || null,
          (areaFunctional || "").trim() || null,
          deviceTypeId || null,
          Number(id) || null
        );
      }
      const result = await pool.query(
        `UPDATE public.device_inventory
         SET device_id = $1,
             name = $2,
             description = $3,
             status = $4,
             install_date = $5,
             device_type_id = $6,
             location_id = $7,
             manufacturer_id = $8,
             model_id = $9,
             code_compuesto = $10,
             numero_interno = $11,
             brand_model = $12,
             hospital = $13,
             site_code = $14,
             area_functional = $15,
             area_code = $16,
             infra_id = $17,
             variable_measure = $18,
             variable_suffix = $19,
             value_min = $20,
             value_max = $21,
             unit = $22,
             accessory = $23,
             port_associated = $24,
             protocol = $25,
             location_exact = $26,
             cabinet = $27,
             cabinet_module = $28,
             rack = $29,
             pdu = $30,
             ups = $31,
             ip = $32,
             ip_gateway = $33,
             mascara = $34,
             area_manager = $35,
             area_role = $36,
             area_phone = $37,
             estado = $38,
             change_reason = $39,
             sede_id = $40,
             contacto_id = $41,
             protocolo_id = $42,
             estado_id = $43,
             updated_at = NOW()
         WHERE id = $44
         RETURNING *`,
        [
          deviceIdClean,
          name.trim(),
          description || null,
          "activo",
          installDate || null,
          deviceTypeId || null,
          locationId || null,
          manufacturerId || null,
          modelId || null,
          (codeCompuesto || "").trim() || null,
          numeroInternoVal,
          (brandModel || "").trim() || null,
          (hospital || "").trim() || null,
          (siteCode || "").trim() || null,
          (areaFunctional || "").trim() || null,
          (areaCode || "").trim() || null,
          (infraId || "").trim() || null,
          (variableMeasure || "").trim() || null,
          (variableSuffix || "").trim() || null,
          valueMinNum,
          valueMaxNum,
          (unit || "").trim() || null,
          (accessory || "").trim() || null,
          (portAssociated || "").trim() || null,
          (protocol || "").trim() || null,
          (locationExact || "").trim() || null,
          (cabinet || "").trim() || null,
          (cabinetModule || "").trim() || null,
          (rack || "").trim() || null,
          (pdu || "").trim() || null,
          (ups || "").trim() || null,
          (ip || "").trim() || null,
          (ipGateway || "").trim() || null,
          (mascara || "").trim() || null,
          (areaManager || "").trim() || null,
          (areaRole || "").trim() || null,
          (areaPhone || "").trim() || null,
          (estado || "").trim() || null,
          (changeReason || "").trim() || null,
          (sedeId || "").trim() || null,
          (contactoId || "").trim() || null,
          (protocoloId || "").trim() || null,
          (estadoId || "").trim() || null,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Dispositivo no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ message: "deviceId ya existe" });
      }
      console.error("Error actualizando dispositivo:", err);
      res.status(500).json({ message: "Error actualizando dispositivo" });
    }
  }
);

app.delete(
  "/api/inventario/devices/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM public.device_inventory WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Dispositivo no encontrado" });
      }

      res.json({ message: "Dispositivo eliminado" });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(409).json({
          message: "No se puede eliminar: el dispositivo tiene dependencias"
        });
      }
      console.error("Error eliminando dispositivo:", err);
      res.status(500).json({ message: "Error eliminando dispositivo" });
    }
  }
);

app.put(
  "/api/inventario/installers/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim() || null;
    const email = (req.body?.email || "").trim() || null;
    const companyId = req.body?.companyId || null;

    if (!name) {
      return res.status(400).json({ message: "Nombre requerido" });
    }

    try {
      const result = await pool.query(
        `UPDATE public.installers
         SET name = $1, phone = $2, email = $3, company_id = $4
         WHERE id = $5
         RETURNING *`,
        [name, phone, email, companyId, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Instalador no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error actualizando instalador:", err);
      res.status(500).json({ message: "Error actualizando instalador" });
    }
  }
);

app.delete(
  "/api/inventario/installers/:id",
  verifyJWT,
  requireAnyRole(["admin", "operador"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM public.installers WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Instalador no encontrado" });
      }

      res.json({ message: "Instalador eliminado" });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(409).json({
          message: "No se puede eliminar: hay asignaciones asociadas"
        });
      }
      console.error("Error eliminando instalador:", err);
      res.status(500).json({ message: "Error eliminando instalador" });
    }
  }
);


///HACER PRUEBAS DE FORMA INDIVIDUAL MODBUS EBO 18012026 //////////////
/*
app.get("/api/ebo/voltaje", async (req, res) => {
  try {
    if (!MODBUS_ASP_ENABLED) {
const MODBUS_AUTO_ONLY = String(process.env.MODBUS_AUTO_ONLY ?? "false").toLowerCase() === "true";
      return res.status(503).json({ message: "Modbus AS-P deshabilitado" });
    }
    const data = await readVoltajeIIMedidorPrincipal();
    console.log("? Voltaje le�do ANALIZADOR:", data);
    res.json(data);
    
  } catch (err) {
    console.error("? Error Modbus-AS-P-EBO:", err.message);
    res.status(500).json({ error: err.message });
  }
});
*/


app.get("/api/ebo/ats-a/modbus", verifyJWT,requireRole("admin"),async (req, res) => {
  if (!MODBUS_ATS_ENDPOINTS_ENABLED) {
    return res.status(503).json({ message: "ATS endpoints deshabilitados" });
  }
  if (!hasAtsAModbusReader) {
    return res.status(503).json({ message: "ATS A deshabilitado en lectura_Ebo.js" });
  }
  const data = await readATSA_ModbusVariables();
  console.log("? ATS A Modbus Variables VOLTAJES:", data);
  res.json(data);
});

app.get("/api/ebo/ats-b/modbus", verifyJWT,requireRole("admin"),async (req, res) => {
  if (!MODBUS_ATS_ENDPOINTS_ENABLED) {
    return res.status(503).json({ message: "ATS endpoints deshabilitados" });
  }
  if (!hasAtsBModbusReader) {
    return res.status(503).json({ message: "ATS B deshabilitado en lectura_Ebo.js" });
  }
  const data = await readATSB_ModbusVariables();
  console.log("? ATS B Modbus Variables VOLTAJES:", data);
  res.json(data);
});

app.get("/api/ebo/inversor-mateo/modbus", verifyJWT,requireRole("admin"),async (req, res) => {
  if (!hasInversorMateoModbusReader) {
    return res.status(503).json({ message: "Inversor Mateo deshabilitado en lectura_Ebo.js" });
  }
  const data = await readInversorMateo_ModbusVariables();
  res.json(data);
});
app.get("/api/ebo/modbus-auto", verifyJWT,requireRole("admin"),async (req, res) => {
  let useAuto = false;
  try {
    const options = getModbusAutoOptions(req);
    useAuto = isAutoRequest(options);
    const now = Date.now();

    if (useAuto && hasFreshModbusAutoSnapshot(now)) {
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }

    if (useAuto && hasCompleteModbusAutoSnapshot()) {
      if (!modbusAutoSnapshot.inFlight) {
        pollModbusAutoSnapshot().catch(() => {});
      }
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }

     const cacheKey = JSON.stringify(options);
     if (MODBUS_AUTO_CACHE_MS > 0 &&
         modbusAutoCache.key === cacheKey &&
         (now - modbusAutoCache.ts) < MODBUS_AUTO_CACHE_MS &&
         !getModbusAutoError(modbusAutoCache.data)) {
       return res.json(formatModbusAutoPayload(modbusAutoCache.data));
     }

     if (modbusAutoInFlight.has(cacheKey)) {
       const raw = await modbusAutoInFlight.get(cacheKey);
       return res.json(formatModbusAutoPayload(raw));
     }

     const promise = (async () => {
       const raw = await readModbusAutoRegisters(options);
       const readError = getModbusAutoError(raw);
       if (readError) {
         const err = new Error(readError);
         err.raw = raw;
         throw err;
       }
       return raw;
     })();

     modbusAutoInFlight.set(cacheKey, promise);

    let raw;
    try {
      raw = await promise;
    } finally {
      modbusAutoInFlight.delete(cacheKey);
    }

    if (MODBUS_AUTO_CACHE_MS > 0) {
      modbusAutoCache = { key: cacheKey, ts: now, data: raw };
    }

    if (useAuto) {
      modbusAutoSnapshot = { ts: Date.now(), data: raw, error: null, inFlight: false };
    }

    res.json(formatModbusAutoPayload(raw));
  } catch (err) {
    if (useAuto && hasCompleteModbusAutoSnapshot()) {
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }
    console.error("Error endpoint modbus-auto:", err.message);
    res.status(503).json(buildModbusAutoErrorResponse(err));
  }
});

app.get("/api/ebo/modbus-auto/health", verifyJWT, requireRole("admin"), (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_auto",
    port: MODBUS_AUTO_PORT,
    ts: new Date().toISOString()
  });
});

app.get("/api/ebo/modbus_auto_tec", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    res.json(await readModbusAutoTec());
  } catch (err) {
    console.error("Error endpoint modbus_auto_tec:", err.message);
    res.status(503).json({
      message: "Error leyendo registros Modbus TEC",
      error: err?.message || String(err)
    });
  }
});

app.get("/api/ebo/modbus_auto_tec/health", verifyJWT, requireRole("admin"), (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_auto_tec",
    connection: getModbusTecConnectionInfo(),
    ts: new Date().toISOString()
  });
});

app.get("/api/ebo/modbus_calidadenergia", verifyJWT, requireRole("admin"), async (req, res) => {
  try {
    const pool = await getMssqlPool();
    const result = await pool.request().execute(MSSQL_MODBUS_PROC);
    const payload = extractMssqlJson(result);
    res.json(payload ?? result?.recordset ?? result ?? {});
  } catch (err) {
    console.error("Error endpoint modbus_calidadenergia:", err.message);
    res.status(500).json({ message: "Error ejecutando procedimiento modbus_calidadenergia" });
  }
});

app.get("/api/ebo/modbus_calidadenergia/health", verifyJWT, requireRole("admin"), (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_calidadenergia",
    port: MODBUS_AUTO_PORT,
    ts: new Date().toISOString()
  });
});

app.get("/api/igss/sedes", verifyJWT, requireRole("admin"), handleIgssSedes);
app.get("/api/igss/calidad-energia", verifyJWT, requireRole("admin"), handleIgssCalidadEnergia);
app.get("/api/igss/calidad-energia/historico-json", verifyJWT, requireRole("admin"), handleIgssCalidadEnergiaHistoricoJson);
app.get("/api/igss/sedes/:sede/calidad-energia", verifyJWT, requireRole("admin"), handleIgssCalidadEnergia);

// ======================================================
//  MODBUS AUTO API KEY (PUERTO SEPARADO)
// ======================================================
modbusAutoApp.get("/api/ebo/modbus-auto", apiKeyAuth, async (req, res) => {
  let useAuto = false;
  try {
    const options = getModbusAutoOptions(req);
    useAuto = isAutoRequest(options);
    const now = Date.now();

    if (useAuto && hasFreshModbusAutoSnapshot(now)) {
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }

    if (useAuto && hasCompleteModbusAutoSnapshot()) {
      if (!modbusAutoSnapshot.inFlight) {
        pollModbusAutoSnapshot().catch(() => {});
      }
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }

    const cacheKey = JSON.stringify(options);
    if (MODBUS_AUTO_CACHE_MS > 0 &&
        modbusAutoCache.key === cacheKey &&
        (now - modbusAutoCache.ts) < MODBUS_AUTO_CACHE_MS &&
        !getModbusAutoError(modbusAutoCache.data)) {
      return res.json(formatModbusAutoPayload(modbusAutoCache.data));
    }

    if (modbusAutoInFlight.has(cacheKey)) {
      const raw = await modbusAutoInFlight.get(cacheKey);
      return res.json(formatModbusAutoPayload(raw));
    }

    const promise = (async () => {
      const raw = await readModbusAutoRegisters(options);
      const readError = getModbusAutoError(raw);
      if (readError) {
        const err = new Error(readError);
        err.raw = raw;
        throw err;
      }
      return raw;
    })();

    modbusAutoInFlight.set(cacheKey, promise);

    let raw;
    try {
      raw = await promise;
    } finally {
      modbusAutoInFlight.delete(cacheKey);
    }

    if (MODBUS_AUTO_CACHE_MS > 0) {
      modbusAutoCache = { key: cacheKey, ts: now, data: raw };
    }
    if (useAuto) {
      modbusAutoSnapshot = { ts: now, data: raw, error: null, inFlight: false };
    }
    console.log("MODBUS AUTO APIKEY OK:", raw?.modbus_ebo?.scan?.result || {});
    res.json(formatModbusAutoPayload(raw));
  } catch (err) {
    if (useAuto && hasCompleteModbusAutoSnapshot()) {
      return res.json(formatModbusAutoPayload(modbusAutoSnapshot.data));
    }
    console.error("Error endpoint modbus-auto (apikey):", err.message);
    res.status(503).json(buildModbusAutoErrorResponse(err));
  }
});

modbusAutoApp.get("/api/ebo/modbus-auto/health", apiKeyAuth, (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_auto",
    port: MODBUS_AUTO_PORT,
    ts: new Date().toISOString()
  });
});

modbusAutoApp.get("/api/ebo/modbus_auto_tec", apiKeyAuth, async (req, res) => {
  try {
    res.json(await readModbusAutoTec());
  } catch (err) {
    console.error("Error endpoint modbus_auto_tec (apikey):", err.message);
    res.status(503).json({
      message: "Error leyendo registros Modbus TEC",
      error: err?.message || String(err)
    });
  }
});

modbusAutoApp.get("/api/ebo/modbus_auto_tec/health", apiKeyAuth, (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_auto_tec",
    connection: getModbusTecConnectionInfo(),
    ts: new Date().toISOString()
  });
});

modbusAutoApp.get("/api/ebo/modbus_calidadenergia", apiKeyAuth, async (req, res) => {
  try {
    const pool = await getMssqlPool();
    const result = await pool.request().execute(MSSQL_MODBUS_PROC);
    const payload = extractMssqlJson(result);
    res.json(payload ?? result?.recordset ?? result ?? {});
  } catch (err) {
    console.error("Error endpoint modbus_calidadenergia (apikey):", err.message);
    res.status(500).json({ message: "Error ejecutando procedimiento modbus_calidadenergia" });
  }
});

modbusAutoApp.get("/api/ebo/modbus_calidadenergia/health", apiKeyAuth, (req, res) => {
  res.json({
    ok: true,
    endpoint: "modbus_calidadenergia",
    port: MODBUS_AUTO_PORT,
    ts: new Date().toISOString()
  });
});

modbusAutoApp.get("/api/igss/sedes", apiKeyAuth, handleIgssSedes);
modbusAutoApp.get("/api/igss/calidad-energia", apiKeyAuth, handleIgssCalidadEnergia);
modbusAutoApp.get("/api/igss/calidad-energia/historico-json", apiKeyAuth, handleIgssCalidadEnergiaHistoricoJson);
modbusAutoApp.get("/api/igss/sedes/:sede/calidad-energia", apiKeyAuth, handleIgssCalidadEnergia);


// ======================================================
//  SERVER
// ======================================================

const server = app.listen(3000, "0.0.0.0", async () => {

  console.log("?? API LISTA ? http://10.0.9.33:3000");
  validateStartupTargets().catch((err) => {
    console.warn("? No se pudo completar la validacion inicial de IPs:", err?.message || err);
  });

  try {
    
  } catch (err) {
    console.error("? SERVER LISTEN, Protocolos Modbus-EBO NO disponible:", err.message);
  }

});
server.requestTimeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS;
server.headersTimeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS + 5000;

const modbusAutoServer = modbusAutoApp.listen(MODBUS_AUTO_PORT, MODBUS_AUTO_HOST, () => {
  console.log(`?? MODBUS AUTO APIKEY LISTA -> http://${MODBUS_AUTO_HOST}:${MODBUS_AUTO_PORT}`);
});
modbusAutoServer.requestTimeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS;
modbusAutoServer.headersTimeout = MSSQL_IGSS_REQUEST_TIMEOUT_MS + 5000;
startModbusAutoPolling();

// ======================================================
//  SHUTDOWN LIMPIO (CRITICO)
// ======================================================
async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("Cerrando servicio...");

    try {
        Object.values(mqttClients).forEach(client => {
            if (client) client.end(true);
        });
        await pool.end();
        if (mssqlPool) {
            await mssqlPool.close();
        }
        if (modbusAutoServer) {
            modbusAutoServer.close();
        }
        server.close(() => process.exit(0));
    } catch (err) {
        console.error("Error cerrando recursos:", err);
        process.exit(1);
    }
}

function isRecoverableRuntimeError(err) {
    const msg = String(err?.message || err || "");
    return /TCP Connection Timed Out|Modbus exception|timed out|etimedout/i.test(msg);
}


process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", async (err) => {
    console.error("Uncaught Exception:", err);
    if (isRecoverableRuntimeError(err)) {
        console.warn("Error recuperable detectado. La API sigue activa.");
        return;
    }
    await shutdown();
});
