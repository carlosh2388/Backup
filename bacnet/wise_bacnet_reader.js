const Bacnet = require('bacstack');

const WISE_IP = '192.168.70.6';   // IP del WISE (STRING)
const WISE_DEVICE_ID = 1001;        // Device ID REAL del WISE

const bacnet = new Bacnet({
  apduTimeout: 6000
});

// ⚠️ Objetos reales del WISE (ajusta según web/YABE)
const OBJECTS = [
  { type: Bacnet.enum.ObjectType.ANALOG_INPUT, instance: 0 },
  { type: Bacnet.enum.ObjectType.ANALOG_INPUT, instance: 1 },
  { type: Bacnet.enum.ObjectType.ANALOG_INPUT, instance: 2 }
];

function readObject(obj) {
  bacnet.readProperty(
    WISE_IP,                         // 🔴 SOLO STRING
    {
      type: obj.type,
      instance: obj.instance
    },
    Bacnet.enum.PropertyIdentifier.PRESENT_VALUE,
    (err, value) => {
      if (err) {
        console.error(
          `❌ Error ${obj.type}-${obj.instance}:`,
          err.message
        );
        return;
      }

      console.log('📊 Lectura BACnet:', {
        deviceId: WISE_DEVICE_ID,
        type: obj.type,
        instance: obj.instance,
        value: value.values[0].value,
        timestamp: new Date().toISOString()
      });
    }
  );
}

setInterval(() => {
  OBJECTS.forEach(readObject);
}, 5000);

console.log('🚀 BACnet polling iniciado...');


