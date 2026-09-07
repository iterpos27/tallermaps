const db = require('../db');

const transaction = async (operation, actorId = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (actorId) await client.query("SELECT set_config('app.actor_id', $1, true)", [String(actorId)]);
    const result = await operation(client);
    try { await client.query('COMMIT'); }
    catch (error) { error.commitUncertain = true; throw error; }
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const rejectRequest = (status, message) => Object.assign(new Error(message), { status });
module.exports = { transaction, rejectRequest };
