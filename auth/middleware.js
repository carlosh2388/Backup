const jwt = require("jsonwebtoken");
const pool = require("./db");

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isDbValidationSkipped() {
  return String(process.env.JWT_SKIP_DB_VALIDATION ?? "false").toLowerCase() === "true";
}

function rejectUnauthorized(req, res, message) {
  console.warn(`[AUTH 401] ${req.method} ${req.originalUrl}: ${message}`);
  return res.status(401).json({ error: message });
}

async function verifyJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return rejectUnauthorized(req, res, "Token requerido");
    }

    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    const user = {
      id: payload.id,
      username: payload.username,
      role: normalizeRole(payload.role),
      userType: payload.userType,
      tokenVersion: payload.tokenVersion
    };

    if (!user.id || !user.role) {
      return rejectUnauthorized(req, res, "Token invalido");
    }

    if (!isDbValidationSkipped()) {
      const result = await pool.query(
        `SELECT id, username, role, user_type, token_version
         FROM mi_basedatos.public.api_users_mqtt
         WHERE id = $1`,
        [user.id]
      );

      if (result.rowCount === 0) {
        return rejectUnauthorized(req, res, "Usuario no encontrado");
      }

      const dbUser = result.rows[0];
      if (String(dbUser.user_type || "").toLowerCase() !== "app") {
        return rejectUnauthorized(req, res, "Usuario no autorizado");
      }

      if (Number(dbUser.token_version) !== Number(user.tokenVersion || 0)) {
        return rejectUnauthorized(req, res, "Sesion expirada");
      }

      user.username = dbUser.username;
      user.role = normalizeRole(dbUser.role);
      user.userType = dbUser.user_type;
      user.tokenVersion = dbUser.token_version;
    }

    req.user = user;
    next();
  } catch (err) {
    return rejectUnauthorized(req, res, "Token invalido");
  }
}

function requireRole(role) {
  const expectedRole = normalizeRole(role);
  return (req, res, next) => {
    if (!req.user || normalizeRole(req.user.role) !== expectedRole) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}

function requireAnyRole(roles) {
  const allowedRoles = (roles || []).map(normalizeRole);
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    if (!req.user || !userRole) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    next();
  };
}

module.exports = {
  verifyJWT,
  requireRole,
  requireAnyRole
};
