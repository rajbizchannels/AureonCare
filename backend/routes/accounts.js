const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// All accounts routes require authentication
router.use(authenticate);

const toCamelCase = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const out = {};
  for (const key in obj) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
};

const toSnakeCase = (str) => str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// ─────────────────────────────────────────
// CHART OF ACCOUNTS
// ─────────────────────────────────────────

// GET /api/accounts
router.get('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { type, active, parent_id, search } = req.query;
    let query = `
      SELECT a.*,
        p.account_name AS parent_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_account_id = p.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (type) { params.push(type); query += ` AND a.account_type = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); query += ` AND a.is_active = $${params.length}`; }
    if (parent_id) { params.push(parent_id); query += ` AND a.parent_account_id = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (a.account_name ILIKE $${params.length} OR a.account_number ILIKE $${params.length})`; }
    query += ' ORDER BY a.account_number ASC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET /api/accounts/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT a.*,
        p.account_name AS parent_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM accounts a
      LEFT JOIN accounts p ON a.parent_account_id = p.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error fetching account:', err);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /api/accounts
router.post('/', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const {
      accountName, accountType, accountSubtype, parentAccountId,
      description, normalBalance, currency, openingBalance,
      linkedToAr, linkedToAp, linkedToBilling, linkedToClaims,
      tags, allowJournalEntries
    } = req.body;

    if (!accountName || !accountType || !normalBalance) {
      return res.status(400).json({ error: 'accountName, accountType, and normalBalance are required' });
    }
    const validTypes = ['asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_revenue'];
    if (!validTypes.includes(accountType)) {
      return res.status(400).json({ error: `accountType must be one of: ${validTypes.join(', ')}` });
    }
    if (!['debit','credit'].includes(normalBalance)) {
      return res.status(400).json({ error: 'normalBalance must be debit or credit' });
    }
    const accountNumber = (await pool.query('SELECT generate_account_number() AS num')).rows[0].num;
    const result = await pool.query(`
      INSERT INTO accounts (
        account_number, account_name, account_type, account_subtype,
        parent_account_id, description, normal_balance, currency,
        opening_balance, current_balance,
        linked_to_ar, linked_to_ap, linked_to_billing, linked_to_claims,
        tags, allow_journal_entries, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,$16)
      RETURNING *
    `, [
      accountNumber, accountName.trim(), accountType, accountSubtype || null,
      parentAccountId || null, description || null, normalBalance, currency || 'USD',
      openingBalance || 0,
      linkedToAr || false, linkedToAp || false, linkedToBilling || false, linkedToClaims || false,
      tags || [], allowJournalEntries !== false,
      req.user.id
    ]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating account:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Account number already exists' });
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT /api/accounts/:id
router.put('/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    if (existing.rows[0].is_system && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'System accounts can only be modified by admins' });
    }
    const fields = ['account_name','account_type','account_subtype','parent_account_id','description',
      'normal_balance','currency','is_active','linked_to_ar','linked_to_ap','linked_to_billing',
      'linked_to_claims','tags','allow_journal_entries'];
    const updates = []; const params = [];
    const body = req.body;
    const keyMap = { accountName:'account_name', accountType:'account_type', accountSubtype:'account_subtype',
      parentAccountId:'parent_account_id', normalBalance:'normal_balance', isActive:'is_active',
      linkedToAr:'linked_to_ar', linkedToAp:'linked_to_ap', linkedToBilling:'linked_to_billing',
      linkedToClaims:'linked_to_claims', allowJournalEntries:'allow_journal_entries' };
    for (const [camel, snake] of Object.entries(keyMap)) {
      if (body[camel] !== undefined) {
        params.push(body[camel]);
        updates.push(`${snake} = $${params.length}`);
      }
    }
    for (const f of ['description','currency','tags']) {
      if (body[f] !== undefined) { params.push(body[f]); updates.push(`${f} = $${params.length}`); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.user.id); updates.push(`updated_by = $${params.length}`);
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE accounts SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating account:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /api/accounts/:id (soft-delete via deactivation)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    if (existing.rows[0].is_system) return res.status(403).json({ error: 'System accounts cannot be deleted' });
    const hasBalance = existing.rows[0].current_balance !== '0.00' && existing.rows[0].current_balance !== 0;
    if (hasBalance) return res.status(409).json({ error: 'Cannot delete account with non-zero balance. Deactivate instead.' });
    await pool.query('UPDATE accounts SET is_active = FALSE, updated_by = $1 WHERE id = $2', [req.user.id, req.params.id]);
    res.json({ message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// GET /api/accounts/:id/transactions — ledger view
router.get('/:id/transactions', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { from, to, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT jl.*, je.entry_number, je.entry_date, je.description AS entry_description,
        je.status AS entry_status, je.reference_type, je.reference_number
      FROM account_journal_lines jl
      JOIN account_journal_entries je ON jl.journal_entry_id = je.id
      WHERE jl.account_id = $1 AND je.status = 'posted'
    `;
    const params = [req.params.id];
    if (from) { params.push(from); query += ` AND je.entry_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND je.entry_date <= $${params.length}`; }
    query += ` ORDER BY je.entry_date DESC, jl.line_number ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ─────────────────────────────────────────
// JOURNAL ENTRIES
// ─────────────────────────────────────────

router.get('/journal/entries', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, type, from, to, search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT je.*,
        u.first_name || ' ' || u.last_name AS created_by_name,
        pu.first_name || ' ' || pu.last_name AS posted_by_name
      FROM account_journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      LEFT JOIN users pu ON je.posted_by = pu.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND je.status = $${params.length}`; }
    if (type) { params.push(type); query += ` AND je.entry_type = $${params.length}`; }
    if (from) { params.push(from); query += ` AND je.entry_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND je.entry_date <= $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (je.entry_number ILIKE $${params.length} OR je.description ILIKE $${params.length})`; }
    query += ` ORDER BY je.entry_date DESC, je.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching journal entries:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

router.get('/journal/entries/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const jeResult = await pool.query(`
      SELECT je.*, u.first_name || ' ' || u.last_name AS created_by_name
      FROM account_journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      WHERE je.id = $1
    `, [req.params.id]);
    if (jeResult.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
    const linesResult = await pool.query(`
      SELECT jl.*, a.account_name, a.account_number, a.account_type
      FROM account_journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = $1
      ORDER BY jl.line_number
    `, [req.params.id]);
    const entry = toCamelCase(jeResult.rows[0]);
    entry.lines = linesResult.rows.map(toCamelCase);
    res.json(entry);
  } catch (err) {
    console.error('Error fetching journal entry:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

router.post('/journal/entries', authorize('admin', 'billing_manager'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const { entryDate, description, entryType, referenceType, referenceId, referenceNumber,
      notes, isRecurring, recurringFrequency, nextRecurrence, lines } = req.body;

    if (!entryDate || !description || !lines || lines.length < 2) {
      return res.status(400).json({ error: 'entryDate, description, and at least 2 lines are required' });
    }
    // Validate double-entry balance
    let totalDebit = 0; let totalCredit = 0;
    for (const line of lines) {
      if (!line.accountId || !line.entryType || !line.amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Each line requires accountId, entryType (debit|credit), and amount' });
      }
      if (line.entryType === 'debit') totalDebit += parseFloat(line.amount);
      else totalCredit += parseFloat(line.amount);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Journal entry must balance. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}` });
    }

    const entryNumber = (await client.query('SELECT generate_je_number() AS num')).rows[0].num;
    const jeResult = await client.query(`
      INSERT INTO account_journal_entries (
        entry_number, entry_date, status, entry_type, description,
        reference_type, reference_id, reference_number,
        total_debit, total_credit, notes,
        is_recurring, recurring_frequency, next_recurrence, created_by, updated_by
      ) VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
      RETURNING *
    `, [entryNumber, entryDate, entryType || 'manual', description.trim(),
        referenceType || null, referenceId || null, referenceNumber || null,
        totalDebit, totalCredit, notes || null,
        isRecurring || false, recurringFrequency || null, nextRecurrence || null,
        req.user.id]);

    const jeId = jeResult.rows[0].id;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await client.query(`
        INSERT INTO account_journal_lines (journal_entry_id, account_id, line_number, entry_type, amount, description, patient_id, provider_id, department, cost_center)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [jeId, l.accountId, i + 1, l.entryType, parseFloat(l.amount),
          l.description || null, l.patientId || null, l.providerId || null, l.department || null, l.costCenter || null]);
    }

    await client.query('COMMIT');
    const entry = toCamelCase(jeResult.rows[0]);
    entry.lines = lines;
    res.status(201).json(entry);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating journal entry:', err);
    res.status(500).json({ error: 'Failed to create journal entry' });
  } finally {
    client.release();
  }
});

// POST /api/accounts/journal/entries/:id/post
router.post('/journal/entries/:id/post', authorize('admin', 'billing_manager'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const je = await client.query('SELECT * FROM account_journal_entries WHERE id = $1', [req.params.id]);
    if (je.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
    if (je.rows[0].status !== 'draft') return res.status(409).json({ error: 'Only draft entries can be posted' });

    // Update account balances
    const lines = await client.query('SELECT * FROM account_journal_lines WHERE journal_entry_id = $1', [req.params.id]);
    for (const line of lines.rows) {
      const acct = await client.query('SELECT * FROM accounts WHERE id = $1', [line.account_id]);
      const { normal_balance } = acct.rows[0];
      let delta = 0;
      if ((normal_balance === 'debit' && line.entry_type === 'debit') ||
          (normal_balance === 'credit' && line.entry_type === 'credit')) {
        delta = parseFloat(line.amount);
      } else {
        delta = -parseFloat(line.amount);
      }
      await client.query('UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2', [delta, line.account_id]);
    }

    const result = await client.query(
      `UPDATE account_journal_entries SET status='posted', post_date=CURRENT_DATE, posted_by=$1, updated_by=$1 WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error posting journal entry:', err);
    res.status(500).json({ error: 'Failed to post journal entry' });
  } finally {
    client.release();
  }
});

// POST /api/accounts/journal/entries/:id/void
router.post('/journal/entries/:id/void', authorize('admin'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const je = await client.query('SELECT * FROM account_journal_entries WHERE id = $1', [req.params.id]);
    if (je.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
    if (!['draft','posted'].includes(je.rows[0].status)) return res.status(409).json({ error: 'Cannot void this entry' });

    // Reverse account balance changes if it was posted
    if (je.rows[0].status === 'posted') {
      const lines = await client.query('SELECT * FROM account_journal_lines WHERE journal_entry_id = $1', [req.params.id]);
      for (const line of lines.rows) {
        const acct = await client.query('SELECT * FROM accounts WHERE id = $1', [line.account_id]);
        const { normal_balance } = acct.rows[0];
        let delta = 0;
        if ((normal_balance === 'debit' && line.entry_type === 'debit') ||
            (normal_balance === 'credit' && line.entry_type === 'credit')) {
          delta = -parseFloat(line.amount);
        } else {
          delta = parseFloat(line.amount);
        }
        await client.query('UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2', [delta, line.account_id]);
      }
    }

    const result = await client.query(
      `UPDATE account_journal_entries SET status='voided', voided_by=$1, updated_by=$1 WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error voiding journal entry:', err);
    res.status(500).json({ error: 'Failed to void journal entry' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// ACCOUNTS RECEIVABLE
// ─────────────────────────────────────────

router.get('/receivables', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, type, aging_bucket, patient_id, payer_id, from, to, search, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT ar.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        ip.payer_name,
        a.account_name, a.account_number,
        bi.invoice_number
      FROM account_receivables ar
      LEFT JOIN patients p ON ar.patient_id = p.id
      LEFT JOIN insurance_payers ip ON ar.payer_id = ip.id
      LEFT JOIN accounts a ON ar.account_id = a.id
      LEFT JOIN billing_invoices bi ON ar.invoice_id = bi.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND ar.status = $${params.length}`; }
    if (type) { params.push(type); query += ` AND ar.ar_type = $${params.length}`; }
    if (aging_bucket) { params.push(aging_bucket); query += ` AND ar.aging_bucket = $${params.length}`; }
    if (patient_id) { params.push(patient_id); query += ` AND ar.patient_id = $${params.length}`; }
    if (payer_id) { params.push(payer_id); query += ` AND ar.payer_id = $${params.length}`; }
    if (from) { params.push(from); query += ` AND ar.due_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND ar.due_date <= $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (ar.ar_number ILIKE $${params.length} OR p.first_name ILIKE $${params.length} OR p.last_name ILIKE $${params.length})`; }
    query += ` ORDER BY ar.due_date ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching receivables:', err);
    res.status(500).json({ error: 'Failed to fetch receivables' });
  }
});

router.post('/receivables', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { arType, patientId, payerId, accountId, invoiceId, claimId,
      originalAmount, dueDate, serviceDate, notes } = req.body;
    if (!arType || !originalAmount || !dueDate) {
      return res.status(400).json({ error: 'arType, originalAmount, and dueDate are required' });
    }
    const arNumber = (await pool.query('SELECT generate_ar_number() AS num')).rows[0].num;
    const result = await pool.query(`
      INSERT INTO account_receivables (ar_number, ar_type, patient_id, payer_id, account_id, invoice_id, claim_id,
        original_amount, due_date, service_date, notes, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *
    `, [arNumber, arType, patientId || null, payerId || null, accountId || null, invoiceId || null, claimId || null,
        originalAmount, dueDate, serviceDate || null, notes || null, req.user.id]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating AR:', err);
    res.status(500).json({ error: 'Failed to create accounts receivable record' });
  }
});

router.put('/receivables/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, paidAmount, adjustedAmount, writtenOffAmount, agingBucket, agingDays,
      collectionStage, lastContactDate, notes } = req.body;
    const result = await pool.query(`
      UPDATE account_receivables SET
        status = COALESCE($1, status),
        paid_amount = COALESCE($2, paid_amount),
        adjusted_amount = COALESCE($3, adjusted_amount),
        written_off_amount = COALESCE($4, written_off_amount),
        aging_bucket = COALESCE($5, aging_bucket),
        aging_days = COALESCE($6, aging_days),
        collection_stage = COALESCE($7, collection_stage),
        last_contact_date = COALESCE($8, last_contact_date),
        last_payment_date = CASE WHEN $2 IS NOT NULL AND $2 > paid_amount THEN CURRENT_DATE ELSE last_payment_date END,
        notes = COALESCE($9, notes),
        updated_by = $10
      WHERE id = $11 RETURNING *
    `, [status || null, paidAmount !== undefined ? paidAmount : null,
        adjustedAmount !== undefined ? adjustedAmount : null,
        writtenOffAmount !== undefined ? writtenOffAmount : null,
        agingBucket || null, agingDays !== undefined ? agingDays : null,
        collectionStage || null, lastContactDate || null,
        notes || null, req.user.id, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'AR record not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating AR:', err);
    res.status(500).json({ error: 'Failed to update accounts receivable record' });
  }
});

// ─────────────────────────────────────────
// ACCOUNTS PAYABLE
// ─────────────────────────────────────────

router.get('/payables', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, type, from, to, search, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT ap.*,
        a.account_name, a.account_number,
        u.first_name || ' ' || u.last_name AS approved_by_name
      FROM account_payables ap
      LEFT JOIN accounts a ON ap.account_id = a.id
      LEFT JOIN users u ON ap.approved_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND ap.status = $${params.length}`; }
    if (type) { params.push(type); query += ` AND ap.ap_type = $${params.length}`; }
    if (from) { params.push(from); query += ` AND ap.due_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND ap.due_date <= $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (ap.ap_number ILIKE $${params.length} OR ap.vendor_name ILIKE $${params.length})`; }
    query += ` ORDER BY ap.due_date ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching payables:', err);
    res.status(500).json({ error: 'Failed to fetch payables' });
  }
});

router.post('/payables', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { apType, vendorName, vendorReference, accountId, invoiceAmount,
      invoiceDate, dueDate, expenseCategory, department, notes } = req.body;
    if (!apType || !vendorName || !invoiceAmount || !invoiceDate || !dueDate) {
      return res.status(400).json({ error: 'apType, vendorName, invoiceAmount, invoiceDate, and dueDate are required' });
    }
    const apNumber = (await pool.query('SELECT generate_ap_number() AS num')).rows[0].num;
    const result = await pool.query(`
      INSERT INTO account_payables (ap_number, ap_type, vendor_name, vendor_reference, account_id,
        invoice_amount, invoice_date, due_date, expense_category, department, notes, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *
    `, [apNumber, apType, vendorName.trim(), vendorReference || null, accountId || null,
        invoiceAmount, invoiceDate, dueDate, expenseCategory || null, department || null, notes || null, req.user.id]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating AP:', err);
    res.status(500).json({ error: 'Failed to create accounts payable record' });
  }
});

router.put('/payables/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, paidAmount, discountAmount, paymentMethod, paymentReference,
      bankAccount, paymentDate, notes } = req.body;
    let approvedBy = null;
    if (status === 'approved') approvedBy = req.user.id;
    const result = await pool.query(`
      UPDATE account_payables SET
        status = COALESCE($1, status),
        paid_amount = COALESCE($2, paid_amount),
        discount_amount = COALESCE($3, discount_amount),
        payment_method = COALESCE($4, payment_method),
        payment_reference = COALESCE($5, payment_reference),
        bank_account = COALESCE($6, bank_account),
        payment_date = COALESCE($7, payment_date),
        notes = COALESCE($8, notes),
        approved_by = COALESCE($9, approved_by),
        updated_by = $10
      WHERE id = $11 RETURNING *
    `, [status || null, paidAmount !== undefined ? paidAmount : null,
        discountAmount !== undefined ? discountAmount : null,
        paymentMethod || null, paymentReference || null, bankAccount || null,
        paymentDate || null, notes || null, approvedBy, req.user.id, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'AP record not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating AP:', err);
    res.status(500).json({ error: 'Failed to update accounts payable record' });
  }
});

// ─────────────────────────────────────────
// RECONCILIATIONS
// ─────────────────────────────────────────

router.get('/reconciliations', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, account_id } = req.query;
    let query = `
      SELECT r.*, a.account_name, a.account_number,
        u.first_name || ' ' || u.last_name AS created_by_name,
        cu.first_name || ' ' || cu.last_name AS completed_by_name
      FROM account_reconciliations r
      JOIN accounts a ON r.account_id = a.id
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN users cu ON r.completed_by = cu.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND r.status = $${params.length}`; }
    if (account_id) { params.push(account_id); query += ` AND r.account_id = $${params.length}`; }
    query += ' ORDER BY r.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching reconciliations:', err);
    res.status(500).json({ error: 'Failed to fetch reconciliations' });
  }
});

router.post('/reconciliations', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { accountId, reconciliationType, periodStart, periodEnd, statementBalance, notes } = req.body;
    if (!accountId || !reconciliationType || !periodStart || !periodEnd || statementBalance === undefined) {
      return res.status(400).json({ error: 'accountId, reconciliationType, periodStart, periodEnd, and statementBalance are required' });
    }
    const recNumber = (await pool.query('SELECT generate_rec_number() AS num')).rows[0].num;
    // Calculate system balance from posted journal entries
    const sysBalance = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END), 0) AS bal
      FROM account_journal_lines jl
      JOIN account_journal_entries je ON jl.journal_entry_id = je.id
      WHERE jl.account_id = $1 AND je.status = 'posted'
        AND je.entry_date BETWEEN $2 AND $3
    `, [accountId, periodStart, periodEnd]);
    const systemBalance = parseFloat(sysBalance.rows[0].bal);
    const result = await pool.query(`
      INSERT INTO account_reconciliations (reconciliation_number, account_id, reconciliation_type,
        period_start, period_end, statement_balance, system_balance, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [recNumber, accountId, reconciliationType, periodStart, periodEnd, statementBalance, systemBalance, notes || null, req.user.id]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating reconciliation:', err);
    res.status(500).json({ error: 'Failed to create reconciliation' });
  }
});

router.put('/reconciliations/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, clearedBalance, outstandingDeposits, outstandingChecks, notes } = req.body;
    let completedAt = null; let completedBy = null;
    if (status === 'completed' || status === 'discrepancy') {
      completedAt = new Date().toISOString();
      completedBy = req.user.id;
    }
    const result = await pool.query(`
      UPDATE account_reconciliations SET
        status = COALESCE($1, status),
        cleared_balance = COALESCE($2, cleared_balance),
        outstanding_deposits = COALESCE($3, outstanding_deposits),
        outstanding_checks = COALESCE($4, outstanding_checks),
        notes = COALESCE($5, notes),
        completed_at = COALESCE($6, completed_at),
        completed_by = COALESCE($7, completed_by)
      WHERE id = $8 RETURNING *
    `, [status || null, clearedBalance !== undefined ? clearedBalance : null,
        outstandingDeposits !== undefined ? outstandingDeposits : null,
        outstandingChecks !== undefined ? outstandingChecks : null,
        notes || null, completedAt, completedBy, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reconciliation not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating reconciliation:', err);
    res.status(500).json({ error: 'Failed to update reconciliation' });
  }
});

// ─────────────────────────────────────────
// STATEMENTS
// ─────────────────────────────────────────

router.get('/statements', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, type, patient_id, payer_id } = req.query;
    let query = `
      SELECT s.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        ip.payer_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM account_statements s
      LEFT JOIN patients p ON s.patient_id = p.id
      LEFT JOIN insurance_payers ip ON s.payer_id = ip.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    if (type) { params.push(type); query += ` AND s.statement_type = $${params.length}`; }
    if (patient_id) { params.push(patient_id); query += ` AND s.patient_id = $${params.length}`; }
    if (payer_id) { params.push(payer_id); query += ` AND s.payer_id = $${params.length}`; }
    query += ' ORDER BY s.statement_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching statements:', err);
    res.status(500).json({ error: 'Failed to fetch statements' });
  }
});

router.post('/statements', authorize('admin', 'billing_manager', 'receptionist'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const { statementType, patientId, payerId, recipientName, recipientEmail,
      statementDate, periodStart, periodEnd, dueDate,
      previousBalance, charges, payments, adjustments, notes, items } = req.body;
    if (!statementType || !statementDate || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'statementType, statementDate, periodStart, and periodEnd are required' });
    }
    const stmNumber = (await client.query('SELECT generate_stm_number() AS num')).rows[0].num;
    const stmResult = await client.query(`
      INSERT INTO account_statements (statement_number, statement_type, patient_id, payer_id,
        recipient_name, recipient_email, statement_date, period_start, period_end, due_date,
        previous_balance, charges, payments, adjustments, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [stmNumber, statementType, patientId || null, payerId || null,
        recipientName || null, recipientEmail || null,
        statementDate, periodStart, periodEnd, dueDate || null,
        previousBalance || 0, charges || 0, payments || 0, adjustments || 0,
        notes || null, req.user.id]);
    const stmId = stmResult.rows[0].id;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO account_statement_items (statement_id, item_date, description, item_type,
            reference_type, reference_id, reference_number, amount, running_balance, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [stmId, item.itemDate, item.description, item.itemType,
            item.referenceType || null, item.referenceId || null, item.referenceNumber || null,
            item.amount, item.runningBalance || null, i]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json(toCamelCase(stmResult.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating statement:', err);
    res.status(500).json({ error: 'Failed to create statement' });
  } finally {
    client.release();
  }
});

router.put('/statements/:id/send', authorize('admin', 'billing_manager', 'receptionist'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(
      `UPDATE account_statements SET status='sent', sent_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Statement not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error sending statement:', err);
    res.status(500).json({ error: 'Failed to send statement' });
  }
});

// ─────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────

// Trial Balance
router.get('/reports/trial-balance', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { as_of_date } = req.query;
    const result = await pool.query(`
      SELECT a.account_number, a.account_name, a.account_type, a.normal_balance,
        a.current_balance,
        CASE WHEN a.normal_balance = 'debit'  THEN GREATEST(a.current_balance, 0) ELSE 0 END AS debit_balance,
        CASE WHEN a.normal_balance = 'credit' THEN GREATEST(a.current_balance, 0) ELSE 0 END AS credit_balance
      FROM accounts a
      WHERE a.is_active = TRUE
      ORDER BY a.account_number
    `);
    const rows = result.rows.map(toCamelCase);
    const totalDebit  = rows.reduce((s, r) => s + parseFloat(r.debitBalance  || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + parseFloat(r.creditBalance || 0), 0);
    res.json({ asOfDate: as_of_date || new Date().toISOString().split('T')[0], rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (err) {
    console.error('Error generating trial balance:', err);
    res.status(500).json({ error: 'Failed to generate trial balance' });
  }
});

// Income Statement (P&L)
router.get('/reports/income-statement', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { from = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], to = new Date().toISOString().split('T')[0] } = req.query;
    const result = await pool.query(`
      SELECT a.account_number, a.account_name, a.account_type, a.account_subtype, a.normal_balance,
        COALESCE(SUM(
          CASE WHEN jl.entry_type = 'credit' AND a.normal_balance = 'credit' THEN jl.amount
               WHEN jl.entry_type = 'debit'  AND a.normal_balance = 'debit'  THEN jl.amount
               WHEN jl.entry_type = 'debit'  AND a.normal_balance = 'credit' THEN -jl.amount
               WHEN jl.entry_type = 'credit' AND a.normal_balance = 'debit'  THEN -jl.amount
               ELSE 0 END), 0) AS period_amount
      FROM accounts a
      LEFT JOIN account_journal_lines jl ON jl.account_id = a.id
      LEFT JOIN account_journal_entries je ON je.id = jl.journal_entry_id
        AND je.status = 'posted'
        AND je.entry_date BETWEEN $1 AND $2
      WHERE a.account_type IN ('revenue','expense','contra_revenue')
        AND a.is_active = TRUE
      GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.account_subtype, a.normal_balance
      ORDER BY a.account_type DESC, a.account_number
    `, [from, to]);
    const rows = result.rows.map(toCamelCase);
    const revenue  = rows.filter(r => r.accountType === 'revenue').reduce((s, r) => s + parseFloat(r.periodAmount), 0);
    const contraRev = rows.filter(r => r.accountType === 'contra_revenue').reduce((s, r) => s + parseFloat(r.periodAmount), 0);
    const expenses = rows.filter(r => r.accountType === 'expense').reduce((s, r) => s + parseFloat(r.periodAmount), 0);
    const netRevenue = revenue - contraRev;
    const netIncome = netRevenue - expenses;
    res.json({ from, to, rows, revenue, contraRevenue: contraRev, netRevenue, expenses, netIncome });
  } catch (err) {
    console.error('Error generating income statement:', err);
    res.status(500).json({ error: 'Failed to generate income statement' });
  }
});

// Balance Sheet
router.get('/reports/balance-sheet', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT account_number, account_name, account_type, account_subtype, normal_balance, current_balance
      FROM accounts
      WHERE account_type IN ('asset','liability','equity','contra_asset','contra_liability')
        AND is_active = TRUE
      ORDER BY account_type, account_number
    `);
    const rows = result.rows.map(toCamelCase);
    const totalAssets = rows.filter(r => r.accountType === 'asset').reduce((s, r) => s + parseFloat(r.currentBalance || 0), 0);
    const contraAssets = rows.filter(r => r.accountType === 'contra_asset').reduce((s, r) => s + parseFloat(r.currentBalance || 0), 0);
    const totalLiabilities = rows.filter(r => r.accountType === 'liability').reduce((s, r) => s + parseFloat(r.currentBalance || 0), 0);
    const totalEquity = rows.filter(r => r.accountType === 'equity').reduce((s, r) => s + parseFloat(r.currentBalance || 0), 0);
    res.json({
      asOfDate: new Date().toISOString().split('T')[0], rows,
      totalAssets: totalAssets - contraAssets,
      totalLiabilities, totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs((totalAssets - contraAssets) - (totalLiabilities + totalEquity)) < 0.01
    });
  } catch (err) {
    console.error('Error generating balance sheet:', err);
    res.status(500).json({ error: 'Failed to generate balance sheet' });
  }
});

// AR Aging Report
router.get('/reports/ar-aging', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT ar.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        ip.payer_name,
        CURRENT_DATE - ar.due_date AS days_overdue
      FROM account_receivables ar
      LEFT JOIN patients p ON ar.patient_id = p.id
      LEFT JOIN insurance_payers ip ON ar.payer_id = ip.id
      WHERE ar.status NOT IN ('paid','written_off')
      ORDER BY ar.due_date ASC
    `);
    const rows = result.rows.map(r => ({ ...toCamelCase(r), daysOverdue: parseInt(r.days_overdue) || 0 }));

    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91_120: 0, days120Plus: 0 };
    const counts = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91_120: 0, days120Plus: 0 };
    rows.forEach(r => {
      const d = r.daysOverdue; const bal = parseFloat(r.balanceDue || 0);
      if (d <= 0) { buckets.current += bal; counts.current++; }
      else if (d <= 30) { buckets.days1_30 += bal; counts.days1_30++; }
      else if (d <= 60) { buckets.days31_60 += bal; counts.days31_60++; }
      else if (d <= 90) { buckets.days61_90 += bal; counts.days61_90++; }
      else if (d <= 120) { buckets.days91_120 += bal; counts.days91_120++; }
      else { buckets.days120Plus += bal; counts.days120Plus++; }
    });
    const totalAR = Object.values(buckets).reduce((s, v) => s + v, 0);
    res.json({ asOfDate: new Date().toISOString().split('T')[0], rows, buckets, counts, totalAR });
  } catch (err) {
    console.error('Error generating AR aging report:', err);
    res.status(500).json({ error: 'Failed to generate AR aging report' });
  }
});

// AP Aging Report
router.get('/reports/ap-aging', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT ap.*, CURRENT_DATE - ap.due_date AS days_overdue
      FROM account_payables ap
      WHERE ap.status NOT IN ('paid','voided')
      ORDER BY ap.due_date ASC
    `);
    const rows = result.rows.map(r => ({ ...toCamelCase(r), daysOverdue: parseInt(r.days_overdue) || 0 }));
    const totalAP = rows.reduce((s, r) => s + parseFloat(r.balanceDue || 0), 0);
    res.json({ asOfDate: new Date().toISOString().split('T')[0], rows, totalAP });
  } catch (err) {
    console.error('Error generating AP aging report:', err);
    res.status(500).json({ error: 'Failed to generate AP aging report' });
  }
});

// Snapshot AR Aging
router.post('/reports/ar-aging/snapshot', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { snapshotType = 'combined' } = req.body;
    const aging = await pool.query(`
      SELECT CURRENT_DATE - ar.due_date AS days_overdue, ar.balance_due
      FROM account_receivables ar
      WHERE ar.status NOT IN ('paid','written_off')
    `);
    let tot = 0, cur = 0, d1 = 0, d31 = 0, d61 = 0, d91 = 0, d121 = 0;
    let totC = 0, curC = 0, d1C = 0, d31C = 0, d61C = 0, d91C = 0, d121C = 0;
    for (const r of aging.rows) {
      const d = parseInt(r.days_overdue) || 0; const bal = parseFloat(r.balance_due) || 0;
      tot += bal; totC++;
      if (d <= 0) { cur += bal; curC++; }
      else if (d <= 30) { d1 += bal; d1C++; }
      else if (d <= 60) { d31 += bal; d31C++; }
      else if (d <= 90) { d61 += bal; d61C++; }
      else if (d <= 120) { d91 += bal; d91C++; }
      else { d121 += bal; d121C++; }
    }
    const result = await pool.query(`
      INSERT INTO account_ar_aging_snapshots (snapshot_date, snapshot_type,
        total_ar, current_amount, days_1_30, days_31_60, days_61_90, days_91_120, days_120_plus,
        total_accounts, current_count, days_1_30_count, days_31_60_count, days_61_90_count, days_91_120_count, days_120_plus_count,
        created_by)
      VALUES (CURRENT_DATE,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [snapshotType, tot, cur, d1, d31, d61, d91, d121, totC, curC, d1C, d31C, d61C, d91C, d121C, req.user.id]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating aging snapshot:', err);
    res.status(500).json({ error: 'Failed to create aging snapshot' });
  }
});

// Dashboard Stats
router.get('/reports/dashboard', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const [ar, ap, je, accts] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count, COALESCE(SUM(balance_due),0) AS total, COALESCE(SUM(CASE WHEN status='open' THEN balance_due END),0) AS open_ar FROM account_receivables WHERE status NOT IN ('paid','written_off')`),
      pool.query(`SELECT COUNT(*) AS count, COALESCE(SUM(balance_due),0) AS total FROM account_payables WHERE status NOT IN ('paid','voided')`),
      pool.query(`SELECT COUNT(*) AS count FROM account_journal_entries WHERE status='draft'`),
      pool.query(`SELECT COUNT(*) AS count FROM accounts WHERE is_active=TRUE`)
    ]);
    const cashAcct = await pool.query(`SELECT COALESCE(SUM(current_balance),0) AS cash FROM accounts WHERE account_subtype='current_asset' AND is_active=TRUE AND account_type='asset' AND account_number LIKE '1000%'`);
    res.json({
      totalAR: parseFloat(ar.rows[0].total),
      openAR: parseFloat(ar.rows[0].open_ar),
      arCount: parseInt(ar.rows[0].count),
      totalAP: parseFloat(ap.rows[0].total),
      apCount: parseInt(ap.rows[0].count),
      draftJournalEntries: parseInt(je.rows[0].count),
      activeAccounts: parseInt(accts.rows[0].count),
      cashBalance: parseFloat(cashAcct.rows[0].cash)
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ─────────────────────────────────────────
// RBAC — Account Role Permissions
// ─────────────────────────────────────────

router.get('/rbac/permissions', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT arp.*, u.first_name || ' ' || u.last_name AS updated_by_name
      FROM account_role_permissions arp
      LEFT JOIN users u ON arp.updated_by = u.id
      ORDER BY arp.role_name, arp.resource
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching RBAC permissions:', err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

router.put('/rbac/permissions', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { roleName, resource, canView, canCreate, canEdit, canDelete, canApprove, canExport } = req.body;
    if (!roleName || !resource) return res.status(400).json({ error: 'roleName and resource are required' });
    const result = await pool.query(`
      INSERT INTO account_role_permissions (role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (role_name, resource) DO UPDATE SET
        can_view=$3, can_create=$4, can_edit=$5, can_delete=$6, can_approve=$7, can_export=$8, updated_by=$9, updated_at=NOW()
      RETURNING *
    `, [roleName, resource, canView || false, canCreate || false, canEdit || false,
        canDelete || false, canApprove || false, canExport || false, req.user.id]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating RBAC permission:', err);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// ─────────────────────────────────────────
// BACKUP
// ─────────────────────────────────────────

router.get('/backup', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT b.*, u.first_name || ' ' || u.last_name AS created_by_name
      FROM account_backups b LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC LIMIT 50
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

router.post('/backup', authorize('admin'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const { backupType = 'full', periodStart, periodEnd } = req.body;
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const backupRecord = await client.query(`
      INSERT INTO account_backups (backup_type, status, period_start, period_end, started_at, created_by)
      VALUES ($1,'running',$2,$3,NOW(),$4) RETURNING *
    `, [backupType, periodStart || null, periodEnd || null, req.user.id]);
    const backupId = backupRecord.rows[0].id;

    // Gather data based on type
    let backupData = { generatedAt: new Date().toISOString(), backupType, generatedBy: req.user.id };
    if (backupType === 'full' || backupType === 'accounts') {
      const accts = await client.query('SELECT * FROM accounts ORDER BY account_number');
      backupData.accounts = accts.rows;
    }
    if (backupType === 'full' || backupType === 'journal') {
      const entries = await client.query('SELECT * FROM account_journal_entries ORDER BY entry_date');
      const lines = await client.query('SELECT * FROM account_journal_lines ORDER BY journal_entry_id, line_number');
      backupData.journalEntries = entries.rows;
      backupData.journalLines = lines.rows;
    }
    if (backupType === 'full' || backupType === 'ar') {
      const ar = await client.query('SELECT * FROM account_receivables ORDER BY created_at');
      backupData.accountsReceivable = ar.rows;
    }
    if (backupType === 'full' || backupType === 'ap') {
      const ap = await client.query('SELECT * FROM account_payables ORDER BY created_at');
      backupData.accountsPayable = ap.rows;
    }
    if (backupType === 'full' || backupType === 'reconciliation') {
      const rec = await client.query('SELECT * FROM account_reconciliations ORDER BY created_at');
      backupData.reconciliations = rec.rows;
    }
    if (backupType === 'full' || backupType === 'statements') {
      const stm = await client.query('SELECT * FROM account_statements ORDER BY created_at');
      backupData.statements = stm.rows;
    }

    const recordCount = Object.values(backupData).filter(Array.isArray).reduce((s, a) => s + a.length, 0);
    const dataStr = JSON.stringify(backupData, null, 2);
    const fileSizeBytes = Buffer.byteLength(dataStr, 'utf8');
    const fileName = `accounts_backup_${backupType}_${new Date().toISOString().split('T')[0]}_${backupId.slice(0,8)}.json`;

    await client.query(`
      UPDATE account_backups SET status='completed', file_name=$1, file_size_bytes=$2, record_count=$3, completed_at=NOW(),
        expires_at=NOW() + INTERVAL '90 days' WHERE id=$4
    `, [fileName, fileSizeBytes, recordCount, backupId]);
    await client.query('COMMIT');

    // Return backup data directly (in production, store to S3/GCS)
    res.status(201).json({
      ...toCamelCase(backupRecord.rows[0]),
      fileName, fileSizeBytes, recordCount,
      status: 'completed',
      data: backupData
    });
  } catch (err) {
    await client.query('ROLLBACK');
    await pool.query(`UPDATE account_backups SET status='failed', error_message=$1 WHERE id=$2`, [err.message, req.body._backupId]).catch(() => {});
    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// ARCHIVE
// ─────────────────────────────────────────

router.post('/archive', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { cutoffDate, archiveType = 'journal_entries' } = req.body;
    if (!cutoffDate) return res.status(400).json({ error: 'cutoffDate is required' });

    let archived = 0;
    if (archiveType === 'journal_entries') {
      const result = await pool.query(
        `UPDATE account_journal_entries SET status='voided' WHERE status='posted' AND entry_date < $1 AND status != 'voided' RETURNING id`,
        [cutoffDate]
      );
      archived = result.rowCount;
    } else if (archiveType === 'ar_paid') {
      const result = await pool.query(
        `UPDATE account_receivables SET status='written_off' WHERE status='paid' AND updated_at < $1 RETURNING id`,
        [cutoffDate]
      );
      archived = result.rowCount;
    }
    res.json({ message: `Archived ${archived} records`, archivedCount: archived, archiveType, cutoffDate });
  } catch (err) {
    console.error('Error archiving:', err);
    res.status(500).json({ error: 'Failed to archive records' });
  }
});

module.exports = router;
