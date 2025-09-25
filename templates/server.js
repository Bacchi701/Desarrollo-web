// server.js (CommonJS)
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(morgan('dev'));
app.use(express.json());

// CORS (NO necesario si sirves frontend desde este mismo server)
// Actívalo solo si el frontend corre en otro origen (ej: Netlify/Vercel o Live Server).
if (process.env.CORS_ORIGIN) {
    app.use(cors({
        origin: process.env.CORS_ORIGIN,
        methods: ['GET'],
    }));
    console.log('CORS habilitado para:', process.env.CORS_ORIGIN);
}

// Sirve archivos estáticos (HTML, CSS, JS, imágenes)
const ROOT = __dirname;
app.use('/Imagenes', express.static(path.join(ROOT, 'Imagenes'), { maxAge: '7d', immutable: true }));
app.use('/estilos', express.static(path.join(ROOT, 'estilos'), { maxAge: '7d' }));
app.use('/funcionalidades', express.static(path.join(ROOT, 'funcionalidades')));
app.use('/data', express.static(path.join(ROOT, 'data'))); // opcional (útil para probar)

// Carga de productos
let PRODUCTS = [];
const DATA_FILE = path.join(ROOT, 'data', 'productos.json');

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

// Utilidades
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
            // relevancia simple: primero nombre que contenga la query
            if (ql) {
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

// Rutas API
app.get('/api/health', (req, res) => {
    res.json({ ok: true, products: PRODUCTS.length, time: new Date().toISOString() });
});

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

// Sirve HTML (index y demás) desde la raíz
app.use(express.static(ROOT, { extensions: ['html'] }));

// Fallback: si piden una ruta sin extensión y no es /api, intenta devolver un HTML
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(ROOT, req.path));
});

// Arranque
loadProducts().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor listo en http://localhost:${PORT}`);
    });
});
