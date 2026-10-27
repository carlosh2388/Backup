const axios = require("axios");

const WISE_BASE_URL = String(
  process.env.WISE_BASE_URL ||
  process.env.WISE_URL ||
  "http://127.0.0.1"
).replace(/\/+$/, "");

const WISE_TIMEOUT_MS = Number(process.env.WISE_TIMEOUT_MS || 10000);
const WISE_RETRY_COUNT = Math.max(0, Number(process.env.WISE_RETRY_COUNT || 1));
const WISE_RETRY_DELAY_MS = Math.max(0, Number(process.env.WISE_RETRY_DELAY_MS || 500));
const WISE_CACHE_MS = Math.max(0, Number(process.env.WISE_CACHE_MS || 3000));
const WISE_USERNAME = String(process.env.WISE_USERNAME || process.env.WISE_USER || "").trim();
const WISE_PASSWORD = String(process.env.WISE_PASSWORD || process.env.WISE_PASS || "");
const WISE_DEVICE_ID = String(process.env.WISE_DEVICE_ID || "conc-001").trim();
const WISE_GROUP_TYPE = String(process.env.WISE_GROUP_TYPE || "mini_data_center").trim();
const WISE_CHANNEL_TYPES = String(
  process.env.WISE_CHANNEL_TYPES || "motion,liquid,digital_input_2,digital_input_3"
)
  .split(",")
  .map(item => String(item || "").trim())
  .filter(Boolean);
const WISE_DISABLED_CHANNELS = new Set(
  String(process.env.WISE_DISABLED_CHANNELS || "2,3")
    .split(",")
    .map(item => Number(String(item || "").trim()))
    .filter(Number.isInteger)
);
const wiseResponseCache = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCachedWiseResponse(cacheKey, maxAgeMs = WISE_CACHE_MS) {
  const cached = wiseResponseCache.get(cacheKey);
  if (!cached) return null;
  if (maxAgeMs <= 0) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

function getAnyCachedWiseResponse(cacheKey) {
  return wiseResponseCache.get(cacheKey)?.data ?? null;
}

function setCachedWiseResponse(cacheKey, data) {
  wiseResponseCache.set(cacheKey, {
    ts: Date.now(),
    data
  });
}

async function getWiseJson(path = "/", options = {}) {
  const normalizedPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${path}`;
  const baseUrl = String(options.baseUrl || WISE_BASE_URL || "").replace(/\/+$/, "");
  const cacheKeyPrefix = String(options.cacheKeyPrefix || baseUrl || WISE_BASE_URL || "default");
  const cacheKey = `${cacheKeyPrefix}:${normalizedPath}`;
  const freshCache = getCachedWiseResponse(cacheKey);
  if (freshCache) {
    return freshCache;
  }

  const requestConfig = {
    timeout: WISE_TIMEOUT_MS,
    // WISE es un equipo de red local; evitamos que axios use proxies globales
    // del entorno que desvían la conexión fuera de la LAN.
    proxy: false,
    headers: {
      Accept: "application/json"
    }
  };

  if (WISE_USERNAME) {
    requestConfig.auth = {
      username: WISE_USERNAME,
      password: WISE_PASSWORD
    };
  }

  let lastError = null;
  const attempts = WISE_RETRY_COUNT + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await axios.get(`${baseUrl}${normalizedPath}`, requestConfig);
      setCachedWiseResponse(cacheKey, response.data);
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(WISE_RETRY_DELAY_MS);
      }
    }
  }

  const staleCache = getAnyCachedWiseResponse(cacheKey);
  if (staleCache) {
    return staleCache;
  }

  throw lastError;
}

function formatWiseDiPayload(raw, deviceMeta = {}) {
  const source = Array.isArray(raw?.DIVal) ? raw.DIVal : [];
  const deviceId = String(deviceMeta.id || WISE_DEVICE_ID).trim() || WISE_DEVICE_ID;

  const channels = source.map((item, index) => {
    const channelNumber = Number(item?.Ch ?? index);

    return {
      ch: channelNumber,
      type: WISE_CHANNEL_TYPES[index] || `digital_input_${index}`,
      enabled: !WISE_DISABLED_CHANNELS.has(channelNumber),
      val: Number(item?.Val ?? 0),
      stat: Number(item?.Stat ?? 0),
      md: Number(item?.Md ?? 0),
      cnting: Number(item?.Cnting ?? 0),
      ovLch: Number(item?.OvLch ?? 0)
    };
  });

  return {
    devices: [
      {
        id: deviceId,
        deviceType: "DIVal",
        groupType: WISE_GROUP_TYPE,
        enabled: true,
        channels
      }
    ]
  };
}

module.exports = {
  getWiseJson,
  formatWiseDiPayload,
  WISE_BASE_URL,
  WISE_TIMEOUT_MS,
  WISE_RETRY_COUNT,
  WISE_RETRY_DELAY_MS,
  WISE_CACHE_MS,
  WISE_USERNAME,
  WISE_DEVICE_ID,
  WISE_GROUP_TYPE
};
