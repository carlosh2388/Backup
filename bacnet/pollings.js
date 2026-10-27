const { client, EBO_IP } = require("./bacnet_cliente");
const Bacnet = require("bacstack");

let cache = [];

// ===============================
// POLLING AUTOMÁTICO
// ===============================
function startPolling(objectList, interval = 5000) {
  setInterval(() => {
    objectList.forEach(obj => {
      client.readProperty(
        EBO_IP,
        obj.value,
        Bacnet.enum.PropertyIdentifier.PRESENT_VALUE,
        (err, value) => {
          if (err) return;

          cache.push({
            type: obj.value.type,
            instance: obj.value.instance,
            value: value.values[0].value,
            timestamp: new Date()
          });
        }
      );
    });

    // Evitar overflow
    if (cache.length > 1000) cache.splice(0, 500);

  }, interval);
}

function getCachedData() {
  return cache;
}

module.exports = {
  startPolling,
  getCachedData
};