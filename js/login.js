// ==========================================================
//  login.js — Inicio de sesión por rol
//  Valida usuario + contraseña y que la cuenta pertenezca
//  al rol elegido; luego abre el módulo de ese rol.
// ==========================================================
const MODULO = { admin: "administrador", mesero: "mesero", cocina: "cocina", caja: "caja" };
const DESCRIPCION = {
  admin: "Acceso completo: pedidos, cocina, caja, reportes y configuración.",
  mesero: "Registra pedidos por mesa, agrega o anula platos y entrega lo que cocina tenga listo.",
  cocina: "Recibe los pedidos en tiempo real y actualiza el estado de cada plato.",
  caja: "Abre la caja, cobra, divide cuentas, imprime boletas y hace el arqueo de cierre.",
};
const f = document.getElementById("loginForm"), err = document.getElementById("loginError"), btn = document.getElementById("btnLogin");
const rol = () => f.querySelector("input[name=rol]:checked").value;
const pintarRol = () => { document.getElementById("rolDesc").textContent = DESCRIPCION[rol()]; };
f.querySelectorAll("input[name=rol]").forEach((r) => r.addEventListener("change", pintarRol));
try { const ult = localStorage.getItem("hk_ultimo_rol"); if (ult) document.querySelector(`input[name=rol][value=${ult}]`).checked = true; } catch {}
pintarRol();

// Si ya hay una sesión abierta, entra directo a su módulo
HKDatos.request("GET", "/api/me").then((r) => {
  if (r.status === 200) location.replace(`modulos/${MODULO[r.data.rol]}/index.html`);
});

document.getElementById("verPass").addEventListener("click", (e) => {
  const p = document.getElementById("password"); p.type = p.type === "password" ? "text" : "password";
  e.currentTarget.innerHTML = `<i class="bi bi-eye${p.type === "password" ? "" : "-slash"}"></i>`;
});

f.addEventListener("submit", async (e) => {
  e.preventDefault(); err.classList.add("d-none");
  const usuario = f.usuario.value.trim(), password = f.password.value;
  if (!usuario || !password) { err.textContent = "Ingresa usuario y contraseña."; err.classList.remove("d-none"); return; }
  btn.disabled = true;
  try {
    const r = await HKDatos.request("POST", "/api/login", { usuario, password, rol: rol(), recordar: document.getElementById("recordar").checked });
    if (r.status >= 400) throw new Error((r.data && r.data.error) || "No se pudo iniciar sesión.");
    try { localStorage.setItem("hk_ultimo_rol", r.data.rol); } catch {}
    location.href = `modulos/${MODULO[r.data.rol]}/index.html`;
  } catch (ex) { err.textContent = ex.message || "No se pudo iniciar sesión."; err.classList.remove("d-none"); btn.disabled = false; }
});
