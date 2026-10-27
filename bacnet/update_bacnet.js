// update.js

const {
  registerDevice,
  updateValue
} = require("./bacnet_server");

// Importar datos MQTT
const { lastData } = require("./mqtt");

console.log("🚀 Actualizador BACnet iniciado...");

setInterval(() => {

  for (const devEUI in lastData) {

    const values = lastData[devEUI];

    // Registrar dispositivo si no existe
    registerDevice(devEUI);

    // Actualizar valores BACnet
    if (values.AQ !== undefined) {
      updateValue(devEUI, "AQ", values.AQ);
    }

    if (values.TEMP !== undefined) {
      updateValue(devEUI, "TEMP", values.TEMP);
    }

  }

}, 2000); // cada 2 segundos
