import pool from './postgres.js';

export async function insertReminder(userId, task, remindAt, source) {
  const res = await pool.query(
    `INSERT INTO reminders ("userId", task, "remindAt", source)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, task, remindAt, source]
  );

  return res.rows[0];
}

export async function getDueReminders(userId) {
  const res = await pool.query(
    `UPDATE reminders
     SET status = 'delivered', "deliveredAt" = NOW()
     WHERE "userId" = $1
       AND status = 'pending'
       AND "remindAt" <= NOW()
     RETURNING *`,
    [userId]
  );

  return res.rows;
}
