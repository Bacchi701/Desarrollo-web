(() => {
  const BASE_API = ''; // mismo origen
  const $ = (s, c = document) => c.querySelector(s);

  const fetchJSON = (url, opts = {}) =>
    fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts })
      .then(r => r.json().then(j => (r.ok ? j : Promise.reject(j))));

  function enableValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach((form) => {
      form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) { event.preventDefault(); event.stopPropagation(); }
        form.classList.add('was-validated');
      }, false);
    });
  }

  function toast(msg) { alert(msg); }

  // Estado sesión en navbar (opcional: podrías cambiar "Mi Cuenta")
  async function refreshSessionUI() {
    try {
      const { user } = await fetchJSON(`${BASE_API}/api/auth/me`, { method: 'GET' });
      const accountLink = document.querySelector('a.nav-link[href="login.html"]');
      if (!accountLink) return;
      if (user) {
        accountLink.textContent = `Hola, ${user.nombre}`;
        accountLink.href = '#';
        accountLink.onclick = async (e) => {
          e.preventDefault();
          if (confirm('¿Deseas cerrar sesión?')) {
            await fetchJSON(`${BASE_API}/api/auth/logout`, { method: 'POST' });
            location.reload();
          }
        };
      } else {
        accountLink.textContent = 'Mi Cuenta';
        accountLink.href = 'login.html';
        accountLink.onclick = null;
      }
    } catch {}
  }

  // Registro
  function initRegister() {
    const form = $('#registerForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!form.checkValidity()) return;

      const email = $('#regEmail').value.trim();
      const nombre = $('#regNombre').value.trim();
      const apellido = $('#regApellido').value.trim();
      const pass = $('#regPass').value;
      const pass2 = $('#regPass2').value;
      if (pass !== pass2) { toast('Las contraseñas no coinciden'); return; }

      try {
        await fetchJSON(`${BASE_API}/api/auth/register`, {
          method: 'POST',
          body: JSON.stringify({ email, nombre, apellido, password: pass })
        });
        toast('Cuenta creada. Sesión iniciada automáticamente.');
        location.href = 'index.html';
      } catch (err) {
        toast(err.error || 'Error al registrar');
      }
    });
  }

  // Login
  function initLogin() {
    const form = $('#loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!form.checkValidity()) return;

      const email = $('#loginEmail').value.trim();
      const password = $('#loginPass').value;
      try {
        await fetchJSON(`${BASE_API}/api/auth/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        toast('¡Bienvenido/a!');
        location.href = 'index.html';
      } catch (err) {
        toast(err.error || 'Error al ingresar');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    enableValidation();
    initRegister();
    initLogin();
    refreshSessionUI();
  });
})();
