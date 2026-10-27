const express = require("express");
const {
  getWiseJson,
  formatWiseDiPayload,
  WISE_BASE_URL,
  WISE_TIMEOUT_MS,
  WISE_USERNAME,
  WISE_DEVICE_ID,
  WISE_GROUP_TYPE
} = require("./lectura_wise");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "wise",
    baseUrl: WISE_BASE_URL,
    timeoutMs: WISE_TIMEOUT_MS,
    authConfigured: Boolean(WISE_USERNAME),
    username: WISE_USERNAME || null,
    deviceId: WISE_DEVICE_ID,
    groupType: WISE_GROUP_TYPE
  });
});

router.get("/concentradores", async (req, res) => {
  try {
    const data = await getWiseJson("/di_value/slot_0/");
    res.json(formatWiseDiPayload(data));
  } catch (error) {
    const networkErrorCodes = new Set([
      "ECONNABORTED",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ENOTFOUND",
      "ETIMEDOUT"
    ]);
    const upstreamStatus = Number(error.response?.status);
    const statusCode =
      Number.isInteger(upstreamStatus) && upstreamStatus >= 400
        ? upstreamStatus
        : networkErrorCodes.has(String(error.code || "").toUpperCase())
          ? 503
          : 500;
    const publicMessageByStatus = {
      401: "No autorizado",
      403: "Acceso denegado",
      404: "Recurso no encontrado",
      500: "Error interno del servidor",
      503: "Servicio WISE no disponible",
      504: "Tiempo de espera agotado"
    };
    const publicMessage = publicMessageByStatus[statusCode] || "Error interno del servidor";

    console.error("Error consultando WISE DI:", error.message);
    res.status(statusCode).json({ message: publicMessage });
  }
});

module.exports = router;
