const Bacnet = require("bacstack");
const { client, EBO_IP } = require("./bacnet_cliente");

console.log("🚀 Escaneando Device IDs BACnet en EBO...");

function tryDevice(deviceId, timeoutMs = 500) {
  return new Promise((resolve) => {
    let finished = false;

    // Timeout manual
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(null);
      }
    }, timeoutMs);

    client.readProperty(
      EBO_IP,
      { type: Bacnet.enum.ObjectType.DEVICE, instance: deviceId },
      Bacnet.enum.PropertyIdentifier.OBJECT_NAME,
      (err, result) => {
        if (finished) return;

        clearTimeout(timer);
        finished = true;

        if (err) return resolve(null);

        const name = result.values[0].value;
        resolve({ deviceId, name });
      }
    );
  });
}

(async () => {
  const found = [];

  // 🔑 RANGO MÁS REALISTA PARA EMPEZAR
  const START = 30000;
  const END   = 60000;

  for (let id = START; id <= END; id++) {
    const dev = await tryDevice(id);

    if (dev) {
      console.log("✅ Device encontrado:", dev.deviceId, "-", dev.name);
      found.push(dev);
    }

    // pequeña pausa para no saturar EBO
    await new Promise(r => setTimeout(r, 20));
  }

  console.log("🎯 TOTAL DEVICES ENCONTRADOS:", found.length);
  console.log(found);

  client.close();
  process.exit(0);
})();

