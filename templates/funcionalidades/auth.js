<!-- funcionalidades/auth.js -->
<script>
(() => {
  const USERS_KEY = 'brenda_users';
  const SESSION_KEY = 'brenda_session';

  const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const sha256 = async (text) => {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Bootstrap validation
  const enableValidation = () => {
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach((form) => {
      form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      }, false);
    });
  };

  const toast = (msg) => alert(msg); // simple; puedes reemplazar por Toast de Bootstrap

  // Registro
  const handleRegister = () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!form.checkValidity()) return;

      const email = document.getElementById('regEmail').value.trim().toLowerCase();
      const nombre = document.getElementById('regNombre').value.trim();
      const apellido = document.getElementById('regApellido').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;

      if (pass !== pass2) {
        document.getElementById('regPass2').setCustomValidity('No coincide');
        form.classList.add('was-validated');
        return;
      } else {
        document.getElementById('regPass2').setCustomValidity('');
      }

      const users = getUsers();
      if (users.some(u => u.email === email)) {
        toast('Ese correo ya está registrado.');
        return;
      }

      const passwordHash = await sha256(pass);
      users.push({ email, nombre, apellido, passwordHash, createdAt: Date.now() });
      saveUsers(users);
      toast('¡Cuenta creada! Ahora puedes iniciar sesión.');
      window.location.href = 'login.html';
    });
  };

  // Login
  const handleLogin = () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!form.checkValidity()) return;

      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const pass = document.getElementById('loginPass').value;
      const remember = document.getElementById('rememberMe')?.checked;

      const users = getUsers();
      const user = users.find(u => u.email === email);
      if (!user) return alert('Correo o contraseña incorrectos.');

      const hash = await sha256(pass);
      if (hash !== user.passwordHash) return alert('Correo o contraseña incorrectos.');

      saveSession({ email, remember, ts: Date.now() });
      alert('Bienvenido/a 👋');
      window.location.href = 'index.html';
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    enableValidation();
    handleRegister();
    handleLogin();
  });
})();
</script>
