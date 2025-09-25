(() => {
  // ---------- Helpers ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const CART_KEY = 'brenda_cart';
  const USERS_KEY = 'brenda_users'; // usado por auth.js también

  const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const saveCart = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const formatCLP = (n) => n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  const updateCartBadge = () => {
    const cart = getCart();
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const badge = $('#cartCount');
    if (badge) badge.textContent = count;
  };

  // ---------- Añadir al carrito ----------
  const handleAddToCart = (e) => {
    const btn = e.target.closest('.btn-add-to-cart');
    if (!btn) return;

    const sku = btn.dataset.sku;
    const name = btn.dataset.name;
    const price = parseInt(btn.dataset.price, 10);

    let cart = getCart();
    const existing = cart.find((i) => i.sku === sku);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ sku, name, price, qty: 1 });
    }
    saveCart(cart);
    updateCartBadge();

    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    btn.textContent = 'Añadido ✓';
    setTimeout(() => {
      btn.classList.remove('btn-success');
      btn.classList.add('btn-primary');
      btn.textContent = 'Añadir al carrito';
    }, 1500);
  };

  // ---------- Búsqueda simple en tarjetas ----------
  const initSearch = () => {
    const form = $('#searchForm');
    const input = $('#searchInput');
    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      const cards = $$('#featuredProducts .card');
      cards.forEach(card => {
        const title = $('.card-title', card)?.textContent.toLowerCase() || '';
        const text = $('.card-text', card)?.textContent.toLowerCase() || '';
        const hit = title.includes(q) || text.includes(q);
        card.parentElement.style.display = (q === '' || hit) ? '' : 'none';
      });
    });
  };

  // ---------- Init (en todas las páginas) ----------
  document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', handleAddToCart);
    initSearch();
    updateCartBadge();
  });
})();
