(() => {
  // Si frontend y API están en el MISMO origen: deja BASE_API = ''.
  // Si los separas (opción B), pon por ej.: const BASE_API = 'http://localhost:3000';
  const BASE_API = '';
  const API_LIST = `${BASE_API}/api/products`;
  const API_DETAIL = (sku) => `${BASE_API}/api/products/${encodeURIComponent(sku)}`;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const formatCLP = (n) => Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  let productos = [];
  let filtrados = [];

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

  async function fetchProductos(params = {}) {
    const url = new URL(API_LIST, location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Error al cargar productos');
    const data = await res.json();
    return data; // { total, items, limit, offset }
  }

  async function fetchProductoBySku(sku) {
    const res = await fetch(API_DETAIL(sku));
    if (!res.ok) throw new Error('Producto no encontrado');
    return res.json();
  }

  function getCategoriasLocal(list) {
    return [...new Set(list.map(p => p.categoria))].sort((a, b) => a.localeCompare(b));
  }

  function renderLista() {
    const grid = $('#listaProductos');
    const vacio = $('#estadoVacio');
    const contador = $('#contadorResultados');
    if (!grid) return;

    if (filtrados.length === 0) {
      grid.innerHTML = '';
      vacio?.classList.remove('d-none');
      if (contador) contador.textContent = '0 resultados';
      return;
    }

    vacio?.classList.add('d-none');
    grid.innerHTML = filtrados.map(cardProducto).join('');
    if (contador) contador.textContent = `${filtrados.length} resultado${filtrados.length === 1 ? '' : 's'}`;
  }

  async function aplicarFiltrosRemotos() {
    const q = ($('#searchInput')?.value || '').trim();
    const cat = $('#filtroCategoria')?.value || '';
    const ord = $('#ordenar')?.value || '';

    const mapOrd = {
      'precio-asc': 'precio-asc',
      'precio-desc': 'precio-desc',
      'nombre-asc': 'nombre-asc',
      'nombre-desc': 'nombre-desc',
      'relevancia': '' // por defecto
    };

    const params = {
      search: q || undefined,
      cat: cat || undefined,
      sort: mapOrd[ord] || undefined,
      limit: 100
    };

    const { items } = await fetchProductos(params);
    filtrados = items;
    renderLista();
  }

  async function initLista() {
    try {
      // Carga inicial (sin filtros) para llenar categorías
      const { items } = await fetchProductos({ limit: 100 });
      productos = items;
      filtrados = items;

      // Llenar select de categorías
      const selectCat = $('#filtroCategoria');
      if (selectCat && selectCat.children.length <= 1) {
        const cats = getCategoriasLocal(productos);
        selectCat.innerHTML = `<option value="">Todas</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      }

      // Hash de categoría (#cat=Poleras)
      if (location.hash.startsWith('#cat=')) {
        const catHash = decodeURIComponent(location.hash.split('=')[1] || '');
        if (selectCat) selectCat.value = catHash;
      }

      // Eventos
      $('#searchForm')?.addEventListener('submit', (e) => { e.preventDefault(); aplicarFiltrosRemotos(); });
      $('#ordenar')?.addEventListener('change', aplicarFiltrosRemotos);
      $('#filtroCategoria')?.addEventListener('change', aplicarFiltrosRemotos);

      renderLista();
      // Aplica filtros remotos si hay hash o query de inicio
      if (location.hash.startsWith('#cat=')) await aplicarFiltrosRemotos();
    } catch (err) {
      console.error(err);
      $('#estadoVacio')?.classList.remove('d-none');
      if ($('#estadoVacio')) $('#estadoVacio').textContent = 'Error cargando productos.';
    }
  }

  async function initDetalle() {
    const wrap = $('#detalleProducto');
    if (!wrap) return;

    try {
      const params = new URLSearchParams(location.search);
      const sku = params.get('sku')?.trim();
      if (!sku) throw new Error('SKU ausente');

      const p = await fetchProductoBySku(sku);

      // Render detalle (idéntico al que hicimos antes)
      const formatCLP = (n) => Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
      $('#breadcrumbActual') && ($('#breadcrumbActual').textContent = p.nombre);
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
                ${(p.tallas || []).map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="col-12 col-sm-6">
              <label for="qtyInput" class="form-label">Cantidad</label>
              <div class="input-group">
                <button class="btn btn-outline-secondary" type="button" id="qtyMinus">-</button>
                <input id="qtyInput" class="form-control text-center" type="number" min="1" value="1">
                <button class="btn btn-outline-secondary" type="button" id="qtyPlus">+</button>
              </div>
            </div>
          </div>

          <div class="d-grid d-sm-flex gap-2">
            <button id="btnAddDetail" class="btn btn-primary btn-add-to-cart"
                    data-sku="${p.sku}" data-name="${p.nombre}" data-price="${p.precio}">
              Añadir al carrito
            </button>
            <a class="btn btn-outline-secondary" href="productos.html">Volver a productos</a>
          </div>
          <small class="text-muted d-block mt-2">Stock disponible: ${p.stock}</small>
        </div>
      `;

      // Qty
      const qtyInput = $('#qtyInput');
      $('#qtyMinus')?.addEventListener('click', () => {
        qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
      });
      $('#qtyPlus')?.addEventListener('click', () => {
        qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
      });

      // Vincula talla/cantidad al botón para app.js
      const btn = $('#btnAddDetail');
      const updateBtnData = () => {
        btn.dataset.size = $('#selectTalla')?.value || '';
        btn.dataset.qtyEl = '#qtyInput';
        btn.dataset.sizeEl = '#selectTalla';
      };
      updateBtnData();
      $('#selectTalla')?.addEventListener('change', updateBtnData);

      // Relacionados
      // (Cargamos 100 productos y filtramos localmente por categoría)
      try {
        const { items } = await fetchProductos({ limit: 100, cat: p.categoria });
        const relacionados = items.filter(x => x.sku !== p.sku).slice(0, 3);
        const contRel = $('#relacionados');
        contRel.innerHTML = relacionados.length
          ? relacionados.map(cardProducto).join('')
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
