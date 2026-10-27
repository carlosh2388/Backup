const { scanEboPoints } = require("./ebo_device");

(async () => {
  console.log("🚀 Escaneando puntos Modbus desde EBO por BACnet (modo forzado)...");
  const points = await scanEboPoints();
  console.log("🎯 TOTAL:", points);
  console.log(points.slice(0, 10));
  process.exit(0);
})();

