const db = require('../db');

const transaction = async (operation) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
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
