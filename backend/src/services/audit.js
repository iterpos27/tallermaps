const db = require('../db');

const getRequestIp = (req) => (
  req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || req.ip
  || req.socket?.remoteAddress
  || null
);

const logActivity = async ({ req, action, entityType, entityId, details = {}, client = db }) => {
  await client.query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      req.user?.id || null,
      action,
      entityType,
      entityId ? String(entityId) : null,
      JSON.stringify(details),
      getRequestIp(req)
    ]
  );
};

const safeLogActivity = async (data) => {
  try {
    await logActivity(data);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'audit_log_failed', message: error.message }));
  }
};

module.exports = { logActivity, safeLogActivity };
