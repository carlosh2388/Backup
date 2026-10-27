// mqtt.js
const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://192.168.70.6:1883");

const lastData = {};

client.on("connect", () => {
  console.log("📡 Conectado a MQTT");

  client.subscribe("application/+/device/+/event/up");
});

client.on("message", (topic, msg) => {

  try {

    const data = JSON.parse(msg.toString());

    const devEUI = data.deviceInfo.devEui;

    // 🔥 USAR OBJECT, NO BUFFER
    const obj = data.object;

    if (!obj) return;

    lastData[devEUI] = {
      AQ: obj.pm2_5 ?? 0,
      TEMP: obj.temperature ?? 0,
      CO2: obj.co2 ?? 0,
      HUM: obj.humidity ?? 0,
      ts: Date.now()
    };

    console.log("📥", devEUI, lastData[devEUI]);

  } catch (err) {
    console.error("❌ Error MQTT:", err.message);
  }

});

module.exports = { lastData };

