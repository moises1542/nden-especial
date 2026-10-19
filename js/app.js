// ==========================================================
//  Restaurante Hong Kong — funciones comunes del frontend
//  (sesión, API, menú por rol, tiempo real, perfil y avisos)
// ==========================================================
const HK = (() => {
  const ROLES_MENU = {
    inicio: ["admin", "mesero", "cocina", "caja"],
    pedidos: ["admin", "mesero"],
    cocina: ["admin", "cocina"],
    caja: ["admin", "caja"],
    reportes: ["admin", "caja"],
    config: ["admin"],
  };
  // Carpeta del módulo de cada rol (modulos/<carpeta>/)
  const MODULO = { admin: "administrador", mesero: "mesero", cocina: "cocina", caja: "caja" };
  // Ruta a la raíz del proyecto (las páginas de módulos están en modulos/<rol>/)
  const ROOT = location.pathname.includes("/modulos/") ? "../../" : "./";
  const irLogin = () => (location.href = ROOT + "index.html");
  let me = null;
  const listeners = [];
  const notifs = [];

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => "S/ " + Number(n || 0).toFixed(2);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const estado = (s) => `<span class="estado estado-${String(s).replace(/ /g, "-")}">${esc(s)}</span>`;
  const estadoComanda = (s) => `<span class="badge rounded-pill ${{ Abierta: "text-bg-warning", Pagada: "text-bg-success", Anulada: "text-bg-danger" }[s] || "text-bg-secondary"}">${esc(s)}</span>`;
  const hora = (dt) => (dt ? String(dt).slice(11, 16) : "");
  const fecha = (dt) => (dt ? String(dt).slice(0, 10).split("-").reverse().join("/") : "");
  const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const minutosDesde = (dt) => Math.max(0, Math.floor((Date.now() - new Date(String(dt).replace(" ", "T")).getTime()) / 60000));
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  function prefs() { try { return JSON.parse(localStorage.getItem("hk_preferencias") || "{}"); } catch { return {}; } }

  // ---------- API ----------
  // Todas las operaciones pasan por js/datos.js
  async function api(url, opts = {}) {
    let r;
    try { r = await HKDatos.request(opts.method || "GET", url, opts.body); }
    catch { throw new Error("No se pudo completar la operación."); }
    if (r.status === 401 && !url.endsWith("/api/login")) { irLogin(); throw new Error("Sesión expirada"); }
    if (r.status >= 400) throw new Error((r.data && r.data.error) || "No se pudo completar la operación.");
    return r.data;
  }
  const get = (u) => api(u);
  const post = (u, b) => api(u, { method: "POST", body: b || {} });
  const put = (u, b) => api(u, { method: "PUT", body: b || {} });

  // ---------- Avisos ----------
  function toast(msg, type = "success") {
    let c = $(".toast-container");
    if (!c) { c = document.createElement("div"); c.className = "toast-container position-fixed bottom-0 end-0 p-3"; document.body.append(c); }
    const icon = { success: "check-circle-fill", danger: "x-octagon-fill", warning: "exclamation-triangle-fill", info: "bell-fill" }[type] || "info-circle";
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute("role", "status");
    el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi bi-${icon} me-2"></i>${esc(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    c.append(el);
    const t = bootstrap.Toast.getOrCreateInstance(el, { delay: type === "danger" ? 6000 : 3500 });
    el.addEventListener("hidden.bs.toast", () => el.remove());
    t.show();
  }
  const error = (e) => toast(e.message || String(e), "danger");

  // Diálogo de confirmación / ingreso de texto (reemplaza confirm/prompt)
  function ask({ title, message, input = false, placeholder = "", okText = "Aceptar", okClass = "btn-primary", required = false }) {
    return new Promise((resolve) => {
      const m = $("#askModal");
      $("#askTitle", m).textContent = title;
      $("#askMessage", m).innerHTML = message || "";
      const inp = $("#askInput", m);
      inp.classList.toggle("d-none", !input);
      inp.value = ""; inp.placeholder = placeholder; inp.required = required;
      const ok = $("#askOk", m);
      ok.textContent = okText; ok.className = "btn " + okClass;
      let result = null;
      const form = $("#askForm", m);
      form.onsubmit = (e) => { e.preventDefault(); if (input && required && !inp.value.trim()) { inp.focus(); return; } result = input ? inp.value.trim() : true; modal.hide(); };
      const modal = bootstrap.Modal.getOrCreateInstance(m);
      m.addEventListener("hidden.bs.modal", () => resolve(result), { once: true });
      m.addEventListener("shown.bs.modal", () => (input ? inp : ok).focus(), { once: true });
      modal.show();
    });
  }
  async function confirmar(title, message, okText = "Sí, continuar", okClass = "btn-danger") {
    if (prefs().confirmar === false) return true;
    return !!(await ask({ title, message, okText, okClass }));
  }

  // ---------- Layout ----------
  function initLayout() {
    const app = $("#app");
    const isMobile = () => matchMedia("(max-width: 991.98px)").matches;
    $$("[data-toggle-menu]").forEach((b) => b.addEventListener("click", () => app.classList.toggle(isMobile() ? "sidebar-open" : "sidebar-collapsed")));
    $("#sidebarBackdrop")?.addEventListener("click", () => app.classList.remove("sidebar-open"));
    if (prefs().densidad === "compacta") document.body.classList.add("hk-compact");
    $$("[data-menu]").forEach((a) => { if (!(ROLES_MENU[a.dataset.menu] || []).includes(me.rol)) a.remove(); });
    const inicio = `${ROOT}modulos/${MODULO[me.rol]}/index.html`;
    $$("[data-inicio], a[data-menu=inicio]").forEach((a) => (a.href = inicio));
    $$(".menu-title").forEach((t) => { if (!t.nextElementSibling || t.nextElementSibling.classList.contains("menu-title")) t.remove(); });

    $$("[data-me=nombre]").forEach((e) => (e.textContent = me.nombre));
    $$("[data-me=email]").forEach((e) => (e.textContent = me.email || me.usuario));
    $$("[data-me=rol]").forEach((e) => (e.textContent = me.rol_nombre));
    $$("[data-me=iniciales]").forEach((e) => (e.textContent = iniciales(me.nombre)));
    $$("[data-turno]").forEach((e) => (e.innerHTML = turnoBadge(me.turno)));

    // Perfil: datos, edición y sesión
    const PERMISOS = {
      admin: ["Acceso completo al sistema", "Anular platos en preparación", "Configurar carta, horarios y usuarios", "Ver reportes y cierres de caja"],
      mesero: ["Registrar y modificar pedidos", "Anular platos pendientes", "Marcar platos entregados"],
      cocina: ["Ver el monitor de cocina", "Cambiar el estado de los platos"],
      caja: ["Abrir y cerrar caja (arqueo)", "Cobrar y dividir cuentas", "Ver reportes de ventas"],
    };
    const fh = (dt) => (dt ? `${fecha(dt)} ${hora(dt)}` : "—");
    const fiso = (iso) => (iso ? new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—");
    $("#profileModal")?.addEventListener("show.bs.modal", async (e) => {
      // relatedTarget = botón que abrió el modal (Ver mis datos / Editar perfil / Mi sesión)
      const pfTab = (e.relatedTarget && e.relatedTarget.dataset.pfTab) || "#pfDatos";
      bootstrap.Tab.getOrCreateInstance($(`[data-bs-target="${pfTab}"]`)).show();
      try { Object.assign(me, await get("/api/me")); } catch { /* se usa lo cargado */ }
      $("#pfNombre").value = me.nombre; $("#pfEmail").value = me.email || ""; $("#pfUsuario").value = me.usuario;
      $("#pvUsuario").textContent = me.usuario;
      $("#pvEmail").textContent = me.email || "—";
      $("#pvCreado").textContent = fh(me.creado_en);
      $("#pvSesion").textContent = fh(me.sesion_desde);
      $("#pvExpira").textContent = fiso(me.sesion_expira);
      $("#pvAnterior").textContent = fh(me.acceso_anterior);
      $("#pvSesiones").textContent = me.sesiones_activas;
      $("#pvPermisos").innerHTML = (PERMISOS[me.rol] || []).map((p) => `<li>${esc(p)}</li>`).join("");
    });
    $("#btnLogoutTodas")?.addEventListener("click", async () => {
      if (!(await confirmar("Cerrar todas las sesiones", "Se cerrará tu sesión en este y en todos los demás dispositivos.", "Cerrar todas"))) return;
      await post("/api/logout-todas"); irLogin();
    });
    $("#profileForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await put("/api/me", { nombre: $("#pfNombre").value, email: $("#pfEmail").value });
        me.nombre = $("#pfNombre").value.trim(); me.email = $("#pfEmail").value.trim();
        $$("[data-me=nombre]").forEach((x) => (x.textContent = me.nombre));
        $$("[data-me=email]").forEach((x) => (x.textContent = me.email || me.usuario));
        $$("[data-me=iniciales]").forEach((x) => (x.textContent = iniciales(me.nombre)));
        $("#pvEmail").textContent = me.email || "—";
        bootstrap.Tab.getOrCreateInstance($('[data-bs-target="#pfDatos"]')).show();
        toast("Perfil actualizado.");
      } catch (err) { error(err); }
    });
    $("#passwordForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if ($("#pwNueva").value !== $("#pwConfirma").value) return toast("La confirmación no coincide.", "warning");
      try {
        await put("/api/me/password", { actual: $("#pwActual").value, nueva: $("#pwNueva").value });
        e.target.reset();
        bootstrap.Modal.getInstance($("#passwordModal")).hide();
        toast("Contraseña actualizada. Se cerraron tus otras sesiones.");
      } catch (err) { error(err); }
    });
    $("#preferencesModal")?.addEventListener("show.bs.modal", () => {
      const p = prefs();
      $("#prefDensidad").value = p.densidad || "normal";
      $("#prefConfirmar").checked = p.confirmar !== false;
      $("#prefSonido").checked = p.sonido !== false;
    });
    $("#preferencesForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const p = { densidad: $("#prefDensidad").value, confirmar: $("#prefConfirmar").checked, sonido: $("#prefSonido").checked };
      localStorage.setItem("hk_preferencias", JSON.stringify(p));
      document.body.classList.toggle("hk-compact", p.densidad === "compacta");
      bootstrap.Modal.getInstance($("#preferencesModal")).hide();
      toast("Preferencias guardadas en este equipo.");
    });
    $$(".js-logout").forEach((b) => b.addEventListener("click", async () => { await post("/api/logout"); irLogin(); }));

    if (new URLSearchParams(location.search).get("denegado")) toast("No tienes permiso para acceder a esa sección.", "warning");
  }

  function turnoBadge(t) {
    if (t === "desayuno") return `<span class="badge rounded-pill text-bg-warning turno-pill"><i class="bi bi-sunrise me-1"></i>Turno desayuno</span>`;
    if (t === "almuerzo") return `<span class="badge rounded-pill text-bg-primary turno-pill"><i class="bi bi-sun me-1"></i>Turno almuerzo</span>`;
    if (t === "todos") return `<span class="badge rounded-pill text-bg-dark turno-pill"><i class="bi bi-journal-text me-1"></i>Carta completa</span>`;
    return `<span class="badge rounded-pill text-bg-secondary turno-pill"><i class="bi bi-moon me-1"></i>Fuera de horario</span>`;
  }

  // ---------- Tiempo real ----------
  const TEXTOS = {
    comanda_nueva: (d) => ({ txt: `Nueva comanda #${d.numero} · ${d.mesa}`, roles: ["cocina", "admin"], tipo: "info" }),
    comanda_items: (d) => ({ txt: `Se agregaron platos a #${d.numero} · ${d.mesa}`, roles: ["cocina", "admin"], tipo: "info" }),
    comanda_anulada: (d) => ({ txt: `Comanda #${d.numero} anulada`, roles: ["cocina", "caja", "admin"], tipo: "warning" }),
    estado: (d) => d.estado === "Listo" ? { txt: `Pedido #${d.numero}: platos listos para servir`, roles: ["mesero", "admin"], tipo: "success" } : null,
    pago: (d) => ({ txt: `Pago registrado en #${d.numero}`, roles: ["mesero", "admin"], tipo: "success" }),
  };

  function beep() {
    if (prefs().sonido === false) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch { /* sin audio */ }
  }

  function renderNotifs() {
    const n = notifs.filter((x) => !x.leida).length;
    const badge = $("#notifCount");
    if (badge) { badge.textContent = n; badge.classList.toggle("d-none", !n); }
    const list = $("#notifList");
    if (list) list.innerHTML = notifs.length
      ? notifs.slice(0, 20).map((x) => `<li><span class="dropdown-item-text small border-bottom d-block py-2"><i class="bi bi-dot text-${x.tipo}"></i>${esc(x.txt)}<br><small class="text-muted ms-3">${x.hora}</small></span></li>`).join("")
      : `<li><span class="dropdown-item-text small text-muted">Sin notificaciones</span></li>`;
  }

  function recibirEvento(d) {
    listeners.forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });
    const t = TEXTOS[d.type] && TEXTOS[d.type](d);
    if (t && t.roles.includes(me.rol)) {
      notifs.unshift({ txt: t.txt, tipo: t.tipo, hora: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) });
      renderNotifs();
      if (prefs().avisos !== false) toast(t.txt, t.tipo);
      beep();
    }
  }

  // Sincronización entre pestañas del mismo navegador
  function connectEvents() {
    const dot = $("#liveDot");
    $("#notifDropdown")?.addEventListener("show.bs.dropdown", () => { notifs.forEach((x) => (x.leida = true)); setTimeout(renderNotifs, 1500); });
    renderNotifs();
    dot?.classList.add("on");
    if (dot) dot.title = "Las pestañas abiertas se actualizan solas";
    HKDatos.onEvento(recibirEvento);
  }

  // Ejecuta fn cuando llegue un cambio; agrupa ráfagas de eventos
  function onChange(fn) {
    let timer = null;
    listeners.push((d) => { clearTimeout(timer); timer = setTimeout(() => fn(d), 150); });
  }

  // ---------- Arranque ----------
  async function init() {
    me = await get("/api/me");
    // Cada usuario solo puede estar en su módulo (el administrador en todos)
    const m = location.pathname.match(/\/modulos\/([^/]+)\//);
    if (m && me.rol !== "admin" && m[1] !== MODULO[me.rol]) {
      location.replace(`${ROOT}modulos/${MODULO[me.rol]}/index.html?denegado=1`);
      return new Promise(() => {}); // detiene la carga de esta página
    }
    initLayout();
    connectEvents();
    return me;
  }

  return { MODULO, ROOT, init, api, get, post, put, toast, error, ask, confirmar, money, esc, estado, estadoComanda, hora, fecha, iniciales, minutosDesde, hoyISO, turnoBadge, onChange, $, $$, me: () => me };
})();
