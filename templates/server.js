// server.js (CommonJS)
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');

const PRODUCTS_FILE = path.join(DATA_DIR, 'productos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_SECURE = false; // en producción pon true si usas https

// ---------- Middlewares ----------
// Después (DEV-friendly)
app.use(helmet({
    contentSecurityPolicy: false,           // no poner CSP en dev, rompe CDNs si no está fino
    crossOriginEmbedderPolicy: false,       // evita bloquear recursos de otros orígenes (CDN)
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' } // permite cargar desde CDN
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// CORS (solo si frontend corre aparte)
if (process.env.CORS_ORIGIN) {
    app.use(cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST'],
    }));
    console.log('CORS habilitado para:', process.env.CORS_ORIGIN);
}

// Sirve estáticos
app.use('/Imagenes', express.static(path.join(ROOT, 'Imagenes'), { maxAge: '7d', immutable: true }));
app.use('/estilos', express.static(path.join(ROOT, 'estilos'), { maxAge: '7d' }));
app.use('/funcionalidades', express.static(path.join(ROOT, 'funcionalidades')));
app.use('/data', express.static(path.join(ROOT, 'data'))); // útil en desarrollo

// ---------- BBDD en archivos ----------
let PRODUCTS = [];
let USERS = [];
let ORDERS = [];

async function ensureFile(file, init) {
    try { await fs.access(file); }
    catch { await fs.writeFile(file, JSON.stringify(init, null, 2), 'utf8')}
}

async function loadAll() {
    await ensureFile(USERS_FILE, { users: [] });
    await ensureFile(ORDERS_FILE, { orders: [] });

    const pRaw = await fs.readFile(PRODUCTS_FILE, 'utf8');
    const uRaw = await fs.readFile(USERS_FILE, 'utf8');
    const oRaw = await fs.readFile(ORDERS_FILE, 'utf8');

    const pJson = JSON.parse(pRaw);
    const uJson = JSON.parse(uRaw);
    const oJson = JSON.parse(oRaw);

    if(!Array.isArray(pJson.productos)) throw new Error('productos.json inválido');
    PRODUCTS = pJson.productos;
    USERS = Array.isArray(uJson.users) ? uJson.users : [];
    ORDERS = Array.isArray(oJson.orders) ? oJson.orders : [];

    console.log(`Productos: ${PRODUCTS.length}, Usuarios: ${USERS.length}, Órdenes: ${ORDERS.length}`);
}

async function loadProducts() {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        const json = JSON.parse(raw);
        if (!json || !Array.isArray(json.productos)) throw new Error('JSON inválido (falta "productos")');
        PRODUCTS = json.productos;
        console.log(`Catálogo cargado (${PRODUCTS.length} productos).`);
    } catch (err) {
        console.error('Error cargando productos.json:', err.message);
        PRODUCTS = [];
    }
}

async function writeProducts() {
    await fs.writeFile(PRODUCTS_FILE, JSON.stringify({ productos: PRODUCTS }, null, 2), 'utf8');
}
async function writeUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify({ users: USERS }, null, 2), 'utf8');
}
async function writeOrders() {
  await fs.writeFile(ORDERS_FILE, JSON.stringify({ orders: ORDERS }, null, 2), 'utf8');
}

// ---------- Utils ----------
function uniqueCategories(arr) {
    return [...new Set(arr.map(p => p.categoria))].sort((a, b) => a.localeCompare(b));
}

function filterSortPaginate({ items, q, cat, sort, limit, offset }) {
    const ql = q?.toLowerCase().trim() || '';
    let out = items.filter(p => {
        const textMatch = !ql || (p.nombre + ' ' + p.descripcion).toLowerCase().includes(ql);
        const catMatch = !cat || p.categoria === cat;
        return textMatch && catMatch;
    });

    switch (sort) {
        case 'precio-asc': out.sort((a, b) => a.precio - b.precio); break;
        case 'precio-desc': out.sort((a, b) => b.precio - a.precio); break;
        case 'nombre-asc': out.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
        case 'nombre-desc': out.sort((a, b) => b.nombre.localeCompare(a.nombre)); break;
        default:
            if(ql) {
                out.sort((a, b) => {
                    const an = a.nombre.toLowerCase().includes(ql) ? 0 : 1;
                    const bn = b.nombre.toLowerCase().includes(ql) ? 0 : 1;
                    return an - bn;
                });
            }
    }

    const total = out.length;
    const start = Math.max(0, parseInt(offset || 0, 10));
    const lim = Math.min(100, Math.max(1, parseInt(limit || 100, 10)));
    out = out.slice(start, start + lim);

    return { total, items: out, limit: lim, offset: start };
}

function getVariantStock(product, size) {
    if (Array.isArray(product.variantes)) {
        const v = product.variantes.find(v => v.talla === size);
        if (!v) throw new Error(`No existe variante talla ${size}`);
        if (v.stock < qty) throw new Error(`Stock insuficiente para ${product.sku} ${size}`);
        v.stock -= qty;
    } else {
        if (product.stock < qty) throw new Error(`Stock insuficiente para ${product.sku}`);
        product.stock -= qty;
    }
}

// ---------- Auth ----------
function signToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido'});
    }
}

// ---------- Rutas API ----------
app.get('/api/health', (req, res) => {
    res.json({ ok: true, products: PRODUCTS.length, time: new Date().toISOString() });
});

// Productos
app.get('/api/categories', (req, res) => {
    res.json({ categories: uniqueCategories(PRODUCTS) });
});

app.get('/api/products', (req, res) => {
    const { search, cat, sort, limit, offset } = req.query;
    const result = filterSortPaginate({
        items: PRODUCTS,
        q: search,
        cat,
        sort,
        limit,
        offset
    });
    res.json(result);
});

app.get('/api/products/:sku', (req, res) => {
    const sku = (req.params.sku || '').toLowerCase();
    const product = PRODUCTS.find(p => (p.sku || '').toLowerCase() === sku);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
});

// Auth
app.post('/api/auth/register', async (req, res) => {
    const { email, nombre, apellido, password } = req.body || {};
    if (!email || !password || !nombre || !apellido) return res.status(400).json({ error: 'Faltan campos' });

    const exists = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Correo ya registrado' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), email: email.toLowerCase(), nombre, apellido, passwordHash, createdAt: Date.now() };
    USERS.push(user);
    await writeUsers();

    const token = signToken(user);
    res.cookie('token', token, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido});
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const token = signToken(user);
    res.cookie('token', token, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 
    });
    res.json({ id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido });
});

app.get('/api/auth/me', (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.json({ user: null });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        res.json({ user: { id: payload.sub, email: payload.email, nombre: payload.nombre } });
    } catch {
        res.json({ user: null });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax' });
    res.json({ ok: true });
});

// Orders (checkout)
app.post('/api/orders', authMiddleware, async (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

    // Validar y calcular total
    let total = 0;
    const normalized = [];

    for (const it of items) {
        const sku = String(it.sku || '').trim();
        const size = it.size ? String(it.size) : null;
        const qty = Math.max(1, parseInt(it.qty || 1, 10));

        const product = PRODUCTS.find(p => (p.sku || '').toLowerCase() === sku.toLowerCase());
        if (!product) return res.status(400).json({ error: `Producto no existe: ${sku}` });

        // Stock
        const available = getVariantStock(product, size);
        if (qty > available) return res.status(400).json({ error: `Sin stock suficiente para ${product.nombre} ${size || ''}`.trim() });

        total += Number(product.precio) * qty;
        normalized.push({ sku: product.sku, size, qty, price: Number(product.precio) });
    }

    // Descontar stock
    try {
        for (const it of normalized) {
            const product = PRODUCTS.find(p => (p.sku || '').toLowerCase() === it.sku.toLowerCase());
            decrementStock(product, it.size, it.qty);
        }
        await writeProducts();
    } catch (err) {
        return res.status(400).json({ error: err.message});
    }

    const order = {
        id: uuidv4(),
        userId: req.user.sub,
        items: normalized,
        total,
        createdAt: Date.now(),
        status: 'paid' // mock
    };
    ORDERS.push(order);
    await writeOrders();

    res.status(201).json({ orderId: order.id, total, status: order.status });
});

// ---------- HTML estático ----------
app.use(express.static(ROOT, { extensions: ['html'] }));

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(ROOT, req.path));
});

// ---------- Start ----------
loadAll().then(() => {
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
});
