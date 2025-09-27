(() => {
  const BASE_API = ''; // mismo servidor
  const API_LIST = `${BASE_API}/api/products`;
  const API_DETAIL = (sku) => `${BASE_API}/api/products/${encodeURIComponent(sku)}`;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const formatCLP = (n) => Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  // Estado de lista
  let state = {
    limit: 6,
    offset: 0,
    total: 0,
    items: [],
    search: '',
    cat: '',
    sort: ''
  };

  function buildParams() {
    const u = new URL(API_LIST, location.origin);
    const { limit, offset, search, cat, sort } = state;
    u.searchParams.set('limit', String(limit));
    u.searchParams.set('offset', String(offset));
    if (search) u.searchParams.set('search', search);
    if (cat) u.searchParams.set('cat', cat);
    if (sort) u.searchParams.set('sort', sort);
    return u.toString();
  }

  async function fetchProductos() {
    const res = await fetch(buildParams());
    if (!res.ok) throw new Error('Error al cargar productos');
    const data = await res.json(); // { total, items, limit, offset }
    state.total = data.total;
    state.items = data.items;
  }

  async function fetchProductoBySku(sku) {
    const res = await fetch(API_DETAIL(sku));
    if (!res.ok) throw new Error('Producto no encontrado');
    return res.json();
  }

  function cardProducto(p) {
    return `
      <div class="col">
        <div class="card h-100">
          <img src="${p.imagen}" class="card-img-top" alt="${p.nombre}" loading="lazy">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${p.nombre}</h5>
            <div class="text-muted small mb-2">${p.categoria}</div>
            <p class="card-text flex-grow-1">${p.descripcion}</p>
            <div class="d-flex align-items-center justify-content-between">
              <strong>${formatCLP(p.precio)}</strong>
              <div class="btn-group">
                <a href="producto.html?sku=${encodeURIComponent(p.sku)}" class="btn btn-outline-secondary">Ver detalle</a>
                <button class="btn btn-primary btn-add-to-cart"
                        data-sku="${p.sku}"
                        data-name="${p.nombre}"
                        data-price="${p.precio}">
                  Añadir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderPaginator() {
    const ul = $('#paginacion');
    if (!ul) return;
    const { limit, offset, total } = state;
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));

    const mkLi = (label, disabled, active, dataOffset) => `
      <li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
        <a class="page-link" href="#" data-offset="${disabled ? '' : dataOffset}">${label}</a>
      </li>`;

    let html = '';
    html += mkLi('«', page === 1, false, 0);
    for (let i = 1; i <= pages; i++) {
      const off = (i - 1) * limit;
      html += mkLi(String(i), false, i === page, off);
    }
    html += mkLi('»', page === pages, false, (pages - 1) * limit);

    ul.innerHTML = html;

    ul.addEventListener('click', (e) => {
      const a = e.target.closest('a.page-link');
      if (!a) return;
      e.preventDefault();
      const off = a.getAttribute('data-offset');
      if (off === '' || off == null) return;
      state.offset = parseInt(off, 10);
      applyAndRender();
    }, { once: true });
  }

  function renderLista() {
    const grid = $('#listaProductos');
    const vacio = $('#estadoVacio');
    const contador = $('#contadorResultados');
    if (!grid) return;

    const items = state.items;
    if (items.length === 0) {
      grid.innerHTML = '';
      vacio?.classList.remove('d-none');
      contador && (contador.textContent = '0 resultados');
      $('#paginacion') && ($('#paginacion').innerHTML = '');
      return;
    }

    vacio?.classList.add('d-none');
    grid.innerHTML = items.map(cardProducto).join('');
    contador && (contador.textContent = `${state.total} producto${state.total === 1 ? '' : 's'}`);
    renderPaginator();
  }

  async function applyAndRender() {
    await fetchProductos();
    renderLista();
  }

  async function initLista() {
    // rellenar categorías desde la primera carga
    state.limit = 6;
    state.offset = 0;

    // filtros UI → estado
    const mapOrd = {
      'precio-asc': 'precio-asc',
      'precio-desc': 'precio-desc',
      'nombre-asc': 'nombre-asc',
      'nombre-desc': 'nombre-desc',
      'relevancia': ''
    };

    $('#searchForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      state.search = ($('#searchInput')?.value || '').trim();
      state.offset = 0;
      applyAndRender();
    });

    $('#ordenar')?.addEventListener('change', (e) => {
      state.sort = mapOrd[e.target.value] || '';
      state.offset = 0;
      applyAndRender();
    });

    // Hash de categoría
    if (location.hash.startsWith('#cat=')) {
      const cat = decodeURIComponent(location.hash.split('=')[1] || '');
      const sel = $('#filtroCategoria'); if (sel) sel.value = cat;
      state.cat = cat;
    }
    $('#filtroCategoria')?.addEventListener('change', (e) => {
      state.cat = e.target.value || '';
      state.offset = 0;
      applyAndRender();
    });

    await applyAndRender();

    // Cargar categorías para el select (desde los items cargados)
    const selectCat = $('#filtroCategoria');
    if (selectCat && selectCat.children.length <= 1) {
      const cats = [...new Set(state.items.map(p => p.categoria))].sort((a,b)=>a.localeCompare(b));
      selectCat.innerHTML = `<option value="">Todas</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      if (state.cat) selectCat.value = state.cat;
    }
  }

  // -------- Detalle + variantes --------
  function variantStock(p, talla) {
    if (Array.isArray(p.variantes)) {
      const v = p.variantes.find(v => v.talla === talla);
      return v ? Number(v.stock) : 0;
    }
    return Number(p.stock || 0);
  }

  function renderDetalle(p) {
    $('#breadcrumbActual') && ($('#breadcrumbActual').textContent = p.nombre);
    const wrap = $('#detalleProducto');
    if (!wrap) return;

    const tallas = Array.isArray(p.variantes) ? p.variantes.map(v => v.talla) : (p.tallas || []);
    wrap.innerHTML = `
      <div class="col-12 col-lg-6">
        <div class="border rounded p-2">
          <img src="${p.imagen}" class="img-fluid" alt="${p.nombre}">
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <h1 class="h3">${p.nombre}</h1>
        <div class="text-muted mb-2">${p.categoria}</div>
        <p>${p.descripcion}</p>
        <p class="fs-4 fw-bold">${formatCLP(p.precio)}</p>

        <div class="row g-3 mb-3">
          <div class="col-12 col-sm-6">
            <label for="selectTalla" class="form-label">Talla</label>
            <select id="selectTalla" class="form-select">
              ${tallas.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="col-12 col-sm-6">
            <label for="qtyInput" class="form-label">Cantidad</label>
            <div class="input-group">
              <button class="btn btn-outline-secondary" type="button" id="qtyMinus">-</button>
              <input id="qtyInput" class="form-control text-center" type="number" min="1" value="1">
              <button class="btn btn-outline-secondary" type="button" id="qtyPlus">+</button>
            </div>
            <div class="form-text"><span id="stockInfo"></span></div>
          </div>
        </div>

        <div class="d-grid d-sm-flex gap-2">
          <button id="btnAddDetail" class="btn btn-primary btn-add-to-cart"
                  data-sku="${p.sku}" data-name="${p.nombre}" data-price="${p.precio}">
            Añadir al carrito
          </button>
          <a class="btn btn-outline-secondary" href="productos.html">Volver a productos</a>
        </div>
      </div>
    `;

    const qtyInput = $('#qtyInput');
    $('#qtyMinus')?.addEventListener('click', () => qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1));
    $('#qtyPlus')?.addEventListener('click', () => qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1));

    const btn = $('#btnAddDetail');
    const stockInfo = $('#stockInfo');
    const selectTalla = $('#selectTalla');

    const updateBtnData = () => {
      const talla = selectTalla?.value || '';
      const stock = variantStock(p, talla);
      stockInfo.textContent = `Stock disponible: ${stock}`;
      btn.dataset.size = talla;
      btn.dataset.qtyEl = '#qtyInput';
      btn.dataset.sizeEl = '#selectTalla';
      btn.dataset.maxStock = String(stock);
      btn.disabled = stock <= 0;
    };

    updateBtnData();
    selectTalla?.addEventListener('change', updateBtnData);
  }

  async function initDetalle() {
    const wrap = $('#detalleProducto');
    if (!wrap) return;
    try {
      const params = new URLSearchParams(location.search);
      const sku = params.get('sku')?.trim();
      if (!sku) throw new Error('SKU ausente');
      const p = await fetchProductoBySku(sku);
      renderDetalle(p);

      // relacionados (misma categoría)
      try {
        const url = new URL(API_LIST, location.origin);
        url.searchParams.set('cat', p.categoria);
        url.searchParams.set('limit', '6');
        const res = await fetch(url.toString());
        const data = await res.json();
        const relacionados = data.items.filter(x => x.sku !== p.sku).slice(0, 3);
        const contRel = $('#relacionados');
        contRel.innerHTML = relacionados.length
          ? relacionados.map(item => `
              <div class="col">
                <div class="card h-100">
                  <img src="${item.imagen}" class="card-img-top" alt="${item.nombre}">
                  <div class="card-body">
                    <h5 class="card-title">${item.nombre}</h5>
                    <div class="d-flex justify-content-between align-items-center">
                      <strong>${formatCLP(item.precio)}</strong>
                      <a class="btn btn-sm btn-outline-secondary" href="producto.html?sku=${encodeURIComponent(item.sku)}">Ver</a>
                    </div>
                  </div>
                </div>
              </div>`).join('')
          : `<div class="col"><div class="alert alert-light">No hay productos relacionados.</div></div>`;
      } catch {}
    } catch (err) {
      console.error(err);
      wrap.innerHTML = `<div class="col"><div class="alert alert-danger">Error cargando el detalle.</div></div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if ($('#listaProductos')) initLista();
    if ($('#detalleProducto')) initDetalle();
  });
})();