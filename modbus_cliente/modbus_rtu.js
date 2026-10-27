const ModbusRTU = require("modbus-serial");

const client = new ModbusRTU();
let connected = false;
let connecting = null;
let modbusQueue = Promise.resolve();
let clientErrorHandlersAttached = false;

function parseEnvNumber(value, fallback) {
  if (value == null) return fallback;
  const text = String(value).split("//")[0].split("#")[0].trim();
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const readDelayMs = parseEnvNumber(process.env.MODBUS_READ_DELAY_MS, 30);
const modbusTimeoutMs = parseEnvNumber(process.env.MODBUS_TIMEOUT_MS, 8000);

function getModbusConnectionInfo() {
  return {
    name: process.env.MODBUS_NAME || process.env.MODBUS_SITE_NAME || "EBO-ASP",
    host: process.env.MODBUS_HOST || "10.0.6.26",
    port: parseEnvNumber(process.env.MODBUS_PORT, 502),
    unitId: parseEnvNumber(process.env.MODBUS_ID, 1),
    timeoutMs: modbusTimeoutMs
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDataLengthError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /data length error/i.test(msg);
}

function isTimeoutError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /timed out|timeout|etimedout/i.test(msg);
}

const resetCloseTimeoutMs = parseEnvNumber(process.env.MODBUS_RESET_CLOSE_TIMEOUT_MS, 3000);
let resetCount = 0;
let resetLastLogAt = 0;
let resetTotal = 0;

function getResetTotal() {
  return resetTotal;
}

function logReset(reason) {
  resetCount += 1;
  resetTotal += 1;
  const now = Date.now();
  // Maximo una linea por minuto, con el conteo acumulado desde la anterior.
  if (now - resetLastLogAt < 60000) return;
  console.warn(`[MODBUS-EVENTO] ${JSON.stringify({
    t: new Date(now).toISOString(),
    evento: "RECONEXION",
    motivo: reason || "desconocido",
    reconexiones: resetCount
  })}`);
  resetCount = 0;
  resetLastLogAt = now;
}

// Incidente Escuintla 30/09/2026: client.close() solo resuelve cuando el socket emite
// "close" con la conexion abierta. Si el socket ya estaba cerrado, la promesa no
// resolvia nunca y bloqueaba la cola de lecturas para siempre. Ahora se espera un
// maximo de resetCloseTimeoutMs y luego se destruye el socket.
async function resetModbus(reason) {
  connected = false;
  connecting = null;
  logReset(reason);
  try {
    if (typeof client.close === "function") {
      await Promise.race([
        Promise.resolve().then(() => client.close()),
        sleep(resetCloseTimeoutMs)
      ]);
    }
  } catch (_) {
    // ignore reset errors
  }
  try {
    const socket = client._port && client._port._client;
    if (socket && !socket.destroyed && typeof socket.destroy === "function") {
      socket.destroy();
    }
  } catch (_) {
    // ignore reset errors
  }
}

function attachClientErrorHandlers() {
  if (clientErrorHandlersAttached) return;
  clientErrorHandlersAttached = true;

  client.on("error", (err) => {
    connected = false;
    connecting = null;
    console.error("Error Modbus cliente:", err?.message || err);
  });

  client.on("close", () => {
    connected = false;
    connecting = null;
  });
}

async function connectModbus() {
  attachClientErrorHandlers();
  if (connected) return;
  if (connecting) return connecting;

  connecting = (async () => {
    const connection = getModbusConnectionInfo();
    try {
      await client.connectTCP(connection.host, {
        port: connection.port,
        timeout: modbusTimeoutMs
      });
      client.setID(connection.unitId);
      client.setTimeout(modbusTimeoutMs);

      connected = true;
      console.log("Modbus conectado a", connection.name, connection.host, "ID", connection.unitId);
    } catch (err) {
      await resetModbus(`conexion fallida: ${err?.message || err}`);
      throw err;
    }
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

async function readRegistersForUnit(readFn, unitId, address, count) {
  await connectModbus();

  return withModbusLock(async () => {
    const targetUnitId = Number(unitId);
    const previousUnitId = typeof client.getID === "function"
      ? client.getID()
      : parseEnvNumber(process.env.MODBUS_ID, 1);

    client.setID(targetUnitId);

    try {
      return await readFn(address, count);
    } catch (err) {
      if (isDataLengthError(err) || isTimeoutError(err)) {
        await resetModbus(`unidad ${targetUnitId} dir ${address}: ${err?.message || err}`);
        await connectModbus();
        client.setID(targetUnitId);
        return await readFn(address, count);
      }
      throw err;
    } finally {
      client.setID(previousUnitId);
      if (Number.isFinite(readDelayMs) && readDelayMs > 0) {
        await sleep(readDelayMs);
      }
    }
  });
}

function withModbusLock(fn) {
  const run = modbusQueue.then(fn, fn);
  modbusQueue = run.catch(() => {});
  return run;
}

const readHoldingRegistersRaw = client.readHoldingRegisters.bind(client);
const readInputRegistersRaw = typeof client.readInputRegisters === "function"
  ? client.readInputRegisters.bind(client)
  : null;
const readCoilsRaw = typeof client.readCoils === "function"
  ? client.readCoils.bind(client)
  : null;
const readDiscreteInputsRaw = typeof client.readDiscreteInputs === "function"
  ? client.readDiscreteInputs.bind(client)
  : null;

async function readHoldingRegistersForUnit(unitId, address, count) {
  return readRegistersForUnit(readHoldingRegistersRaw, unitId, address, count);
}

async function readInputRegistersForUnit(unitId, address, count) {
  if (typeof readInputRegistersRaw !== "function") {
    throw new Error("readInputRegisters no disponible");
  }
  return readRegistersForUnit(readInputRegistersRaw, unitId, address, count);
}

function wrapReadWithReconnect(readFn) {
  if (typeof readFn !== "function") return null;

  return (...args) =>
    withModbusLock(async () => {
      try {
        return await readFn(...args);
      } catch (err) {
        if (isDataLengthError(err) || isTimeoutError(err)) {
          await resetModbus(`dir ${args[0]}: ${err?.message || err}`);
          await connectModbus();
          return await readFn(...args);
        }
        throw err;
      } finally {
        if (Number.isFinite(readDelayMs) && readDelayMs > 0) {
          await sleep(readDelayMs);
        }
      }
    });
}

client.readHoldingRegisters = wrapReadWithReconnect(readHoldingRegistersRaw);

if (typeof client.readInputRegisters === "function") {
  client.readInputRegisters = wrapReadWithReconnect(readInputRegistersRaw);
}

if (typeof client.readCoils === "function") {
  client.readCoils = wrapReadWithReconnect(readCoilsRaw);
}

if (typeof client.readDiscreteInputs === "function") {
  client.readDiscreteInputs = wrapReadWithReconnect(readDiscreteInputsRaw);
}

module.exports = {
  client,
  connectModbus,
  resetModbus,
  getResetTotal,
  withModbusLock,
  getModbusConnectionInfo,
  readHoldingRegistersForUnit,
  readInputRegistersForUnit
};
