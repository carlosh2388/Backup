const Bacnet = require("bacstack");
const { client, EBO_IP } = require("./bacnet_cliente");

// 🔹 Escaneo por fuerza bruta de objetos BACnet
async function scanObjects() {
  const results = [];

  const TYPES = [
    Bacnet.enum.ObjectType.ANALOG_INPUT,
    Bacnet.enum.ObjectType.ANALOG_VALUE,
    Bacnet.enum.ObjectType.BINARY_INPUT,
    Bacnet.enum.ObjectType.BINARY_VALUE
  ];

  const MAX_INSTANCE = 5000;   // puedes subir o bajar esto

  for (const type of TYPES) {
    console.log("🔍 Escaneando tipo:", type);

    for (let i = 1; i <= MAX_INSTANCE; i++) {
      try {
        const data = await readBasicObject({ type, instance: i });
        if (data) {
          console.log("✅ Encontrado:", data.name);
          results.push(data);
        }
      } catch (err) {
        // silencio: este objeto no existe
      }
    }
  }

  return results;
}

// 🔹 Leer nombre + valor de un objeto (si existe)
function readBasicObject(objectId) {
  return new Promise((resolve, reject) => {
    client.readPropertyMultiple(
      EBO_IP,
      [
        {
          objectId: objectId,
          properties: [
            { id: Bacnet.enum.PropertyIdentifier.OBJECT_NAME },
            { id: Bacnet.enum.PropertyIdentifier.PRESENT_VALUE },
            { id: Bacnet.enum.PropertyIdentifier.DESCRIPTION }
          ]
        }
      ],
      (err, result) => {
        if (err) return reject(err);

        const values = result.values[0].values;

        const data = {
          type: objectId.type,
          instance: objectId.instance,
          name: values.find(v => v.id === Bacnet.enum.PropertyIdentifier.OBJECT_NAME)?.value,
          value: values.find(v => v.id === Bacnet.enum.PropertyIdentifier.PRESENT_VALUE)?.value,
          description: values.find(v => v.id === Bacnet.enum.PropertyIdentifier.DESCRIPTION)?.value
        };

        resolve(data);
      }
    );
  });
}

module.exports = { scanObjects };
