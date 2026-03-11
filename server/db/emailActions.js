import pool from './postgres.js';

export async function insertEmailAction({
  userId,
  toEmail,
  subject,
  body,
  status,
  providerMessageId = null,
  threadId = null,
  source,
  scheduledFor = null,
  sentAt = null,
}) {
  const res = await pool.query(
    `INSERT INTO email_actions
      ("userId", "toEmail", subject, body, status, "providerMessageId", "threadId", source, "scheduledFor", "sentAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [userId, toEmail, subject, body, status, providerMessageId, threadId, source, scheduledFor, sentAt]
  );

  return res.rows[0];
}

export async function claimDueScheduledEmailActions(limit = 20) {
  const res = await pool.query(
    `WITH due AS (
      SELECT id
      FROM email_actions
      WHERE status = 'scheduled'
        AND "scheduledFor" IS NOT NULL
        AND "scheduledFor" <= CURRENT_TIMESTAMP
      ORDER BY "scheduledFor" ASC
      LIMIT $1
    )
    UPDATE email_actions AS actions
    SET status = 'sending',
        "updatedAt" = CURRENT_TIMESTAMP
    FROM due
    WHERE actions.id = due.id
    RETURNING actions.*`,
    [limit]
  );

  return res.rows;
}

export async function markEmailActionSent({ id, providerMessageId = null, threadId = null }) {
  const res = await pool.query(
    `UPDATE email_actions
     SET status = 'sent',
         "providerMessageId" = $2,
         "threadId" = $3,
         "sentAt" = CURRENT_TIMESTAMP,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, providerMessageId, threadId]
  );

  return res.rows[0] || null;
}

export async function markEmailActionFailed(id) {
  const res = await pool.query(
    `UPDATE email_actions
     SET status = 'failed',
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return res.rows[0] || null;
}
