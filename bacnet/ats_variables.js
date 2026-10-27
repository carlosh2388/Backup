
const Bacnet = require("bacstack");
const { client, discoverEBO } = require("./bacnet_cliente");
const { getObjectList } = require("./ebo_device");

async function getATSA_Variables() {
  const address = await discoverEBO();
  const objects = await getObjectList();

  const variables = objects.filter(o =>
    o.type === Bacnet.enum.ObjectType.ANALOG_VALUE ||
    o.type === Bacnet.enum.ObjectType.BINARY_VALUE
  );

  return new Promise((resolve) => {
    const results = [];
    let pending = variables.length;

    if (pending === 0) return resolve([]);

    variables.forEach(obj => {
      client.readProperty(
        address,
        obj,
        Bacnet.enum.PropertyIdentifier.PRESENT_VALUE,
        (err, value) => {

          if (!err && value?.values?.length) {
            results.push({
              name: `${obj.type === 2 ? "AV" : "BV"}-${obj.instance}`,
              value: value.values[0].value
            });
          }

          if (--pending === 0) resolve(results);
        }
      );
    });
  });
}

module.exports = { getATSA_Variables };


/*
const Bacnet = require("bacstack");
const client = new Bacnet({ apduTimeout: 6000 });

const EBO_IP = "10.30.39.172";

async function getATSA_Variables() {
  return new Promise((resolve) => {
    const results = [];
    let pending = 10;

    for (let i = 0; i < 10; i++) {
      client.readProperty(
        EBO_IP,
        { type: Bacnet.enum.ObjectType.ANALOG_VALUE, instance: i },
        Bacnet.enum.PropertyIdentifier.PRESENT_VALUE,
        (err, value) => {
          if (!err && value?.values?.length) {
            results.push({
              name: `AV-${i}`,
              value: value.values[0].value
            });
          }

          if (--pending === 0) {
            resolve(results); // 👈 SIEMPRE devuelve array
          }
        }
      );
    }
  });
}

module.exports = { getATSA_Variables };
*/