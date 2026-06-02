require('dotenv').config();
const express = require('express');
const { Pool }  = require('pg');
const bcrypt    = require('bcrypt');
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Config ----------
const PORT = Number(process.env.LOGIN_PORT) || 3001;

function parseSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return input.trim() || null;
}

const SPREADSHEET_ID = parseSpreadsheetId(process.env.SPREADSHEET_LINK);

if (SPREADSHEET_ID) {
  console.log('Spreadsheet ID resolved:', SPREADSHEET_ID);
} else {
  console.warn('SPREADSHEET_ID not set — sheet update on login disabled.');
}

// ---------- Postgres pool ----------
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------- Google Sheets client ----------
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];
let sheetsClient = null;

async function initSheets() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let credentials = null;

  if (keyFile && fs.existsSync(keyFile)) {
    credentials = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  } else if (keyJson) {
    try { credentials = JSON.parse(keyJson); }
    catch (err) { console.warn('Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', err.message); }
  }

  if (!credentials) {
    console.warn('Google Sheets not initialized (no keyFile or JSON).');
    return;
  }

  console.log('Service account email:', credentials.client_email);

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  sheetsClient = google.sheets({ version: 'v4', auth: await auth.getClient() });

  if (SPREADSHEET_ID) {
    try {
      await sheetsClient.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      console.log('Sheet access verified OK:', SPREADSHEET_ID);
    } catch (err) {
      const hint = err.code === 403
        ? `\n  → Share the sheet with: ${credentials.client_email}`
        : '';
      console.error(`Sheet access check failed (code ${err.code}): ${err.message}${hint}`);
      sheetsClient = null;
    }
  }
}

// ---------- Sheet: update last_login in column G by matching UUID in column A ----------
async function updateSheetLastLogin(userId, lastLoginISO) {
  if (!sheetsClient || !SPREADSHEET_ID) return;
  try {
    const getRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registrations!A:A'
    });

    const rows = getRes.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === String(userId));

    if (rowIndex === -1) {
      console.warn(`Sheet update skipped: user ID ${userId} not found in column A.`);
      return;
    }

    const sheetRow = rowIndex + 1; // Sheets rows are 1-indexed
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Registrations!G${sheetRow}`,   // column G = last_login
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[lastLoginISO]] }
    });

    console.log(`Sheet last_login updated — row ${sheetRow}, user ${userId}`);
  } catch (err) {
    console.error('Failed to update last_login in sheet:', err.message);
  }
}

// ---------- Routes ----------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/login_account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login_account.html'));
});

app.post('/login_account', async (req, res) => {
  const { identifier, password } = req.body;

  // Validate inputs
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    return res.status(400).json({ error: 'username or email is required' });
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'password is required' });
  }

  const cleanIdentifier = identifier.trim();

  try {
    // Look up by username OR email — both are CITEXT (case-insensitive)
    const result = await pool.query(
      `SELECT id, username, password_hash, full_name, email
         FROM arthasync.users
        WHERE username = $1 OR email = $1
        LIMIT 1`,
      [cleanIdentifier]
    );

    if (result.rows.length === 0) {
      // Deliberately vague — don't reveal whether the username/email exists
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const user = result.rows[0];

    // bcrypt.compare hashes the entered password and checks against stored hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    // Update last_login in database
    const updateRes = await pool.query(
      `UPDATE arthasync.users
          SET last_login = now()
        WHERE id = $1
        RETURNING last_login`,
      [user.id]
    );
    const lastLoginISO = updateRes.rows[0].last_login.toISOString();

    // Update last_login in spreadsheet — non-blocking, never fails the login
    updateSheetLastLogin(user.id, lastLoginISO).catch(err =>
      console.error('Sheet update error (non-fatal):', err.message)
    );

    return res.status(200).json({
      message:    'login successful',
      id:         user.id,
      username:   user.username,
      full_name:  user.full_name || '',
      last_login: lastLoginISO
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// ---------- Start ----------
async function start() {
  try { await initSheets(); }
  catch (err) { console.warn('initSheets failed (continuing):', err && err.message); }

  const server = app.listen(PORT, () =>
    console.log(`Login server listening on http://localhost:${PORT}`)
  );

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Set LOGIN_PORT in .env to a free port.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}

start();