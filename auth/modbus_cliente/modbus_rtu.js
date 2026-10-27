const ModbusRTU = require("modbus-serial");

const client = new ModbusRTU();
let connected = false;
let connecting = null;
let modbusQueue = Promise.resolve();
const readDelayMs = Number(process.env.MODBUS_READ_DELAY_MS ?? 30);
const modbusTimeoutMs = Number(process.env.MODBUS_TIMEOUT_MS ?? 8000);

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

async function resetModbus() {
  connected = false;
  connecting = null;
  try {
    if (typeof client.close === "function") {
      client.close();
    } else if (client._client) {
      if (typeof client._client.end === "function") client._client.end();
      if (typeof client._client.destroy === "function") client._client.destroy();
    }
  } catch (_) {
    // ignore reset errors
  }
}

async function connectModbus() {
  if (connected) return;
  if (connecting) return connecting;

  connecting = (async () => {
    await client.connectTCP("10.30.39.172", { port: 502 }); // IP del EBO
    client.setID(1); // Unit ID del EBO (NORMALMENTE 1)
    client.setTimeout(modbusTimeoutMs);

    connected = true;
    console.log("✔ Modbus conectado a EBO");
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

function withModbusLock(fn) {
  const run = modbusQueue.then(fn, fn);
  modbusQueue = run.catch(() => {});
  return run;
}

const readHoldingRegistersRaw = client.readHoldingRegisters.bind(client);
client.readHoldingRegisters = (...args) =>
  withModbusLock(async () => {
    try {
      return await readHoldingRegistersRaw(...args);
    } catch (err) {
      if (isDataLengthError(err) || isTimeoutError(err)) {
        await resetModbus();
        await connectModbus();
        return await readHoldingRegistersRaw(...args);
      }
      throw err;
    } finally {
      if (Number.isFinite(readDelayMs) && readDelayMs > 0) {
        await sleep(readDelayMs);
      }
    }
  });

if (typeof client.readInputRegisters === "function") {
  const readInputRegistersRaw = client.readInputRegisters.bind(client);
  client.readInputRegisters = (...args) =>
    withModbusLock(async () => {
      try {
        return await readInputRegistersRaw(...args);
      } catch (err) {
        if (isDataLengthError(err) || isTimeoutError(err)) {
          await resetModbus();
          await connectModbus();
          return await readInputRegistersRaw(...args);
        }
        throw err;
      } finally {
        if (Number.isFinite(readDelayMs) && readDelayMs > 0) {
          await sleep(readDelayMs);
        }
      }
    });
}

module.exports = {
  client,
  connectModbus,
  withModbusLock
};
