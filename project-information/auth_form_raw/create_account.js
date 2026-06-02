require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Config ----------
const PORT = Number(process.env.REGISTER_PORT) || 3000;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

// Accepts either a raw ID or a full Google Sheets/Drive URL
function parseSpreadsheetId(input) {
  if (!input) return null;
  // Match the ID in URLs like:
  // https://docs.google.com/spreadsheets/d/<ID>/edit?...
  // https://drive.google.com/file/d/<ID>/view?...
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Fallback: treat the whole string as a raw ID
  return input.trim() || null;
}

const SPREADSHEET_ID = parseSpreadsheetId(process.env.SPREADSHEET_LINK);

if (SPREADSHEET_ID) {
  console.log('Spreadsheet ID resolved:', SPREADSHEET_ID);
} else {
  console.warn('SPREADSHEET_ID not set — sheet logging disabled.');
}

// ---------- Postgres pool ----------
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------- Google Sheets client (optional) ----------
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

  // Always log the service account email — you must share the sheet with this address
  console.log('Service account email:', credentials.client_email);
  console.log('>>> Share your Google Sheet with the above email as Editor <<<');

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });

  // Verify sheet access immediately at startup — fail fast with a clear message
  if (SPREADSHEET_ID) {
    try {
      await sheetsClient.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      console.log('Sheet access verified OK:', SPREADSHEET_ID);
    } catch (err) {
      const hint = err.code === 403
        ? `\n  → Share the sheet with: ${credentials.client_email}`
        : '';
      console.error(`Sheet access check failed (code ${err.code}): ${err.message}${hint}`);
      // Don't exit — registration still works, sheet logging will just be skipped
      sheetsClient = null;
    }
  }
}

async function appendSheet(spreadsheetId, values) {
  if (!sheetsClient) throw new Error('Sheets client not initialized');
  return sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: 'Registrations!A1',          
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',  // Always append a new row, never overwrite
    requestBody: { values: [values] }
  });
}

// ---------- Helpers ----------
function validateRegistration({ username, password, email, phone }) {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return 'username must be at least 3 characters';
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return 'password must be at least 6 characters';
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'invalid email format';
  }
    // ANY country code — +CountryCode-Number
  if (phone && !/^\+[1-9]\d{0,2}-\d{7,12}$/.test(phone)) {
    return 'Invalid Phone Number — use format +91-9876543210 or +1-2025550100 like +CountryCode-Number';
  }
  return null;
}

// ---------- Routes ----------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/register', async (req, res) => {
  const { username, password, full_name, email, phone } = req.body;

  // FIX: trim username consistently before validate/store/query
  const cleanUsername = typeof username === 'string' ? username.trim() : username;

  const vErr = validateRegistration({ username: cleanUsername, password, email, phone });
  if (vErr) return res.status(400).json({ error: vErr });

  try {
    // FIX: use rows.length — rowCount can be null for SELECT in some pg versions
    const exists = await pool.query(
      'SELECT 1 FROM arthasync.users WHERE username=$1',
      [cleanUsername]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const q = `
      INSERT INTO arthasync.users (username, password_hash, full_name, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at, last_login
    `;
    const r = await pool.query(q, [
      cleanUsername,
      hash,
      full_name || null,
      email     || null,
      phone     || null
    ]);
    const user = r.rows[0];
    let phoneSheet = `\"${phone}\"`;
    if (SPREADSHEET_ID && sheetsClient) {
      const row = [
        user.id,
        cleanUsername,
        full_name || '',
        email     || '',
        phoneSheet || '',                                   
        user.created_at ? user.created_at.toISOString() : '',
        user.last_login  ? user.last_login.toISOString()  : 'never'
      ];
      appendSheet(SPREADSHEET_ID, row).catch(err =>
        console.error('Failed to append to Google Sheet:', err.message)
      );
    }
    return res.status(201).json({ id: user.id });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.get('/login_account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login_account.html'));
});

// ---------- Start ----------
async function start() {
  try { await initSheets(); }
  catch (err) { console.warn('initSheets failed (continuing):', err && err.message); }

  const server = app.listen(PORT, () =>
    console.log(`Server listening on http://localhost:${PORT}`)
  );

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use.`);
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