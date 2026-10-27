const axios = require("axios");

const WISE_BASE_URL = String(
  process.env.WISE_BASE_URL ||
  process.env.WISE_URL ||
  "http://127.0.0.1"
).replace(/\/+$/, "");

const WISE_TIMEOUT_MS = Number(process.env.WISE_TIMEOUT_MS || 10000);
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

async function getWiseJson(path = "/") {
  const normalizedPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${path}`;

  const requestConfig = {
    timeout: WISE_TIMEOUT_MS,
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

  const response = await axios.get(`${WISE_BASE_URL}${normalizedPath}`, requestConfig);

  return response.data;
}

function formatWiseDiPayload(raw) {
  const source = Array.isArray(raw?.DIVal) ? raw.DIVal : [];

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
        id: WISE_DEVICE_ID,
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
  WISE_USERNAME,
  WISE_DEVICE_ID,
  WISE_GROUP_TYPE
};
