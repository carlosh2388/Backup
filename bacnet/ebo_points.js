const Bacnet = require("bacstack");
const { readProperty } = require("./bacnet_cliente");

// DEVICE ID BACNET DEL EBO (MUY IMPORTANTE)
const DEVICE_ID = 1234; // <-- AJUSTA AL TUYO

// MAPEO DE PUNTOS (EBO)
const POINTS = [
  {
    name: "Temp_Sala",
    type: Bacnet.enum.ObjectType.ANALOG_INPUT,
    instance: 1
  },
  {
    name: "Humedad_Sala",
    type: Bacnet.enum.ObjectType.ANALOG_INPUT,
    instance: 2
  },
  {
    name: "CO2_Sala",
    type: Bacnet.enum.ObjectType.ANALOG_INPUT,
    instance: 3
  }
];

async function readEBOPoints() {
  const data = [];

  for (const p of POINTS) {
    try {
      const value = await readProperty(
        DEVICE_ID,
        p.type,
        p.instance,
        Bacnet.enum.PropertyIdentifier.PRESENT_VALUE
      );

      data.push({
        pointId: p.name,
        value
      });
    } catch (err) {
      data.push({
        pointId: p.name,
        value: null,
        error: err.message
      });
    }
  }

  return {
    device: "EBO-BACnet",
    timestamp: new Date(),
    data
  };
}

module.exports = {
  readEBOPoints
};
