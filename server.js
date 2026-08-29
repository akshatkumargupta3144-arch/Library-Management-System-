const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'supersecretkey_change_me_in_production';

app.use(express.json());
app.use(cors());

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./library.db', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database.');
});

// Create Database Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    isbn TEXT,
    status TEXT DEFAULT 'Available'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    member_id INTEGER,
    issue_date TEXT,
    returned INTEGER DEFAULT 0
  )`);
});

// --- AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(01).json({ message: 'Access Denied: No Token Provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
}

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'All fields required' });

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
    if (err) return res.status(400).json({ message: 'Username already exists' });
    res.json({ message: 'User registered successfully!' });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username });
  });
});

// --- PROTECTED LIBRARY API ROUTES ---
app.get('/api/books', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM books`, [], (err, rows) => res.json(rows || []));
});

app.post('/api/books', authenticateToken, (req, res) => {
  const { title, author, isbn } = req.body;
  db.run(`INSERT INTO books (title, author, isbn) VALUES (?, ?, ?)`, [title, author, isbn], function(err) {
    if (err) return res.status(500).json({ message: 'Failed to add book' });
    res.json({ id: this.lastID, title, author, isbn, status: 'Available' });
  });
});

app.delete('/api/books/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM books WHERE id = ?`, [req.params.id], (err) => res.json({ success: true }));
});

app.get('/api/members', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM members`, [], (err, rows) => res.json(rows || []));
});

app.post('/api/members', authenticateToken, (req, res) => {
  const { name, email } = req.body;
  db.run(`INSERT INTO members (name, email) VALUES (?, ?)`, [name, email], function(err) {
    if (err) return res.status(500).json({ message: 'Failed to add member' });
    res.json({ id: this.lastID, name, email });
  });
});

app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));