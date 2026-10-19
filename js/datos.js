// ==========================================================
//  datos.js — Datos del sistema (sin base de datos)
//  Guarda usuarios, pedidos, pagos y cierres de caja en el
//  almacenamiento del navegador (localStorage). Las pestañas
//  abiertas del mismo navegador se sincronizan entre sí.
//  Se abre con Live Server o con doble clic en index.html.
// ==========================================================
const HKDatos = (() => {
  const DB_KEY = "hk_bd_local_v3";
  const EVT_KEY = "hk_evento_local";
  const SES_KEY = "hk_sesion_local";
  // Interfaz única: request(método, ruta, datos) → { status, data }
  async function request(method, url, body) { return local(method, url, body || {}); }

  // ==========================================================
  //  Almacenamiento en localStorage
  // ==========================================================
  const pad = (n) => String(n).padStart(2, "0");
  const ahora = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const hoy = () => ahora().slice(0, 10);
  const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  const METODOS = ["Efectivo", "Yape", "Plin", "Tarjeta"];
  const ROLES = { admin: "Administrador", mesero: "Mesero", cocina: "Cocina", caja: "Caja" };

  class Err extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const fail = (s, m) => { throw new Err(s, m); };

  // SHA-256: las contraseñas se guardan cifradas, nunca en texto plano
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = 2 ** 32; let result = ""; const words = []; const len = ascii.length * 8;
    const hash = []; const k = []; let primeCounter = 0; const isComposite = {};
    for (let c = 2; primeCounter < 64; c++) {
      if (!isComposite[c]) {
        for (let i = 0; i < 313; i += c) isComposite[i] = c;
        hash[primeCounter] = (c ** 0.5 * maxWord) | 0;
        k[primeCounter++] = (c ** (1 / 3) * maxWord) | 0;
      }
    }
    ascii = unescape(encodeURIComponent(ascii)) + "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << (((3 - i) % 4) * 8);
    words[words.length] = (len / maxWord) | 0; words[words.length] = len;
    let H = hash.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16)); const old = H;
      H = H.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2]; const a = H[0], e = H[4];
        const t1 = H[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & H[5]) ^ (~e & H[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]));
        H = [(t1 + t2) | 0].concat(H); H[4] = (H[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) H[i] = (H[i] + old[i]) | 0;
    }
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (H[i] >> (j * 8)) & 255; result += (b < 16 ? "0" : "") + b.toString(16); }
    return result;
  }
  const sal = () => Math.random().toString(36).slice(2, 12);
  function hashPass(p, s = sal()) { let h = s + ":" + p; for (let i = 0; i < 500; i++) h = sha256(h + s); return `sha256$${s}$${h}`; }
  function verificarPass(p, guardado) { const [, s] = String(guardado).split("$"); return hashPass(p, s) === guardado; }
  function validarPassword(p) {
    if (typeof p !== "string" || p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "La contraseña debe combinar letras y números.";
    return null;
  }

  // ---------- Carga / guardado ----------
  function semilla() {
    const db = { seq: {}, usuarios: [], categorias: [], productos: [], mesas: [], config: {}, comandas: [], items: [], pagos: [], arqueos: [], auditoria: [], sesiones: [] };
    const add = (t, row) => { db.seq[t] = (db.seq[t] || 0) + 1; row.id = db.seq[t]; db[t].push(row); return row; };
    const t = ahora();
    [["administrador", "Administrador", "administrador@hongkong.local", "Admin123", "admin"],
     ["mesero", "Mesero de turno", "mesero@hongkong.local", "Mesero123", "mesero"],
     ["cocina", "Jefe de cocina", "cocina@hongkong.local", "Cocina123", "cocina"],
     ["caja", "Cajero principal", "caja@hongkong.local", "Caja123", "caja"]]
      .forEach(([usuario, nombre, email, pass, rol]) => add("usuarios", { usuario, nombre, email, password_hash: hashPass(pass), rol, activo: 1, intentos: 0, bloqueado_hasta: null, creado_en: t }));
    ["Desayunos", "Bebidas", "Platos de fondo", "Sopas", "Menú del día"].forEach((nombre) => add("categorias", { nombre }));
    [["Desayuno continental", 1, 12, "desayuno"], ["Pan con chicharrón", 1, 10, "desayuno"], ["Pan con tortilla", 1, 8, "desayuno"], ["Tamal criollo", 1, 7, "desayuno"],
     ["Café pasado", 2, 5, "ambos"], ["Jugo de papaya", 2, 7, "ambos"], ["Chicha morada (jarra)", 2, 12, "ambos"], ["Inca Kola 500 ml", 2, 4, "ambos"],
     ["Arroz chaufa especial", 3, 28, "almuerzo"], ["Tallarín saltado", 3, 25, "almuerzo"], ["Pollo chijaukay", 3, 30, "almuerzo"], ["Kam lu wantán", 3, 32, "almuerzo"],
     ["Aeropuerto", 3, 26, "almuerzo"], ["Sopa wantán", 4, 15, "almuerzo"], ["Sopa fuchifu", 4, 14, "almuerzo"], ["Menú ejecutivo", 5, 18, "almuerzo"]]
      .forEach(([nombre, categoria_id, precio, turno]) => add("productos", { nombre, categoria_id, precio, turno, activo: 1 }));
    for (let i = 1; i <= 12; i++) add("mesas", { nombre: "Mesa " + pad(i), capacidad: i <= 8 ? 4 : 6 });
    db.config = { hora_apertura: "06:00", hora_inicio_almuerzo: "11:00", hora_cierre: "19:00", validar_horario: "1", nombre_local: "Restaurante Hong Kong" };
    return db;
  }
  let cache = null;
  function leer() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch { cache = null; }
    if (!cache) { cache = semilla(); guardar(); }
    return cache;
  }
  function guardar() { localStorage.setItem(DB_KEY, JSON.stringify(cache)); }
  window.addEventListener("storage", (e) => { if (e.key === DB_KEY) cache = null; });
  const nuevo = (db, t, row) => { db.seq[t] = (db.seq[t] || 0) + 1; row.id = db.seq[t]; db[t].push(row); return row; };

  // ---------- Eventos entre pestañas ----------
  const oyentes = [];
  function emitir(type, data = {}) {
    const ev = { type, ...data, at: Date.now(), n: Math.random() };
    try { localStorage.setItem(EVT_KEY, JSON.stringify(ev)); } catch { /* */ }
    oyentes.forEach((fn) => fn(ev));
  }
  window.addEventListener("storage", (e) => { if (e.key === EVT_KEY && e.newValue) { const ev = JSON.parse(e.newValue); oyentes.forEach((fn) => fn(ev)); } });
  const onEvento = (fn) => oyentes.push(fn);

  // ---------- Sesión local ----------
  function sesion() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(SES_KEY) || localStorage.getItem(SES_KEY) || "null"); } catch { /* */ }
    if (!s) return null;
    const db = leer();
    const ses = db.sesiones.find((x) => x.token === s.token);
    if (!ses || new Date(ses.expira_en) < new Date()) { cerrarSesionLocal(); return null; }
    const u = db.usuarios.find((x) => x.id === ses.usuario_id && x.activo);
    if (!u) { cerrarSesionLocal(); return null; }
    return { ...u, rol_nombre: ROLES[u.rol], token: s.token, ses };
  }
  function cerrarSesionLocal() { try { sessionStorage.removeItem(SES_KEY); localStorage.removeItem(SES_KEY); } catch { /* */ } }

  // ---------- Reglas de negocio ----------
  const minutos = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
  function config(db) { const c = { ...db.config }; c.validar_horario = c.validar_horario !== "0"; return c; }
  function turnoActual(db) {
    const c = config(db); const d = new Date(); const t = d.getHours() * 60 + d.getMinutes();
    if (t < minutos(c.hora_apertura) || t >= minutos(c.hora_cierre)) return null;
    return t < minutos(c.hora_inicio_almuerzo) ? "desayuno" : "almuerzo";
  }
  const audit = (db, uid, accion, detalle) => nuevo(db, "auditoria", { usuario_id: uid, accion, detalle: detalle ? JSON.stringify(detalle) : null, creado_en: ahora() });
  const cat = (db, id) => db.categorias.find((c) => c.id === id);
  const prod = (db, id) => db.productos.find((p) => p.id === id);
  const usr = (db, id) => db.usuarios.find((u) => u.id === id);
  const mesa = (db, id) => db.mesas.find((m) => m.id === id);
  const enRango = (dt, d, h) => dt.slice(0, 10) >= d && dt.slice(0, 10) <= h;

  function armarComanda(db, c) {
    const items = db.items.filter((i) => i.comanda_id === c.id).map((i) => {
      const p = prod(db, i.producto_id);
      return { ...i, producto: p.nombre, categoria: cat(db, p.categoria_id).nombre, subtotal: r2(i.cantidad * i.precio_unitario) };
    });
    const pagos = db.pagos.filter((p) => p.comanda_id === c.id).map((p) => ({ ...p, cajero: usr(db, p.cajero_id).nombre }));
    const total = r2(items.filter((i) => i.estado !== "Anulado").reduce((a, i) => a + i.subtotal, 0));
    const pagado = r2(pagos.reduce((a, p) => a + p.monto, 0));
    return { ...c, mesa: c.mesa_id ? mesa(db, c.mesa_id).nombre : null, mesero: usr(db, c.mesero_id).nombre, items, pagos, total, pagado, saldo: r2(Math.max(0, total - pagado)) };
  }
  const comandas = (db, filtro = () => true) => db.comandas.filter(filtro).sort((a, b) => b.id - a.id).map((c) => armarComanda(db, c));
  const getComanda = (db, id) => { const c = db.comandas.find((x) => x.id === Number(id)); if (!c) fail(404, "Comanda no encontrada."); return armarComanda(db, c); };

  function insertarItems(db, comanda, items) {
    if (!Array.isArray(items) || !items.length) fail(400, "Agrega al menos un plato.");
    const cfg = config(db); const turno = turnoActual(db);
    if (cfg.validar_horario && !turno) fail(400, `Fuera del horario de atención (${cfg.hora_apertura} – ${cfg.hora_cierre}).`);
    for (const it of items) {
      const p = prod(db, Number(it.producto_id));
      if (!p || !p.activo) fail(400, "Uno de los productos no existe o está inactivo.");
      if (cfg.validar_horario && p.turno !== "ambos" && p.turno !== turno) fail(400, `"${p.nombre}" no está disponible en el turno de ${turno}.`);
      const cant = Math.floor(Number(it.cantidad));
      if (!(cant >= 1 && cant <= 50)) fail(400, "Cantidad no válida (1 a 50).");
      const comensal = Math.min(Math.max(1, Math.floor(Number(it.comensal) || 1)), comanda.comensales);
      nuevo(db, "items", { comanda_id: comanda.id, producto_id: p.id, cantidad: cant, precio_unitario: p.precio,
        nota: String(it.nota || "").trim().slice(0, 200) || null, comensal, estado: "Pendiente", pagado: 0, creado_en: ahora(), actualizado_en: ahora() });
    }
  }
  const TRANS = {
    "En preparación": { desde: ["Pendiente"], roles: ["cocina"] }, "Listo": { desde: ["En preparación"], roles: ["cocina"] },
    "Entregado": { desde: ["Listo"], roles: ["mesero", "cocina"] }, "Pendiente": { desde: ["En preparación"], roles: ["cocina"] },
  };
  function cambiarEstado(db, item, comanda, estado, u) {
    const t = TRANS[estado]; if (!t) fail(400, "Estado no válido.");
    if (u.rol !== "admin" && !t.roles.includes(u.rol)) fail(403, "Tu rol no puede realizar este cambio de estado.");
    if (!t.desde.includes(item.estado)) fail(400, `No se puede pasar de "${item.estado}" a "${estado}".`);
    if (comanda.estado === "Anulada") fail(400, "La comanda está anulada.");
    item.estado = estado; item.actualizado_en = ahora();
  }
  const cajaAbierta = (db) => { const a = [...db.arqueos].reverse().find((x) => x.estado === "Abierta"); return a ? { ...a, cajero: usr(db, a.cajero_id).nombre } : null; };
  function resumenArqueo(db, id) {
    const a = db.arqueos.find((x) => x.id === id); const pg = db.pagos.filter((p) => p.arqueo_id === id);
    const porMetodo = Object.fromEntries(METODOS.map((m) => [m, r2(pg.filter((p) => p.metodo === m).reduce((s, p) => s + p.monto, 0))]));
    const total = r2(Object.values(porMetodo).reduce((x, y) => x + y, 0));
    return { porMetodo, total, num_pagos: pg.length, comandas_cobradas: new Set(pg.map((p) => p.comanda_id)).size, efectivo_esperado: r2(a.monto_inicial + porMetodo.Efectivo) };
  }
  function reporteArqueo(db, id) {
    const a0 = db.arqueos.find((x) => x.id === Number(id)); if (!a0) fail(404, "Arqueo no encontrado.");
    const a = { ...a0, cajero: usr(db, a0.cajero_id).nombre }; const fin = a.cerrado_en || ahora();
    const pagos = db.pagos.filter((p) => p.arqueo_id === a.id).map((p) => ({ ...p, numero: db.comandas.find((c) => c.id === p.comanda_id).numero, cajero: usr(db, p.cajero_id).nombre }));
    const ids = new Set(pagos.map((p) => p.comanda_id)); const agg = {};
    db.items.filter((i) => ids.has(i.comanda_id) && i.estado !== "Anulado").forEach((i) => {
      const n = prod(db, i.producto_id).nombre; agg[n] ||= { nombre: n, cantidad: 0, importe: 0 }; agg[n].cantidad += i.cantidad; agg[n].importe += i.cantidad * i.precio_unitario;
    });
    return {
      arqueo: a, resumen: resumenArqueo(db, a.id), pagos,
      anuladas: db.comandas.filter((c) => c.estado === "Anulada" && c.cerrado_en >= a.abierto_en && c.cerrado_en <= fin).length,
      pendientes: db.comandas.filter((c) => c.estado === "Abierta").map((c) => c.numero),
      top: Object.values(agg).sort((x, y) => y.cantidad - x.cantidad).slice(0, 5),
    };
  }

  // ---------- Operaciones del sistema ----------
  const rutas = [];
  const ruta = (m, patron, roles, fn) => rutas.push({ m, re: new RegExp("^" + patron.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), roles, fn });
  const NADIE = null; // ruta pública

  
  ruta("POST", "/api/login", NADIE, (db, b) => {
    if (!b.usuario || !b.password) fail(400, "Ingresa usuario y contraseña.");
    const u = db.usuarios.find((x) => x.usuario.toLowerCase() === String(b.usuario).trim().toLowerCase());
    if (u && u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) fail(423, "Usuario bloqueado temporalmente por intentos fallidos. Intenta en unos minutos.");
    if (!u || !verificarPass(b.password, u.password_hash)) {
      if (u) { u.intentos++; if (u.intentos >= 5) { u.bloqueado_hasta = new Date(Date.now() + 5 * 60e3).toISOString(); u.intentos = 0; } }
      fail(401, "Usuario o contraseña incorrectos.");
    }
    if (!u.activo) fail(403, "La cuenta está desactivada. Comunícate con el administrador.");
    if (b.rol && b.rol !== u.rol) fail(403, `Esta cuenta no pertenece al rol ${ROLES[b.rol] || b.rol}. Corresponde a: ${ROLES[u.rol]}.`);
    u.intentos = 0; u.bloqueado_hasta = null;
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    db.sesiones = db.sesiones.filter((s) => new Date(s.expira_en) > new Date());
    db.sesiones.push({ token, usuario_id: u.id, creado_en: ahora(), expira_en: new Date(Date.now() + (b.recordar ? 30 * 24 : 12) * 3600e3).toISOString() });
    (b.recordar ? localStorage : sessionStorage).setItem(SES_KEY, JSON.stringify({ token }));
    audit(db, u.id, "login");
    return { ok: true, rol: u.rol };
  });
  ruta("POST", "/api/logout", NADIE, (db, b, u) => { if (u) { db.sesiones = db.sesiones.filter((s) => s.token !== u.token); audit(db, u.id, "logout"); } cerrarSesionLocal(); return { ok: true }; });
  ruta("POST", "/api/logout-todas", [], (db, b, u) => { db.sesiones = db.sesiones.filter((s) => s.usuario_id !== u.id); cerrarSesionLocal(); return { ok: true }; });
  ruta("GET", "/api/me", [], (db, b, u) => {
    const logins = db.auditoria.filter((a) => a.usuario_id === u.id && a.accion === "login").reverse();
    return { id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.email, rol: u.rol, rol_nombre: ROLES[u.rol], creado_en: u.creado_en,
      sesion_desde: u.ses.creado_en, sesion_expira: u.ses.expira_en, acceso_anterior: logins[1] ? logins[1].creado_en : null,
      sesiones_activas: db.sesiones.filter((s) => s.usuario_id === u.id && new Date(s.expira_en) > new Date()).length,
      turno: turnoActual(db), config: config(db) };
  });
  ruta("PUT", "/api/me", [], (db, b, u) => {
    const nombre = String(b.nombre || "").trim(); const email = String(b.email || "").trim();
    if (!nombre) fail(400, "El nombre es obligatorio."); if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) fail(400, "Correo no válido.");
    const x = usr(db, u.id); x.nombre = nombre; x.email = email || null; return { ok: true };
  });
  ruta("PUT", "/api/me/password", [], (db, b, u) => {
    const x = usr(db, u.id);
    if (!verificarPass(b.actual || "", x.password_hash)) fail(400, "La contraseña actual no es correcta.");
    const e = validarPassword(b.nueva); if (e) fail(400, e);
    x.password_hash = hashPass(b.nueva); db.sesiones = db.sesiones.filter((s) => s.usuario_id !== u.id || s.token === u.token); return { ok: true };
  });

  ruta("GET", "/api/config", [], (db) => ({ ...config(db), turno: turnoActual(db) }));
  ruta("PUT", "/api/config", ["admin"], (db, b) => {
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const k of ["hora_apertura", "hora_inicio_almuerzo", "hora_cierre"]) if (!re.test(b[k] || "")) fail(400, "Formato de hora no válido (HH:MM).");
    if (!(minutos(b.hora_apertura) < minutos(b.hora_inicio_almuerzo) && minutos(b.hora_inicio_almuerzo) < minutos(b.hora_cierre))) fail(400, "Las horas deben cumplir: apertura < inicio de almuerzo < cierre.");
    Object.assign(db.config, { hora_apertura: b.hora_apertura, hora_inicio_almuerzo: b.hora_inicio_almuerzo, hora_cierre: b.hora_cierre, validar_horario: b.validar_horario ? "1" : "0" });
    emitir("config"); return { ok: true };
  });
  ruta("GET", "/api/categorias", [], (db) => db.categorias);
  ruta("GET", "/api/menu", [], (db, b, u, q) => {
    let turno = q.turno && q.turno !== "auto" ? q.turno : turnoActual(db);
    if (!turno && !config(db).validar_horario) turno = "todos";
    const productos = db.productos.filter((p) => p.activo && (turno === "todos" || p.turno === "ambos" || p.turno === turno))
      .map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, turno: p.turno, categoria: cat(db, p.categoria_id).nombre, categoria_id: p.categoria_id }))
      .sort((a, c) => a.categoria_id - c.categoria_id || a.nombre.localeCompare(c.nombre));
    return { turno, productos };
  });
  ruta("GET", "/api/productos", ["admin"], (db) => db.productos.map((p) => ({ ...p, categoria: cat(db, p.categoria_id).nombre,
    vendidos: db.items.filter((i) => i.producto_id === p.id && i.estado !== "Anulado").reduce((a, i) => a + i.cantidad, 0) }))
    .sort((a, c) => a.categoria_id - c.categoria_id || a.nombre.localeCompare(c.nombre)));
  function validarProducto(db, b) {
    const nombre = String(b.nombre || "").trim(); const precio = Number(b.precio);
    if (!nombre) fail(400, "El nombre es obligatorio."); if (!(precio >= 0)) fail(400, "Precio no válido.");
    if (!["desayuno", "almuerzo", "ambos"].includes(b.turno)) fail(400, "Turno no válido.");
    if (!cat(db, Number(b.categoria_id))) fail(400, "Categoría no válida.");
    return { nombre, precio: r2(precio), turno: b.turno, categoria_id: Number(b.categoria_id), activo: b.activo === false ? 0 : 1 };
  }
  ruta("POST", "/api/productos", ["admin"], (db, b) => { const p = nuevo(db, "productos", validarProducto(db, b)); emitir("menu"); return { id: p.id }; });
  ruta("PUT", "/api/productos/:id", ["admin"], (db, b, u, q, prm) => {
    const p = prod(db, Number(prm.id)); if (!p) fail(404, "Producto no encontrado.");
    Object.assign(p, validarProducto(db, b)); emitir("menu"); return { ok: true };
  });
  ruta("GET", "/api/mesas", [], (db) => db.mesas.map((m) => { const c = db.comandas.find((x) => x.mesa_id === m.id && x.estado === "Abierta"); return { ...m, comanda_id: c ? c.id : null, comanda_numero: c ? c.numero : null }; }));

  ruta("GET", "/api/usuarios", ["admin"], (db) => db.usuarios.map((u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.email, activo: u.activo, creado_en: u.creado_en, rol: u.rol, rol_nombre: ROLES[u.rol],
    ultimo_acceso: (db.auditoria.filter((a) => a.usuario_id === u.id && a.accion === "login").pop() || {}).creado_en || null }))
    .sort((a, b) => Object.keys(ROLES).indexOf(a.rol) - Object.keys(ROLES).indexOf(b.rol) || a.nombre.localeCompare(b.nombre)));
  ruta("POST", "/api/usuarios", ["admin"], (db, b) => {
    const usuario = String(b.usuario || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) fail(400, "Usuario: 3 a 30 caracteres (letras, números, punto o guion).");
    if (!String(b.nombre || "").trim()) fail(400, "El nombre es obligatorio.");
    const e = validarPassword(b.password); if (e) fail(400, e);
    if (!ROLES[b.rol]) fail(400, "Rol no válido.");
    if (db.usuarios.some((x) => x.usuario === usuario)) fail(409, "Ese nombre de usuario ya existe.");
    const u = nuevo(db, "usuarios", { usuario, nombre: String(b.nombre).trim(), email: String(b.email || "").trim() || null, password_hash: hashPass(b.password), rol: b.rol, activo: 1, intentos: 0, bloqueado_hasta: null, creado_en: ahora() });
    return { id: u.id };
  });
  ruta("PUT", "/api/usuarios/:id", ["admin"], (db, b, me, q, prm) => {
    const u = usr(db, Number(prm.id)); if (!u) fail(404, "Usuario no encontrado.");
    if (u.id === me.id && (b.activo === false || b.rol !== "admin")) fail(400, "No puedes desactivarte ni quitarte el rol de administrador.");
    if (!String(b.nombre || "").trim()) fail(400, "El nombre es obligatorio."); if (!ROLES[b.rol]) fail(400, "Rol no válido.");
    Object.assign(u, { nombre: String(b.nombre).trim(), email: String(b.email || "").trim() || null, rol: b.rol, activo: b.activo === false ? 0 : 1 });
    if (!u.activo) db.sesiones = db.sesiones.filter((s) => s.usuario_id !== u.id);
    if (b.password) { const e = validarPassword(b.password); if (e) fail(400, e); u.password_hash = hashPass(b.password); u.intentos = 0; u.bloqueado_hasta = null; db.sesiones = db.sesiones.filter((s) => s.usuario_id !== u.id); }
    return { ok: true };
  });

  ruta("GET", "/api/comandas", [], (db, b, u, q) => comandas(db, (c) =>
    (!q.estado || q.estado === "Todas" || c.estado === q.estado) && (!q.desde || c.creado_en.slice(0, 10) >= q.desde) && (!q.hasta || c.creado_en.slice(0, 10) <= q.hasta) &&
    (!q.cocina || (c.estado !== "Anulada" && db.items.some((i) => i.comanda_id === c.id && ["Pendiente", "En preparación", "Listo"].includes(i.estado)))) &&
    (!(u.rol === "mesero" && q.mias) || c.mesero_id === u.id)));
  ruta("GET", "/api/comandas/:id", [], (db, b, u, q, p) => getComanda(db, p.id));
  ruta("POST", "/api/comandas", ["mesero"], (db, b, u) => {
    if (!["Salón", "Para llevar", "Delivery"].includes(b.tipo)) fail(400, "Tipo de pedido no válido.");
    let mesa_id = null;
    if (b.tipo === "Salón") {
      mesa_id = Number(b.mesa_id); if (!mesa(db, mesa_id)) fail(400, "Selecciona una mesa.");
      const oc = db.comandas.find((c) => c.mesa_id === mesa_id && c.estado === "Abierta");
      if (oc) fail(409, `La mesa ya tiene la comanda #${oc.numero} abierta. Agrega los platos a esa comanda.`);
    }
    const comensales = Math.min(Math.max(1, Math.floor(Number(b.comensales) || 1)), 20);
    const c = nuevo(db, "comandas", { numero: pad5(db.comandas.length + 1), mesa_id, tipo: b.tipo, cliente: String(b.cliente || "").trim().slice(0, 80) || "Cliente general",
      comensales, turno: turnoActual(db) || "almuerzo", mesero_id: u.id, metodo_sugerido: METODOS.includes(b.metodo_sugerido) ? b.metodo_sugerido : null,
      observacion: String(b.observacion || "").trim().slice(0, 200) || null, estado: "Abierta", motivo_anulacion: null, creado_en: ahora(), cerrado_en: null });
    try { insertarItems(db, c, b.items); } catch (e) { db.comandas.pop(); db.seq.comandas--; throw e; }
    const r = getComanda(db, c.id); emitir("comanda_nueva", { id: c.id, numero: c.numero, mesa: r.mesa || c.tipo }); return r;
  });
  const pad5 = (n) => String(n).padStart(5, "0");
  ruta("POST", "/api/comandas/:id/items", ["mesero"], (db, b, u, q, p) => {
    const c = db.comandas.find((x) => x.id === Number(p.id)); if (!c) fail(404, "Comanda no encontrada.");
    if (c.estado !== "Abierta") fail(400, "Solo se pueden agregar platos a comandas abiertas.");
    if (b.comensales) c.comensales = Math.min(Math.max(c.comensales, Math.floor(Number(b.comensales))), 20);
    insertarItems(db, c, b.items); const r = getComanda(db, c.id);
    emitir("comanda_items", { id: c.id, numero: c.numero, mesa: r.mesa || c.tipo }); return r;
  });
  const itemDe = (db, id) => { const i = db.items.find((x) => x.id === Number(id)); if (!i) fail(404, "Plato no encontrado."); return { i, c: db.comandas.find((x) => x.id === i.comanda_id) }; };
  ruta("PUT", "/api/items/:id", ["mesero"], (db, b, u, q, p) => {
    const { i, c } = itemDe(db, p.id);
    if (c.estado !== "Abierta") fail(400, "La comanda ya no está abierta."); if (i.estado === "Anulado") fail(400, "El plato está anulado.");
    const cambia = (b.cantidad !== undefined && Number(b.cantidad) !== i.cantidad) || (b.nota !== undefined && (b.nota || null) !== i.nota);
    if (cambia && i.estado !== "Pendiente") fail(400, `No se puede modificar: el plato está "${i.estado}".`);
    if (i.pagado) fail(400, "El plato ya fue pagado.");
    const cant = b.cantidad !== undefined ? Math.floor(Number(b.cantidad)) : i.cantidad; if (!(cant >= 1 && cant <= 50)) fail(400, "Cantidad no válida.");
    i.cantidad = cant; if (b.nota !== undefined) i.nota = String(b.nota).trim().slice(0, 200) || null;
    if (b.comensal !== undefined) i.comensal = Math.min(Math.max(1, Math.floor(Number(b.comensal))), c.comensales);
    i.actualizado_en = ahora(); emitir("item", { id: c.id, numero: c.numero }); return getComanda(db, c.id);
  });
  ruta("POST", "/api/items/:id/anular", ["mesero"], (db, b, u, q, p) => {
    const { i, c } = itemDe(db, p.id); const motivo = String(b.motivo || "").trim();
    if (i.estado === "Anulado") fail(400, "El plato ya está anulado."); if (i.pagado) fail(400, "No se puede anular un plato pagado.");
    const ok = i.estado === "Pendiente" || (u.rol === "admin" && i.estado === "En preparación");
    if (!ok) fail(400, `No se puede anular: el plato está "${i.estado}".${i.estado === "En preparación" ? " Solo el administrador puede anularlo." : ""}`);
    if (i.estado !== "Pendiente" && !motivo) fail(400, "Indica el motivo de la anulación.");
    const cc = getComanda(db, c.id); if (r2(cc.total - i.cantidad * i.precio_unitario) < cc.pagado - 0.009) fail(400, "No se puede anular: el total quedaría por debajo de lo ya pagado.");
    i.estado = "Anulado"; i.nota = `${i.nota || ""} [Anulado: ${motivo || "a pedido del cliente"}]`.trim(); i.actualizado_en = ahora();
    emitir("item", { id: c.id, numero: c.numero }); return getComanda(db, c.id);
  });
  ruta("POST", "/api/comandas/:id/anular", ["mesero"], (db, b, u, q, p) => {
    const cc = getComanda(db, p.id); const c = db.comandas.find((x) => x.id === cc.id); const motivo = String(b.motivo || "").trim();
    if (c.estado !== "Abierta") fail(400, "Solo se pueden anular comandas abiertas."); if (cc.pagado > 0) fail(400, "La comanda tiene pagos registrados; no se puede anular.");
    if (cc.items.some((i) => !["Pendiente", "Anulado"].includes(i.estado)) && u.rol !== "admin") fail(400, "No se puede anular: cocina ya comenzó la preparación. Solo el administrador puede hacerlo.");
    if (!motivo) fail(400, "Indica el motivo de la anulación.");
    c.estado = "Anulada"; c.motivo_anulacion = motivo; c.cerrado_en = ahora();
    db.items.filter((i) => i.comanda_id === c.id && i.estado !== "Anulado").forEach((i) => { i.estado = "Anulado"; i.actualizado_en = ahora(); });
    emitir("comanda_anulada", { id: c.id, numero: c.numero }); return getComanda(db, c.id);
  });
  ruta("PUT", "/api/items/:id/estado", ["cocina", "mesero"], (db, b, u, q, p) => {
    const { i, c } = itemDe(db, p.id); cambiarEstado(db, i, c, b.estado, u);
    emitir("estado", { id: c.id, numero: c.numero, estado: b.estado }); return getComanda(db, c.id);
  });
  ruta("PUT", "/api/comandas/:id/estado", ["cocina", "mesero"], (db, b, u, q, p) => {
    const c = db.comandas.find((x) => x.id === Number(p.id)); if (!c) fail(404, "Comanda no encontrada.");
    const its = db.items.filter((i) => i.comanda_id === c.id && i.estado === b.desde); if (!its.length) fail(400, "No hay platos en ese estado.");
    its.forEach((i) => cambiarEstado(db, i, c, b.estado, u));
    emitir("estado", { id: c.id, numero: c.numero, estado: b.estado }); return getComanda(db, c.id);
  });

  ruta("GET", "/api/caja/actual", ["caja"], (db) => { const a = cajaAbierta(db); return a ? { ...a, resumen: resumenArqueo(db, a.id) } : null; });
  ruta("POST", "/api/caja/abrir", ["caja"], (db, b, u) => {
    if (cajaAbierta(db)) fail(400, "Ya hay una caja abierta."); const monto = r2(b.monto_inicial); if (!(monto >= 0)) fail(400, "Monto inicial no válido.");
    const a = nuevo(db, "arqueos", { cajero_id: u.id, monto_inicial: monto, abierto_en: ahora(), cerrado_en: null, estado: "Abierta" }); emitir("caja"); return { id: a.id };
  });
  ruta("POST", "/api/caja/cerrar", ["caja"], (db, b) => {
    const a0 = cajaAbierta(db); if (!a0) fail(400, "No hay una caja abierta."); const a = db.arqueos.find((x) => x.id === a0.id);
    const contado = r2(b.efectivo_contado); if (!(contado >= 0)) fail(400, "Ingresa el efectivo contado.");
    const s = resumenArqueo(db, a.id);
    Object.assign(a, { estado: "Cerrada", cerrado_en: ahora(), efectivo_esperado: s.efectivo_esperado, efectivo_contado: contado, diferencia: r2(contado - s.efectivo_esperado),
      total_efectivo: s.porMetodo.Efectivo, total_yape: s.porMetodo.Yape, total_plin: s.porMetodo.Plin, total_tarjeta: s.porMetodo.Tarjeta, total_ventas: s.total, num_pagos: s.num_pagos,
      observacion: String(b.observacion || "").trim() || null });
    emitir("caja"); return reporteArqueo(db, a.id);
  });
  ruta("GET", "/api/caja/arqueos", ["caja"], (db) => [...db.arqueos].reverse().slice(0, 60).map((a) => ({ ...a, cajero: usr(db, a.cajero_id).nombre })));
  ruta("GET", "/api/caja/arqueos/:id", ["caja"], (db, b, u, q, p) => reporteArqueo(db, p.id));
  ruta("POST", "/api/pagos", ["caja"], (db, b, u) => {
    const caja = cajaAbierta(db); if (!caja) fail(400, "Primero abre la caja del día.");
    if (!METODOS.includes(b.metodo)) fail(400, "Método de pago no válido.");
    const c = getComanda(db, b.comanda_id); const cRow = db.comandas.find((x) => x.id === c.id);
    if (c.estado !== "Abierta") fail(400, "La comanda no está pendiente de cobro."); if (c.saldo <= 0) fail(400, "La comanda no tiene saldo pendiente.");
    let monto, itemIds = [], detalle = null;
    if (b.modalidad === "Total") { monto = c.saldo; itemIds = c.items.filter((i) => !i.pagado && i.estado !== "Anulado").map((i) => i.id); }
    else if (b.modalidad === "Parcial") { monto = r2(b.monto); detalle = "Pago a cuenta"; }
    else if (b.modalidad === "Por consumo") {
      const ids = (b.item_ids || []).map(Number); const sel = c.items.filter((i) => ids.includes(i.id));
      if (!sel.length || sel.length !== ids.length) fail(400, "Selecciona los platos a cobrar.");
      if (sel.some((i) => i.pagado || i.estado === "Anulado")) fail(400, "Algún plato ya fue pagado o está anulado.");
      monto = r2(sel.reduce((a, i) => a + i.subtotal, 0)); itemIds = ids; detalle = "Comensal " + [...new Set(sel.map((i) => i.comensal))].sort().join(", ");
    } else if (b.modalidad === "Partes iguales") {
      const partes = Math.floor(Number(b.partes)), parte = Math.floor(Number(b.parte));
      if (!(partes >= 2 && partes <= 20) || !(parte >= 1 && parte <= partes)) fail(400, "División no válida.");
      monto = parte === partes ? c.saldo : r2(c.saldo / (partes - parte + 1)); detalle = `Parte ${parte} de ${partes}`;
    } else fail(400, "Modalidad de cobro no válida.");
    if (!(monto > 0)) fail(400, "Monto no válido."); if (monto > c.saldo + 0.009) fail(400, `El monto supera el saldo pendiente (S/ ${c.saldo.toFixed(2)}).`);
    let recibido = null, vuelto = null;
    if (b.metodo === "Efectivo") { recibido = b.recibido ? r2(b.recibido) : monto; if (recibido < monto - 0.009) fail(400, "El efectivo recibido es menor que el monto a cobrar."); vuelto = r2(recibido - monto); }
    const ref = String(b.referencia || "").trim().slice(0, 40) || null;
    if ((b.metodo === "Yape" || b.metodo === "Plin") && ref && !/^\d{4,12}$/.test(ref)) fail(400, "N.° de operación no válido.");
    const pg = nuevo(db, "pagos", { comanda_id: c.id, arqueo_id: caja.id, cajero_id: u.id, monto, metodo: b.metodo, modalidad: b.modalidad, detalle, recibido, vuelto, referencia: ref, creado_en: ahora() });
    itemIds.forEach((id) => { db.items.find((i) => i.id === id).pagado = 1; });
    const saldo = r2(c.saldo - monto);
    if (saldo <= 0.009) { cRow.estado = "Pagada"; cRow.cerrado_en = ahora(); db.items.filter((i) => i.comanda_id === c.id && i.estado !== "Anulado").forEach((i) => (i.pagado = 1)); }
    emitir("pago", { id: c.id, numero: c.numero });
    return { pagoId: pg.id, numero: c.numero, monto, vuelto, saldo: Math.max(0, saldo), detalle };
  });

  ruta("GET", "/api/reportes", ["caja"], (db, b, u, q) => {
    const desde = q.desde || hoy(), hasta = q.hasta || hoy();
    const pg = db.pagos.filter((p) => enRango(p.creado_en, desde, hasta));
    const cs = db.comandas.filter((c) => enRango(c.creado_en, desde, hasta));
    const ventas = r2(pg.reduce((a, p) => a + p.monto, 0));
    const comandasR = { total: cs.length, pagadas: cs.filter((c) => c.estado === "Pagada").length, anuladas: cs.filter((c) => c.estado === "Anulada").length, abiertas: cs.filter((c) => c.estado === "Abierta").length };
    const agrupar = (arr, key, val) => { const m = {}; arr.forEach((x) => { const k = key(x); m[k] = (m[k] || 0) + val(x); }); return m; };
    const porMetodo = Object.entries(agrupar(pg, (p) => p.metodo, (p) => p.monto)).map(([metodo, total]) => ({ metodo, total: r2(total), n: pg.filter((p) => p.metodo === metodo).length })).sort((a, c) => c.total - a.total);
    const porDia = Object.entries(agrupar(pg, (p) => p.creado_en.slice(0, 10), (p) => p.monto)).map(([dia, total]) => ({ dia, total: r2(total) })).sort((a, c) => a.dia.localeCompare(c.dia));
    const comandaDe = (id) => db.comandas.find((c) => c.id === id);
    const porTurno = Object.entries(agrupar(pg, (p) => comandaDe(p.comanda_id).turno, (p) => p.monto)).map(([turno, total]) => ({ turno, total: r2(total), comandas: new Set(pg.filter((p) => comandaDe(p.comanda_id).turno === turno).map((p) => p.comanda_id)).size }));
    const porHora = Object.entries(agrupar(pg, (p) => Number(p.creado_en.slice(11, 13)), (p) => p.monto)).map(([hora, total]) => ({ hora: Number(hora), total: r2(total) }));
    const ids = new Set(cs.filter((c) => c.estado !== "Anulada").map((c) => c.id)); const top = {};
    db.items.filter((i) => ids.has(i.comanda_id) && i.estado !== "Anulado").forEach((i) => {
      const p = prod(db, i.producto_id); top[p.id] ||= { nombre: p.nombre, categoria: cat(db, p.categoria_id).nombre, cantidad: 0, importe: 0 };
      top[p.id].cantidad += i.cantidad; top[p.id].importe += i.cantidad * i.precio_unitario;
    });
    const topPlatos = Object.values(top).sort((a, c) => c.cantidad - a.cantidad || c.importe - a.importe).slice(0, 10);
    const porMesero = Object.values(cs.filter((c) => c.estado !== "Anulada").reduce((m, c) => {
      const n = usr(db, c.mesero_id).nombre; m[n] ||= { nombre: n, comandas: 0, total: 0 }; m[n].comandas++;
      m[n].total = r2(m[n].total + db.pagos.filter((p) => p.comanda_id === c.id).reduce((a, p) => a + p.monto, 0)); return m;
    }, {})).sort((a, c) => c.total - a.total);
    const detalle = comandas(db, (c) => enRango(c.creado_en, desde, hasta)).map((c) => ({ id: c.id, numero: c.numero, fecha: c.creado_en, mesa: c.mesa || c.tipo, mesero: c.mesero, estado: c.estado, turno: c.turno,
      platos: c.items.filter((i) => i.estado !== "Anulado").reduce((a, i) => a + i.cantidad, 0), total: c.total, pagado: c.pagado, saldo: c.saldo, metodos: [...new Set(c.pagos.map((p) => p.metodo))].join(", ") }));
    return { desde, hasta, ventas, ticket: comandasR.pagadas ? r2(ventas / comandasR.pagadas) : 0, comandas: comandasR, porMetodo, porDia, porTurno, porHora, topPlatos, porMesero, detalle };
  });
  ruta("GET", "/api/resumen", [], (db) => {
    const esHoy = (dt) => dt && dt.slice(0, 10) === hoy();
    return {
      comandasHoy: db.comandas.filter((c) => esHoy(c.creado_en) && c.estado !== "Anulada").length,
      abiertas: db.comandas.filter((c) => c.estado === "Abierta").length,
      enCocina: db.items.filter((i) => ["Pendiente", "En preparación"].includes(i.estado)).length,
      listos: db.items.filter((i) => i.estado === "Listo").length,
      ventasHoy: r2(db.pagos.filter((p) => esHoy(p.creado_en)).reduce((a, p) => a + p.monto, 0)),
      mesasOcupadas: new Set(db.comandas.filter((c) => c.estado === "Abierta" && c.mesa_id).map((c) => c.mesa_id)).size,
      mesasTotal: db.mesas.length, caja: cajaAbierta(db) ? "Abierta" : "Cerrada", turno: turnoActual(db),
      recientes: comandas(db).slice(0, 6).map((c) => ({ numero: c.numero, mesa: c.mesa || c.tipo, estado: c.estado, total: c.total, creado_en: c.creado_en })),
    };
  });

  // ---------- Ejecutor de operaciones ----------
  function local(method, url, body) {
    const [ruta0, qs] = url.split("?");
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    const r = rutas.find((x) => x.m === method && x.re.test(ruta0));
    if (!r) return { status: 404, data: { error: "Ruta no encontrada." } };
    const prm = ruta0.match(r.re).groups || {};
    cache = null; const db = leer();
    const u = sesion();
    try {
      if (r.roles !== NADIE) {
        if (!u) fail(401, "Sesión no válida o expirada.");
        if (r.roles.length && u.rol !== "admin" && !r.roles.includes(u.rol)) fail(403, "No tienes permiso para realizar esta acción.");
      }
      const data = r.fn(db, body, u, q, prm);
      if (method !== "GET" || ruta0 === "/api/login") guardar();
      return { status: 200, data: data === undefined ? null : data };
    } catch (e) {
      if (method === "POST" && ruta0 === "/api/login") guardar(); // registra intentos fallidos
      if (e instanceof Err) return { status: e.status, data: { error: e.message } };
      console.error(e); return { status: 500, data: { error: "Error interno: " + e.message } };
    }
  }

  return { request, onEvento, reiniciar: () => { localStorage.removeItem(DB_KEY); cache = null; } };
})();
