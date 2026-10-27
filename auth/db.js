const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "admin123",
  database: process.env.DB_NAME || "mi_basedatos",
  max: 3,                     // BAJO Y CONTROLADO
idleTimeoutMillis: 10000,   // CIERRA IDLE RÁPIDO
connectionTimeoutMillis: 3000,
allowExitOnIdle: true
});

module.exports = pool;
