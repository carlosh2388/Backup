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
const WISE_DI_PATH = "/di_value/slot_0/";
const WISE_SITES = [
  { slug: "consultorio-zacapa", name: "Consultorio de Zacapa", ip: "10.0.12.44" },
  { slug: "hospital-igss-coban-consulta-externa", name: "Hospital IGSS Coban (Consulta Externa)", ip: "10.0.13.44" },
  { slug: "consultorio-igss-jutiapa", name: "Consultorio IGSS, Jutiapa", ip: "10.0.14.44" },
  { slug: "consultorio-igss-jalapa", name: "Consultorio IGSS, Jalapa", ip: "10.0.15.44" },
  { slug: "hospital-cuilapa", name: "Hospital de Cuilapa", ip: "10.0.16.44" },
  { slug: "camip-pamplona", name: "CAMIP Pamplona", ip: "10.0.17.44" },
  { slug: "camip-2-barranquilla", name: "CAMIP 2 Barranquilla", ip: "10.0.18.44" },
  { slug: "unidad-periferica", name: "Unidad Periferica Zona Once", ip: "10.0.19.44" },
  { slug: "consultorio-solola", name: "Consultorio Solola", ip: "10.0.20.44" },
  { slug: "policlinica", name: "Policlinica", ip: "10.0.21.44" },
  { slug: "hospital-antigua", name: "Hospital Antigua Guatemala", ip: "10.0.22.44" },
  { slug: "unidad-periferica-zona-cinco", name: "Unidad Periferica Zona Cinco", ip: "10.0.23.44" },
  { slug: "hospital-juan-jose-arevalo", name: "Hospital General Dr. Juan Jose Arevalo", ip: "10.0.24.44" },
  { slug: "hospital-igss-coban", name: "Hospital IGSS Coban", ip: "10.0.25.44" },
  { slug: "consultorio-guastatoya", name: "Consultorio Guastatoya", ip: "10.0.26.44" },
  { slug: "consultorio-los-amates", name: "Consultorio Los Amates", ip: "10.0.27.44" },
  { slug: "camip-3-zunil", name: "CAMIP 3 Zunil", ip: "10.0.28.44" },
  { slug: "unidad-integral-san-pedro-carcha", name: "Unidad Integral San Pedro Carcha", ip: "10.0.29.44" },
  { slug: "direccion-tecnologia-servicio", name: "Direccion de Tecnologia y Servicio", ip: "10.0.30.44" },
  { slug: "direccion-desarrollo-gestion", name: "Direccion de Desarrollo y Gestion", ip: "10.0.31.44" },
  { slug: "chimaltenango", name: "Chimaltenango", ip: "10.0.32.44" },
  { slug: "anexo-villa-nueva", name: "Anexo Villa Nueva", ip: "10.0.33.44" },
  { slug: "cct-escuintla", name: "CCT ESCUINTLA", ip: "10.0.34.44" }
];

function createWiseErrorResponse(error) {
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
  return {
    statusCode,
    publicMessage: publicMessageByStatus[statusCode] || "Error interno del servidor"
  };
}

function createWiseSiteHandler(site) {
  return async (req, res) => {
    const baseUrl = `http://${site.ip}`;

    try {
      const data = await getWiseJson(WISE_DI_PATH, {
        baseUrl,
        cacheKeyPrefix: site.slug
      });
      res.json(formatWiseDiPayload(data, {
        id: WISE_DEVICE_ID,
        name: site.name,
        ip: site.ip,
        baseUrl,
        endpoint: `/api/wise/${site.slug}`
      }));
    } catch (error) {
      const { statusCode, publicMessage } = createWiseErrorResponse(error);
      console.error(`Error consultando WISE DI [${site.slug} - ${site.ip}]:`, error.message);
      res.status(statusCode).json({ message: publicMessage });
    }
  };
}

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "wise",
    baseUrl: WISE_BASE_URL,
    timeoutMs: WISE_TIMEOUT_MS,
    authConfigured: Boolean(WISE_USERNAME),
    username: WISE_USERNAME || null,
    deviceId: WISE_DEVICE_ID,
    groupType: WISE_GROUP_TYPE,
    sitesConfigured: WISE_SITES.length
  });
});

router.get("/catalogo", (req, res) => {
  res.json({
    ok: true,
    service: "wise",
    path: WISE_DI_PATH,
    sites: WISE_SITES.map(site => ({
      ...site,
      baseUrl: `http://${site.ip}`,
      endpoint: `/api/wise/${site.slug}`
    }))
  });
});

router.get("/concentradores", async (req, res) => {
  try {
    const data = await getWiseJson(WISE_DI_PATH);
    res.json(formatWiseDiPayload(data, {
      id: WISE_DEVICE_ID,
      name: "Concentradores",
      baseUrl: WISE_BASE_URL,
      endpoint: "/api/wise/concentradores"
    }));
  } catch (error) {
    const { statusCode, publicMessage } = createWiseErrorResponse(error);

    console.error("Error consultando WISE DI:", error.message);
    res.status(statusCode).json({ message: publicMessage });
  }
});

WISE_SITES.forEach(site => {
  router.get(`/${site.slug}`, createWiseSiteHandler(site));
});

module.exports = router;
