const Bacnet = require("bacstack");
const client = new Bacnet({ port: 47808, apduTimeout: 6000 });

const EBO_IP = "192.168.71.247";
const DEVICE_ID = '24e124710f135483';

function getObjectList() {
  return new Promise((resolve, reject) => {
    client.readProperty(
      EBO_IP,
      { type: Bacnet.enum.ObjectType.DEVICE, instance: DEVICE_ID },
      Bacnet.enum.PropertyIdentifier.OBJECT_LIST,
      (err, result) => {
        if (err) return reject(err);

        // 🔑 NORMALIZAMOS
        const objects = result.values.map(v => v.value);
        resolve(objects);
      }
    );
  });
}

module.exports = { getObjectList };

/*
const Bacnet = require("bacstack");
const { client, EBO_IP, DEVICE_ID } = require("./bacnet_cliente");

// 🔹 Lectura con timeout manual
function readBasicObject(objectId, timeoutMs = 400) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error("timeout"));
      }
    }, timeoutMs);

    client.readPropertyMultiple(
      EBO_IP,
      [
        {
          objectId: objectId,
          properties: [
            { id: Bacnet.enum.PropertyIdentifier.OBJECT_NAME },
            { id: Bacnet.enum.PropertyIdentifier.PRESENT_VALUE }
          ]
        }
      ],
      (err, result) => {
        if (finished) return;

        clearTimeout(timer);
        finished = true;

        if (err) return reject(err);

        const values = result.values[0].values;

        resolve({
          type: objectId.type,
          instance: objectId.instance,
          name: values.find(v => v.id === Bacnet.enum.PropertyIdentifier.OBJECT_NAME)?.value,
          value: values.find(v => v.id === Bacnet.enum.PropertyIdentifier.PRESENT_VALUE)?.value
        });
      }
    );
  });
}

// 🔥 SCANNER REAL PARA EBO
async function scanEboPoints() {
  const results = [];

  const TYPES = [
    Bacnet.enum.ObjectType.ANALOG_VALUE, // casi todos los Modbus están aquí
    Bacnet.enum.ObjectType.BINARY_VALUE
  ];

  // 🔑 RANGO REALISTA PARA EBO
  const START = 1;
  const END   = 500000;   // EBO usa instancias muy altas

  for (const type of TYPES) {
    console.log("🔍 Escaneando tipo:", type);

    for (let i = START; i <= END; i++) {
      try {
        const data = await readBasicObject({ type, instance: i });

        // 🔥 Filtro: solo nombres reales de EBO
        if (data && data.name && data.name.includes("/")) {
          console.log("✅ ENCONTRADO:", data.instance, "-", data.name);
          results.push(data);
        }

      } catch (err) {
        // timeout o no existe → ignorar
      }

      // pausa para no matar el EBO
      if (i % 100 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  }

  console.log("🎯 TOTAL PUNTOS ENCONTRADOS:", results.length);
  return results;
}

module.exports = { scanEboPoints };
*/

/*
const Bacnet = require("bacstack");

const client = new Bacnet({
  port: 47808,
  apduTimeout: 6000
});

const EBO_IP = "10.30.39.172";
const DEVICE_ID = 3497261;

function getObjectList() {
  return new Promise((resolve, reject) => {

    client.readProperty(
      EBO_IP,                           // ✅ STRING, NO objeto
      { type: 8, instance: DEVICE_ID }, // device
      76,                               // objectList
      (err, result) => {
        if (err) return reject(err);
        resolve(result.values);
      }
    );

  });
}

module.exports = {
  getObjectList
};
*/

/*
const { client, EBO_IP, DEVICE_ID } = require("./bacnet_cliente");
const Bacnet = require("bacstack");

function getObjectList() {
  return new Promise((resolve, reject) => {
    client.readProperty(
      EBO_IP,
      { type: Bacnet.enum.ObjectType.DEVICE, instance: DEVICE_ID },
      Bacnet.enum.PropertyIdentifier.OBJECT_LIST,
      (err, value) => {
        if (err) return reject(err);
        resolve(value.values);
      }
    );
  });
}

module.exports = getObjectList;
*/

/*
const Bacnet = require("bacstack");
const { client, EBO_IP, DEVICE_ID } = require("./bacnet_cliente");

function getObjectList() {
  return new Promise((resolve, reject) => {
    client.readProperty(
      EBO_IP,
      { type: Bacnet.enum.ObjectType.DEVICE, instance: DEVICE_ID },
      Bacnet.enum.PropertyIdentifier.OBJECT_LIST,
      {},
      (err, value) => {
        if (err) return reject(err);
        resolve(value.values);
      }
    );
  });
}

module.exports = { getObjectList };
*/