const Bacnet = require("bacstack");
const { client } = require("./bacnet_cliente");

console.log("🚀 Buscando dispositivos BACnet...");

// Escuchamos I-Am
client.on("iAm", (device) => {
  console.log("📢 Dispositivo encontrado:");
  console.log("   IP:", device.address);
  console.log("   Device ID:", device.deviceId);
  console.log("   Max APDU:", device.maxApdu);
});

// Enviamos Who-Is broadcast
console.log("📡 Enviando Who-Is broadcast...");
client.whoIs();

// Cerramos después de 8 segundos
setTimeout(() => {
  console.log("🛑 Fin de búsqueda");
  client.close();
  process.exit(0);
}, 8000);


/*
const Bacnet = require("bacstack");

const client = new Bacnet({
  port: 47808,          // 👈 CRÍTICO
  apduTimeout: 6000
});

const EBO_IP = "10.30.39.172";
const DEVICE_ID = 3497261; // 👈 Device Instance del EBO (confírmalo)

client.readProperty(
  EBO_IP,
  { type: Bacnet.enum.ObjectType.DEVICE, instance: DEVICE_ID },
  Bacnet.enum.PropertyIdentifier.OBJECT_LIST,
  {},
  (err, value) => {
    if (err) {
      console.error("❌ Error BACnet:", err);
    } else {
      console.log("✔ EBO conectado");
      console.log("✔ BACnet OK, objetos:Nombre:", value.values.length);
    }
    client.close();
  }
);
*/




/*

const Bacnet = require("bacstack");

const client = new Bacnet();

client.on("iAm", device => {
  console.log("📟 EBO RESPONDIÓ");
  console.log("Device ID:", device.deviceId);
  console.log("Vendor ID:", device.vendorId);
  console.log("Address:", device.address);
});

console.log("🔍 Enviando Who-Is...");
client.whoIs(); // broadcast

setTimeout(() => {
  client.close();
  process.exit(0);
*/


/*
const Bacnet = require("bacstack");

const client = new Bacnet({
  apduTimeout: 6000
});

const EBO_IP = "10.30.39.172";
const DEVICE_ID = 1234; // 👈 Device ID real

client.readProperty(
  EBO_IP, // 👈 STRING, NO objeto
  { type: Bacnet.enum.ObjectType.DEVICE, instance: DEVICE_ID },
  Bacnet.enum.PropertyIdentifier.OBJECT_NAME,
  {}, // opciones OBLIGATORIAS
  (err, value) => {
    if (err) {
      console.error("❌ Error leyendo propiedad:", err);
    } else {
      console.log("✔ Nombre del dispositivo:", value.values[0].value);
    }
    client.close();
    process.exit(0);
  }
);
*/





