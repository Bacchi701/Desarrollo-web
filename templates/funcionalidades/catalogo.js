(() => {
  const DATA_URL = 'data/productos.json';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const formatCLP = (n) => Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  let productos = [];
  let filtrados = [];

  async function cargarProductos() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('No se pudo cargar el catálogo. Asegúrate de usar un servidor local (no file://)');
    const data = await res.json();
    productos = data.productos || [];
  }

  function getCategorias() {
    return [...new Set(productos.map(p => p.categoria))].sort((a, b) => a.localeCompare(b));
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

  function renderLista() {
    const grid = $('#listaProductos');
    const vacio = $('#estadoVacio');
    const contador = $('#contadorResultados');

    if (!grid) return;

    if (filtrados.length === 0) {
      grid.innerHTML = '';
      vacio?.classList.remove('d-none');
      contador && (contador.textContent = '0 resultados');
      return;
    }

    vacio?.classList.add('d-none');
    grid.innerHTML = filtrados.map(cardProducto).join('');
    contador && (contador.textContent = `${filtrados.length} resultado${filtrados.length === 1 ? '' : 's'}`);
  }

  function aplicarFiltros() {
    const q = ($('#searchInput')?.value || '').toLowerCase().trim();
    const cat = $('#filtroCategoria')?.value || '';
    const ord = $('#ordenar')?.value || 'relevancia';

    filtrados = productos.filter(p => {
      const matchTexto = q === '' || (p.nombre + ' ' + p.descripcion).toLowerCase().includes(q);
      const matchCat = cat === '' || p.categoria === cat;
      return matchTexto && matchCat;
    });

    switch (ord) {
      case 'precio-asc':
        filtrados.sort((a, b) => a.precio - b.precio); break;
      case 'precio-desc':
        filtrados.sort((a, b) => b.precio - a.precio); break;
      case 'nombre-asc':
        filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
      case 'nombre-desc':
        filtrados.sort((a, b) => b.nombre.localeCompare(a.nombre)); break;
      default:
        // relevancia simple: primero los que hacen match en el nombre
        filtrados.sort((a, b) => {
          const ql = q.toLowerCase();
          const an = a.nombre.toLowerCase().includes(ql) ? 0 : 1;
          const bn = b.nombre.toLowerCase().includes(ql) ? 0 : 1;
          return an - bn;
        });
    }

    renderLista();
  }

  function initLista() {
    const selectCat = $('#filtroCategoria');

    // Rellenar categorías
    const cats = getCategorias();
    if (selectCat && selectCat.children.length <= 1) {
      selectCat.innerHTML = `<option value="">Todas</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Eventos
    $('#searchForm')?.addEventListener('submit', (e) => { e.preventDefault(); aplicarFiltros(); });
    $('#ordenar')?.addEventListener('change', aplicarFiltros);
    $('#filtroCategoria')?.addEventListener('change', aplicarFiltros);

    // Lee hash de categoría (ej: #cat=Poleras)
    if (location.hash.startsWith('#cat=')) {
      const catHash = decodeURIComponent(location.hash.split('=')[1] || '');
      if (selectCat) selectCat.value = catHash;
    }

    // Primera render
    aplicarFiltros();
  }

  function renderDetalle(p) {
    $('#breadcrumbActual') && ($('#breadcrumbActual').textContent = p.nombre);

    const wrap = $('#detalleProducto');
    if (!wrap) return;

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
              ${p.tallas.map(t => `<option value="${t}">${t}</option>`).join('')}
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

    // Manejo de qty
    const qtyInput = $('#qtyInput');
    $('#qtyMinus')?.addEventListener('click', () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
    });
    $('#qtyPlus')?.addEventListener('click', () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
    });

    // Actualiza dataset para que app.js lo lea
    const btn = $('#btnAddDetail');
    const updateBtnData = () => {
      btn.dataset.size = $('#selectTalla')?.value || '';
      btn.dataset.qtyEl = '#qtyInput';  // app.js leerá desde este input
      btn.dataset.sizeEl = '#selectTalla';
    };
    updateBtnData();
    $('#selectTalla')?.addEventListener('change', updateBtnData);
  }

  function renderRelacionados(p) {
    const cont = $('#relacionados');
    if (!cont) return;
    const rel = productos.filter(x => x.categoria === p.categoria && x.sku !== p.sku).slice(0, 3);
    if (rel.length === 0) {
      cont.innerHTML = `<div class="col"><div class="alert alert-light">No hay productos relacionados.</div></div>`;
      return;
    }
    cont.innerHTML = rel.map(cardProducto).join('');
  }

  async function initProductosPage() {
    await cargarProductos();
    // Mostrar skeleton simple si quieres aquí
    filtrados = [...productos];
    initLista();
  }

  async function initDetallePage() {
    await cargarProductos();
    const params = new URLSearchParams(location.search);
    const sku = params.get('sku')?.trim() || '';
    const p = productos.find(x => x.sku.toLowerCase() === sku.toLowerCase());
    const wrap = $('#detalleProducto');

    if (!p) {
      wrap.innerHTML = `<div class="col"><div class="alert alert-warning">Producto no encontrado.</div></div>`;
      return;
    }

    renderDetalle(p);
    renderRelacionados(p);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if ($('#listaProductos')) initProductosPage().catch(err => {
      console.error(err);
      $('#estadoVacio')?.classList.remove('d-none');
      $('#estadoVacio') && ($('#estadoVacio').textContent = 'Error cargando productos. ¿Abriste con Live Server?');
    });

    if ($('#detalleProducto')) initDetallePage().catch(err => {
      console.error(err);
      $('#detalleProducto').innerHTML = `<div class="col"><div class="alert alert-danger">Error cargando detalle.</div></div>`;
    });
  });
})();
