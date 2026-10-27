// bacnet.js
const Bacnet = require("bacstack");

// Crear servidor BACnet
const server = new Bacnet({
  port: 47808,          // Puerto BACnet estándar
  apduTimeout: 6000,
  broadcastAddress: "255.255.255.255",
  interface: "0.0.0.0"
});

// Dispositivo BACnet
const DEVICE_ID = 1001;
const VENDOR_ID = 999;

// Almacenamiento de objetos
const OBJECTS = {};

// Contador de instancias BACnet
let instance = 1;

// Registrar sensores como objetos BACnet
function registerDevice(devEUI) {
  if (!OBJECTS[devEUI]) {

    OBJECTS[devEUI] = {
      AQ: {
        type: Bacnet.enum.ObjectType.ANALOG_INPUT,
        instance: instance++,
        value: 0
      },
      TEMP: {
        type: Bacnet.enum.ObjectType.ANALOG_INPUT,
        instance: instance++,
        value: 0
      }
    };

    console.log("📌 Registrado BACnet:", devEUI, OBJECTS[devEUI]);
  }
}

/* ===============================
   RESPUESTA DISCOVERY (Who-Is)
================================*/

server.on("whoIs", (data) => {

  console.log("📡 Who-Is recibido desde:", data.address);

  server.iAmResponse(
    data.address,     // IP solicitante
    DEVICE_ID,
    Bacnet.enum.Segmentation.NO_SEGMENTATION,
    VENDOR_ID
  );
});


/* ===============================
   RESPUESTA A LECTURAS (ReadProperty)
================================*/

server.on("readProperty", (req) => {

  const { request, address, invokeId } = req;

  const objType = request.objectId.type;
  const objInstance = request.objectId.instance;
  const propId = request.property.id;

  let value = null;

  // Buscar valor
  for (const dev in OBJECTS) {

    for (const key in OBJECTS[dev]) {

      const obj = OBJECTS[dev][key];

      if (
        obj.type === objType &&
        obj.instance === objInstance
      ) {
        value = obj.value;
      }
    }
  }

  // Si no existe
  if (value === null) {

    return server.errorResponse(
      address,
      invokeId,
      Bacnet.enum.ConfirmedServiceChoice.READ_PROPERTY,
      Bacnet.enum.ErrorClass.OBJECT,
      Bacnet.enum.ErrorCode.UNKNOWN_OBJECT
    );
  }

  // Responder
  server.readPropertyResponse(
    address,
    invokeId,
    request.objectId,
    request.property,
    [
      {
        type: Bacnet.enum.ApplicationTags.REAL,
        value: value
      }
    ]
  );
});


/* ===============================
   ACTUALIZAR VALORES
================================*/

function updateValue(devEUI, field, value) {

  if (!OBJECTS[devEUI]) return;

  if (!OBJECTS[devEUI][field]) return;

  OBJECTS[devEUI][field].value = value;
}


module.exports = {
  server,
  registerDevice,
  updateValue,
  OBJECTS
};
