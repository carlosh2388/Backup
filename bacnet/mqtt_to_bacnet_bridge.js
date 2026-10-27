const mqtt = require("mqtt");
const Bacnet = require("bacstack");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({ path: path.resolve(__dirname, ".env"), override: true });

const {
  ObjectType,
  PropertyIdentifier,
  ApplicationTags,
  Segmentation,
  ErrorClass,
  ErrorCode,
  ConfirmedServiceChoice,
  EngineeringUnits,
  BinaryPV,
  EventState,
  DeviceStatus,
  ASN1_ARRAY_ALL
} = Bacnet.enum;

// MQTT
const MQTT_BROKER = process.env.MQTT_BACNET_BROKER || "mqtt://192.168.70.6:1883";
const INPUT_TOPICS = (process.env.MQTT_BACNET_TOPIC || "sensores/#,application/+/device/+/event/up")
  .split(",")
  .map(topic => topic.trim())
  .filter(Boolean);
const PAYLOAD_ROOT = process.env.MQTT_BACNET_PAYLOAD_ROOT || "auto";
const LOG_MESSAGES = /^(1|true|yes|si)$/i.test(process.env.MQTT_BACNET_LOG_MESSAGES || "");
const LOG_OBJECT_VALUES = /^(1|true|yes|si)$/i.test(process.env.MQTT_BACNET_LOG_OBJECT_VALUES || "");
const LOG_PAYLOAD = /^(1|true|yes|si)$/i.test(process.env.MQTT_BACNET_LOG_PAYLOAD || "");
const FIELD_ALLOWLIST = (process.env.MQTT_BACNET_FIELDS || "")
  .split(",")
  .map(field => field.trim())
  .filter(Boolean);
const PROFILE_AUTO_EXPOSE = (process.env.MQTT_BACNET_PROFILE_AUTO_EXPOSE || "")
  .split(",")
  .map(profile => normalizeProfileName(profile))
  .filter(Boolean);
const PROFILE_FIELD_ALLOWLIST = {
  "wise-4610-s617": ["ai0_value", "ai1_value", "ai2_value", "ai3_value"],
  "wise-4610-s614t": ["ai0_value", "ai1_value", "ai2_value", "ai3_value"],
  "wise-s614t": ["ai0_value", "ai1_value", "ai2_value", "ai3_value"],
  "eva-2310": ["temperature", "humidity", "battery", "low_battery"],
  "leo-s595": ["magnet_status", "battery", "tamper_status"],
  "leo-s595-msg0": ["magnet_status", "battery", "tamper_status"]
};
const FIELD_ALIASES = {
  ai0_value: ["ai0", "aio", "ai0value", "ai0raw", "ai0rawvalue", "ai0ma", "ai0mv", "ch0", "channel0", "pin0", "analog0", "analogvalue0", "analoginput0", "analoginput0value"],
  ai1_value: ["ai1", "ai1value", "ai1raw", "ai1rawvalue", "ai1ma", "ai1mv", "ch1", "channel1", "pin1", "analog1", "analogvalue1", "analoginput1", "analoginput1value"],
  ai2_value: ["ai2", "ai2value", "ai2raw", "ai2rawvalue", "ai2ma", "ai2mv", "ch2", "channel2", "pin2", "analog2", "analogvalue2", "analoginput2", "analoginput2value"],
  ai3_value: ["ai3", "ai3value", "ai3raw", "ai3rawvalue", "ai3ma", "ai3mv", "ch3", "channel3", "pin3", "analog3", "analogvalue3", "analoginput3", "analoginput3value"],
  battery: ["battery", "batterylevel", "batterypercent", "batterypercentage"],
  low_battery: ["lowbattery", "lowbatteryflag"],
  lowbattery: ["lowbattery", "lowbatteryflag"],
  magnet_status: ["magnetstatus", "magnet", "doorstatus"],
  magnetstatus: ["magnetstatus", "magnet", "doorstatus"],
  tamper_status: ["tamperstatus", "tamper"],
  tamperstatus: ["tamperstatus", "tamper"],
  pirStatus: ["pirstatus", "pir", "occupancy"],
  pirstatus: ["pirstatus", "pir", "occupancy"],
  lightLevel: ["lightlevel", "illuminance", "lux"],
  lightlevel: ["lightlevel", "illuminance", "lux"],
  barometricPressure: ["barometricpressure", "barometricpress"],
  barometricpressure: ["barometricpressure", "barometricpress"],
  pm2_5: ["pm25", "pm2p5"]
};

// BACnet/IP
const BACNET_PORT = Number(process.env.MQTT_BACNET_PORT || 47808);
const BACNET_INTERFACE = process.env.MQTT_BACNET_INTERFACE || "0.0.0.0";
const BACNET_BROADCAST = process.env.MQTT_BACNET_BROADCAST || "10.0.6.26";
const BACNET_DEVICE_ID = Number(process.env.MQTT_BACNET_DEVICE_ID || 7006);
const BACNET_VENDOR_ID = Number(process.env.MQTT_BACNET_VENDOR_ID || 999);
const BACNET_DEVICE_NAME = process.env.MQTT_BACNET_DEVICE_NAME || "MQTT Bridge 10.0.6.35";
const BACNET_MAX_APDU = Number(process.env.MQTT_BACNET_MAX_APDU || 1476);
const BACNET_MAX_SEGMENTS = Number(process.env.MQTT_BACNET_MAX_SEGMENTS || 0);
const MAX_OBJECTS = Number(process.env.MQTT_BACNET_MAX_OBJECTS || 1000);
const MAX_BACNET_INSTANCE = 4194302;
const MAX_OBJECT_WARN_INTERVAL_MS = Number(process.env.MQTT_BACNET_MAX_OBJECT_WARN_INTERVAL_MS || 30000);
const DEVICE_ID_SUFFIX_LENGTH = Number(process.env.MQTT_BACNET_DEVICE_ID_SUFFIX_LENGTH || 6);

const bacnetClient = new Bacnet({
  port: BACNET_PORT,
  interface: BACNET_INTERFACE,
  broadcastAddress: BACNET_BROADCAST,
  apduTimeout: 6000
});

const objectsByKey = new Map();
const objectsById = new Map();
let mqttMessageCount = 0;
let bacnetWhoIsCount = 0;
let bacnetReadCount = 0;
let maxObjectsIgnoredCount = 0;
let lastMaxObjectsWarnAt = 0;
let lastBacstackDecodeWarnAt = 0;

function isBacstackDecodeRangeError(err) {
  return err?.code === "ERR_OUT_OF_RANGE" && String(err?.stack || "").includes("node_modules/bacstack");
}

process.on("uncaughtException", (err) => {
  if (isBacstackDecodeRangeError(err)) {
    const now = Date.now();
    if (now - lastBacstackDecodeWarnAt >= 30000) {
      lastBacstackDecodeWarnAt = now;
      console.warn("BACnet packet ignored due to bacstack decode range error:", err.message);
    }
    return;
  }

  console.error("Uncaught exception:", err);
  process.exit(1);
});

function sanitizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_.:/-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "mqtt_value";
}

function normalizeDeviceId(value) {
  return sanitizeName(value)
    .replace(/^eui[:_-]*/i, "")
    .toLowerCase();
}

function objectIdKey(objectId) {
  return `${objectId.type}:${objectId.instance}`;
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createStableObjectId(type, key) {
  let instance = (stableHash(`${type}:${key}`) % MAX_BACNET_INSTANCE) + 1;

  for (let attempts = 0; attempts < 1000; attempts++) {
    const objectId = { type, instance };
    const existing = objectsById.get(objectIdKey(objectId));
    if (!existing || existing.key === key) return objectId;
    instance = instance >= MAX_BACNET_INSTANCE ? 1 : instance + 1;
  }

  return null;
}

function detectDeviceId(topic, payload) {
  const topicMatch = String(topic || "").match(/\/device\/([^/]+)\/event\/up/i);
  const deviceId = normalizeDeviceId(
    payload?.deviceInfo?.devEui ||
    payload?.up?.deviceInfo?.devEui ||
    payload?.end_device_ids?.dev_eui ||
    payload?.devEui ||
    payload?.dev_eui ||
    payload?.deviceId ||
    payload?.device_id ||
    topicMatch?.[1] ||
    "unknown_device"
  );
  if (deviceId === "unknown_device" || !DEVICE_ID_SUFFIX_LENGTH) return deviceId;
  return deviceId.slice(-DEVICE_ID_SUFFIX_LENGTH);
}

function detectDeviceProfile(payload) {
  return normalizeProfileName(
    payload?.deviceInfo?.deviceProfileName ||
    payload?.up?.deviceInfo?.deviceProfileName ||
    payload?.deviceProfileName ||
    payload?.device_profile_name ||
    payload?.end_device_ids?.device_profile_name ||
    ""
  );
}

function normalizeProfileName(value) {
  return sanitizeName(value)
    .toLowerCase()
    .replace(/_+/g, "")
    .replace(/\s*-\s*/g, "-");
}

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function fieldNameFromAllowlist(field, allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return null;
  if (allowlist.includes("*")) return sanitizeName(field);

  const normalized = normalizeFieldName(field);
  const matched = allowlist.find(allowed => {
    const normalizedAllowed = normalizeFieldName(allowed);
    const aliases = FIELD_ALIASES[allowed] || FIELD_ALIASES[normalizedAllowed] || [];
    return normalized === normalizedAllowed || aliases.includes(normalized);
  });

  return matched ? sanitizeName(matched) : null;
}

function exposedFieldName(field, deviceProfile = "") {
  const profile = String(deviceProfile || "").toLowerCase();
  const profileAllowlist = PROFILE_FIELD_ALLOWLIST[profile];
  const profileField = fieldNameFromAllowlist(field, profileAllowlist);

  if (profileField) return profileField;
  if (PROFILE_AUTO_EXPOSE.includes(profile)) return sanitizeName(field);
  if (FIELD_ALLOWLIST.length === 0) return sanitizeName(field);
  return fieldNameFromAllowlist(field, FIELD_ALLOWLIST);
}

function shouldExposeField(field, deviceProfile = "") {
  return Boolean(exposedFieldName(field, deviceProfile));
}

function shouldExposeValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && value.trim().toLowerCase() !== "nan";
  return true;
}

function flattenJSON(value, prefix = "", result = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const key = prefix ? `${prefix}_${index}` : String(index);
      flattenJSON(item, key, result);
    });
    return result;
  }

  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const nextKey = prefix ? `${prefix}_${key}` : key;
      flattenJSON(child, nextKey, result);
    });
    return result;
  }

  if (prefix) {
    result[prefix] = value;
  }
  return result;
}

function getValueByPath(value, dotPath) {
  return dotPath.split(".").reduce((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return current[key];
  }, value);
}

function selectPayloadRoot(payload) {
  if (PAYLOAD_ROOT && PAYLOAD_ROOT !== "auto") {
    const selected = getValueByPath(payload, PAYLOAD_ROOT);
    return selected && typeof selected === "object" && !Array.isArray(selected) ? selected : null;
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.up &&
    typeof payload.up === "object" &&
    !Array.isArray(payload.up) &&
    payload.up.object &&
    typeof payload.up.object === "object" &&
    !Array.isArray(payload.up.object)
  ) {
    return payload.up.object;
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.object &&
    typeof payload.object === "object" &&
    !Array.isArray(payload.object)
  ) {
    return payload.object;
  }

  return null;
}

function parseValue(value) {
  if (typeof value === "boolean") {
    return {
      type: ObjectType.BINARY_VALUE,
      value: value ? BinaryPV.ACTIVE : BinaryPV.INACTIVE,
      tag: ApplicationTags.ENUMERATED
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      type: ObjectType.ANALOG_VALUE,
      value,
      tag: ApplicationTags.REAL
    };
  }

  const text = String(value ?? "").trim();
  if (/^(true|on|active|activo|1)$/i.test(text)) {
    return {
      type: ObjectType.BINARY_VALUE,
      value: BinaryPV.ACTIVE,
      tag: ApplicationTags.ENUMERATED
    };
  }
  if (/^(false|off|inactive|inactivo|0)$/i.test(text)) {
    return {
      type: ObjectType.BINARY_VALUE,
      value: BinaryPV.INACTIVE,
      tag: ApplicationTags.ENUMERATED
    };
  }

  const numeric = Number(text);
  if (text !== "" && Number.isFinite(numeric)) {
    return {
      type: ObjectType.ANALOG_VALUE,
      value: numeric,
      tag: ApplicationTags.REAL
    };
  }

  return {
    type: ObjectType.CHARACTERSTRING_VALUE,
    value: text,
    tag: ApplicationTags.CHARACTER_STRING
  };
}

function createOrGetObject(topic, deviceId, field, rawValue) {
  const parsed = parseValue(rawValue);
  const cleanDeviceId = sanitizeName(deviceId);
  const cleanField = sanitizeName(field);
  const sourceKey = sanitizeName(`${cleanDeviceId}_${cleanField}`);
  const existing = objectsByKey.get(sourceKey);

  if (existing) {
    existing.value = parsed.value;
    existing.rawValue = rawValue;
    existing.lastTopic = topic;
    existing.lastUpdated = new Date().toISOString();
    if (LOG_OBJECT_VALUES) {
      console.log(
        "BACnet object updated:",
        existing.objectId,
        existing.name,
        "value=",
        existing.value,
        "raw=",
        rawValue
      );
    }
    return existing;
  }

  if (objectsByKey.size >= MAX_OBJECTS) {
    maxObjectsIgnoredCount++;
    const now = Date.now();
    if (now - lastMaxObjectsWarnAt >= MAX_OBJECT_WARN_INTERVAL_MS) {
      lastMaxObjectsWarnAt = now;
      console.warn(
        "MQTT BACnet max objects reached:",
        `max=${MAX_OBJECTS}`,
        `objects=${objectsByKey.size}`,
        `ignored=${maxObjectsIgnoredCount}`,
        "last=",
        sourceKey
      );
    }
    return null;
  }

  const objectId = createStableObjectId(parsed.type, sourceKey);
  if (!objectId) {
    console.warn("MQTT BACnet object id collision limit reached, ignoring:", sourceKey);
    return null;
  }

  const object = {
    key: sourceKey,
    objectId,
    name: sourceKey,
    description: `MQTT device ${cleanDeviceId} ${cleanField}`,
    type: parsed.type,
    tag: parsed.tag,
    value: parsed.value,
    rawValue,
    lastTopic: topic,
    deviceId: cleanDeviceId,
    field: cleanField,
    lastUpdated: new Date().toISOString()
  };

  objectsByKey.set(sourceKey, object);
  objectsById.set(objectIdKey(object.objectId), object);
  console.log("BACnet object created:", object.objectId, object.name, "value=", object.value, "raw=", rawValue);
  return object;
}

function getObjectList() {
  return [
    { type: ObjectType.DEVICE, instance: BACNET_DEVICE_ID },
    ...Array.from(objectsByKey.values())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(object => object.objectId)
  ];
}

function valueForObjectProperty(object, property) {
  switch (property.id) {
    case PropertyIdentifier.OBJECT_IDENTIFIER:
      return [{ type: ApplicationTags.OBJECTIDENTIFIER, value: object.objectId }];
    case PropertyIdentifier.OBJECT_NAME:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: object.name }];
    case PropertyIdentifier.OBJECT_TYPE:
      return [{ type: ApplicationTags.ENUMERATED, value: object.objectId.type }];
    case PropertyIdentifier.PRESENT_VALUE:
      return [{ type: object.tag, value: object.value }];
    case PropertyIdentifier.DESCRIPTION:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: object.description }];
    case PropertyIdentifier.STATUS_FLAGS:
      return [{ type: ApplicationTags.BIT_STRING, value: { bitsUsed: 4, value: [0] } }];
    case PropertyIdentifier.EVENT_STATE:
      return [{ type: ApplicationTags.ENUMERATED, value: EventState.NORMAL || 0 }];
    case PropertyIdentifier.OUT_OF_SERVICE:
      return [{ type: ApplicationTags.BOOLEAN, value: false }];
    case PropertyIdentifier.UNITS:
      return [{ type: ApplicationTags.ENUMERATED, value: EngineeringUnits.NO_UNITS || 95 }];
    default:
      return null;
  }
}

function valueForDeviceProperty(property) {
  const objectList = getObjectList();

  switch (property.id) {
    case PropertyIdentifier.OBJECT_IDENTIFIER:
      return [{ type: ApplicationTags.OBJECTIDENTIFIER, value: { type: ObjectType.DEVICE, instance: BACNET_DEVICE_ID } }];
    case PropertyIdentifier.OBJECT_NAME:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: BACNET_DEVICE_NAME }];
    case PropertyIdentifier.OBJECT_TYPE:
      return [{ type: ApplicationTags.ENUMERATED, value: ObjectType.DEVICE }];
    case PropertyIdentifier.DESCRIPTION:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: `MQTT to BACnet bridge for ${MQTT_BROKER}` }];
    case PropertyIdentifier.SYSTEM_STATUS:
      return [{ type: ApplicationTags.ENUMERATED, value: DeviceStatus.OPERATIONAL || 0 }];
    case PropertyIdentifier.PROTOCOL_VERSION:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: 1 }];
    case PropertyIdentifier.PROTOCOL_REVISION:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: 14 }];
    case PropertyIdentifier.MAX_APDU_LENGTH_ACCEPTED:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: BACNET_MAX_APDU }];
    case PropertyIdentifier.SEGMENTATION_SUPPORTED:
      return [{ type: ApplicationTags.ENUMERATED, value: Segmentation.NO_SEGMENTATION }];
    case PropertyIdentifier.MAX_SEGMENTS_ACCEPTED:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: BACNET_MAX_SEGMENTS }];
    case PropertyIdentifier.APDU_TIMEOUT:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: 6000 }];
    case PropertyIdentifier.APDU_SEGMENT_TIMEOUT:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: 6000 }];
    case PropertyIdentifier.NUMBER_OF_APDU_RETRIES:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: 3 }];
    case PropertyIdentifier.DEVICE_ADDRESS_BINDING:
      return [];
    case PropertyIdentifier.DATABASE_REVISION:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: objectsByKey.size }];
    case PropertyIdentifier.OBJECT_LIST:
      if (property.index === 0) {
        return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: objectList.length }];
      }
      if (property.index && property.index !== ASN1_ARRAY_ALL) {
        const item = objectList[property.index - 1];
        return item ? [{ type: ApplicationTags.OBJECTIDENTIFIER, value: item }] : null;
      }
      return objectList.map(item => ({ type: ApplicationTags.OBJECTIDENTIFIER, value: item }));
    case PropertyIdentifier.VENDOR_IDENTIFIER:
      return [{ type: ApplicationTags.UNSIGNED_INTEGER, value: BACNET_VENDOR_ID }];
    case PropertyIdentifier.MODEL_NAME:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: "MQTT to BACnet Bridge" }];
    case PropertyIdentifier.FIRMWARE_REVISION:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: "1.0" }];
    case PropertyIdentifier.APPLICATION_SOFTWARE_VERSION:
      return [{ type: ApplicationTags.CHARACTER_STRING, value: "1.0" }];
    case PropertyIdentifier.STATUS_FLAGS:
      return [{ type: ApplicationTags.BIT_STRING, value: { bitsUsed: 4, value: [0] } }];
    case PropertyIdentifier.EVENT_STATE:
      return [{ type: ApplicationTags.ENUMERATED, value: EventState.NORMAL || 0 }];
    case PropertyIdentifier.OUT_OF_SERVICE:
      return [{ type: ApplicationTags.BOOLEAN, value: false }];
    default:
      return null;
  }
}

function expandProperties(objectId, properties) {
  return properties.flatMap(property => {
    if (property.id !== PropertyIdentifier.ALL) return [property];

    if (objectId.type === ObjectType.DEVICE) {
      return [
        { id: PropertyIdentifier.OBJECT_IDENTIFIER },
        { id: PropertyIdentifier.OBJECT_NAME },
        { id: PropertyIdentifier.OBJECT_TYPE },
        { id: PropertyIdentifier.OBJECT_LIST },
        { id: PropertyIdentifier.DESCRIPTION },
        { id: PropertyIdentifier.SYSTEM_STATUS },
        { id: PropertyIdentifier.VENDOR_IDENTIFIER },
        { id: PropertyIdentifier.PROTOCOL_VERSION },
        { id: PropertyIdentifier.PROTOCOL_REVISION },
        { id: PropertyIdentifier.MAX_APDU_LENGTH_ACCEPTED },
        { id: PropertyIdentifier.SEGMENTATION_SUPPORTED },
        { id: PropertyIdentifier.MAX_SEGMENTS_ACCEPTED },
        { id: PropertyIdentifier.APDU_TIMEOUT },
        { id: PropertyIdentifier.NUMBER_OF_APDU_RETRIES },
        { id: PropertyIdentifier.DATABASE_REVISION }
      ];
    }

    return [
      { id: PropertyIdentifier.OBJECT_IDENTIFIER },
      { id: PropertyIdentifier.OBJECT_NAME },
      { id: PropertyIdentifier.OBJECT_TYPE },
      { id: PropertyIdentifier.PRESENT_VALUE },
      { id: PropertyIdentifier.DESCRIPTION },
      { id: PropertyIdentifier.STATUS_FLAGS },
      { id: PropertyIdentifier.EVENT_STATE },
      { id: PropertyIdentifier.OUT_OF_SERVICE }
    ];
  });
}

function readPropertyValue(objectId, property) {
  if (objectId.type === ObjectType.DEVICE && objectId.instance === BACNET_DEVICE_ID) {
    return valueForDeviceProperty(property);
  }

  const object = objectsById.get(objectIdKey(objectId));
  if (!object) return null;
  return valueForObjectProperty(object, property);
}

function sendReadError(address, invokeId, errorCode = ErrorCode.UNKNOWN_OBJECT) {
  bacnetClient.errorResponse(
    address,
    ConfirmedServiceChoice.READ_PROPERTY,
    invokeId,
    ErrorClass.OBJECT,
    errorCode
  );
}

function sendWriteError(address, invokeId, errorCode = ErrorCode.WRITE_ACCESS_DENIED) {
  bacnetClient.errorResponse(
    address,
    ConfirmedServiceChoice.WRITE_PROPERTY,
    invokeId,
    ErrorClass.PROPERTY,
    errorCode
  );
}

function isAcceptedDeviceWrite(request) {
  if (
    request?.objectId?.type !== ObjectType.DEVICE ||
    request?.objectId?.instance !== BACNET_DEVICE_ID
  ) {
    return false;
  }

  return [
    PropertyIdentifier.MAX_SEGMENTS_ACCEPTED,
    PropertyIdentifier.MAX_APDU_LENGTH_ACCEPTED,
    PropertyIdentifier.SEGMENTATION_SUPPORTED,
    PropertyIdentifier.APDU_TIMEOUT,
    PropertyIdentifier.APDU_SEGMENT_TIMEOUT,
    PropertyIdentifier.NUMBER_OF_APDU_RETRIES
  ].includes(request?.property?.id);
}

bacnetClient.on("whoIs", () => {
  bacnetWhoIsCount++;
  console.log("BACnet Who-Is received, sending I-Am:", BACNET_DEVICE_ID);
  bacnetClient.iAmResponse(
    BACNET_DEVICE_ID,
    Segmentation.NO_SEGMENTATION,
    BACNET_VENDOR_ID
  );
});

bacnetClient.on("readProperty", ({ address, invokeId, request }) => {
  bacnetReadCount++;
  const value = readPropertyValue(request.objectId, request.property);
  if (!value) {
    console.warn("BACnet readProperty unknown:", address, request.objectId, request.property);
    sendReadError(address, invokeId);
    return;
  }

  bacnetClient.readPropertyResponse(
    address,
    invokeId,
    request.objectId,
    request.property,
    value
  );
});

bacnetClient.on("readPropertyMultiple", ({ address, invokeId, request }) => {
  bacnetReadCount++;
  const values = [];

  for (const item of request.properties || []) {
    const properties = expandProperties(item.objectId, item.properties || []);
    const result = {
      objectId: item.objectId,
      values: []
    };

    for (const property of properties) {
      const value = readPropertyValue(item.objectId, property);
      if (value) {
        result.values.push({ property, value });
      } else {
        result.values.push({
          property,
          value: [{
            value: {
              type: "BacnetError",
              errorClass: ErrorClass.PROPERTY,
              errorCode: ErrorCode.UNKNOWN_PROPERTY
            }
          }]
        });
      }
    }

    values.push(result);
  }

  bacnetClient.readPropertyMultipleResponse(address, invokeId, values);
});

bacnetClient.on("writeProperty", ({ address, invokeId, request }) => {
  if (isAcceptedDeviceWrite(request)) {
    console.log("BACnet writeProperty accepted:", address, request.objectId, request.property);
    bacnetClient.simpleAckResponse(address, ConfirmedServiceChoice.WRITE_PROPERTY, invokeId);
    return;
  }

  console.warn("BACnet writeProperty denied:", address, request?.objectId, request?.property);
  sendWriteError(address, invokeId);
});

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: process.env.MQTT_BACNET_CLIENT_ID || `mqtt-to-bacnet-${BACNET_DEVICE_ID}`,
  reconnectPeriod: 5000,
  keepalive: 30
});

mqttClient.on("connect", () => {
  console.log("MQTT connected:", MQTT_BROKER);
  mqttClient.subscribe(INPUT_TOPICS, (err, granted) => {
    if (err) {
      console.error("MQTT subscribe error:", err.message);
      return;
    }
    const grantedTopics = Array.isArray(granted) ? granted.map(item => item.topic) : INPUT_TOPICS;
    console.log("MQTT subscribed:", grantedTopics.join(", "));
  });
});

mqttClient.on("message", (topic, message) => {
  try {
    mqttMessageCount++;
    const text = message.toString();
    const rawPayload = JSON.parse(text);
    if (LOG_PAYLOAD) {
      console.log("MQTT raw payload:", topic, JSON.stringify(rawPayload));
    }
    const payloadRoot = selectPayloadRoot(rawPayload);
    if (!payloadRoot) {
      if (LOG_MESSAGES || mqttMessageCount <= 5) {
        console.log("MQTT message ignored without object payload:", topic);
      }
      return;
    }

    const deviceId = detectDeviceId(topic, rawPayload);
    const deviceProfile = detectDeviceProfile(rawPayload);
    const flattened = flattenJSON(payloadRoot);
    const exposedEntries = Object.entries(flattened)
      .map(([field, value]) => ({ field, value, exposedField: exposedFieldName(field, deviceProfile) }))
      .filter(item => item.exposedField && shouldExposeValue(item.value));
    const exposedFields = exposedEntries.map(item => item.exposedField);

    if (LOG_MESSAGES || mqttMessageCount <= 5) {
      console.log(
        "MQTT object:",
        deviceId,
        deviceProfile ? `profile=${deviceProfile}` : "profile=(unknown)",
        "fields:",
        exposedFields.join(", ") || "(empty)"
      );
      console.log(
        "MQTT exposed values:",
        exposedEntries.map(item => `${item.exposedField}=${item.value}`).join(", ") || "(empty)"
      );
    }

    exposedEntries.forEach(({ exposedField, value }) => {
      createOrGetObject(topic, deviceId, exposedField, value);
    });
  } catch (err) {
    console.error("MQTT processing error:", err.message);
  }
});

mqttClient.on("error", (err) => {
  console.error("MQTT error:", err.message);
});

process.on("SIGINT", () => {
  mqttClient.end(true);
  bacnetClient.close();
  process.exit(0);
});

console.log("MQTT to BACnet bridge started");
console.log("BACnet device:", BACNET_DEVICE_ID, "port:", BACNET_PORT, "broadcast:", BACNET_BROADCAST);
console.log("MQTT source:", MQTT_BROKER, "topics:", INPUT_TOPICS.join(", "));
console.log("MQTT payload root:", PAYLOAD_ROOT);

setInterval(() => {
  console.log(
    "Bridge status:",
    `mqttMessages=${mqttMessageCount}`,
    `objects=${objectsByKey.size}`,
    `bacnetWhoIs=${bacnetWhoIsCount}`,
    `bacnetReads=${bacnetReadCount}`
  );
}, 60000);

module.exports = {
  bacnetClient,
  mqttClient,
  objectsByKey,
  flattenJSON,
  createOrGetObject
};
