// ==========================================================
//  Comandas: registro, menú por horario, modificar/anular
//  platos según su estado y entrega al cliente.
// ==========================================================
(async () => {
  const { $, $$, money, esc, estado, estadoComanda, hora } = HK;
  const me = await HK.init();

  const st = { menu: [], turno: null, mesas: [], carrito: [], editando: null };

  // ---------- Carta según horario (select agrupado por categoría) ----------
  async function cargarMenu() {
    const r = await HK.get("/api/menu");
    st.menu = r.productos; st.turno = r.turno;
    $("#menuTurno").innerHTML = HK.turnoBadge(r.turno);
    const prev = $("#producto").value;
    const cats = [...new Set(st.menu.map((p) => p.categoria))];
    $("#producto").innerHTML = st.menu.length
      ? cats.map((c) => `<optgroup label="${esc(c)}">${st.menu.filter((p) => p.categoria === c).map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</optgroup>`).join("")
      : `<option value="">${st.turno ? "Sin platos disponibles" : "Fuera del horario de atención"}</option>`;
    if (st.menu.some((p) => String(p.id) === prev)) $("#producto").value = prev;
    actualizarPrecio();
  }
  const productoSel = () => st.menu.find((p) => p.id === Number($("#producto").value));
  function actualizarPrecio() {
    const p = productoSel();
    $("#precio").value = money(p ? p.precio : 0);
    $("#btnAgregar").disabled = !p;
  }
  $("#producto").addEventListener("change", actualizarPrecio);

  // ---------- Mesas ----------
  async function cargarMesas() {
    st.mesas = await HK.get("/api/mesas");
    const sel = $("#mesa").value;
    $("#mesa").innerHTML = st.mesas.map((m) => `<option value="${m.id}" ${m.comanda_id ? 'data-ocupada="1"' : ""}>${esc(m.nombre)}${m.comanda_id ? ` — ocupada (#${m.comanda_numero})` : ""}</option>`).join("");
    const libre = st.mesas.find((m) => String(m.id) === sel && !m.comanda_id) || st.mesas.find((m) => !m.comanda_id);
    if (libre) $("#mesa").value = libre.id;
    $("#mesas").innerHTML = st.mesas.map((m) => `<button type="button" class="mesa ${m.comanda_id ? "ocupada" : ""} ${String(m.id) === $("#mesa").value && !st.editando ? "selected" : ""}" data-mesa="${m.id}"
      title="${m.comanda_id ? "Ocupada · pedido #" + m.comanda_numero : "Libre · " + m.capacidad + " personas"}"><i class="bi ${m.comanda_id ? "bi-people-fill" : "bi-square"}"></i>${esc(m.nombre.replace("Mesa ", "Mesa "))}</button>`).join("");
  }
  async function elegirMesa(id) {
    const m = st.mesas.find((x) => x.id === Number(id));
    if (m.comanda_id) {
      const ok = await HK.ask({ title: `${m.nombre} ocupada`, message: `La mesa tiene el pedido <b>#${m.comanda_numero}</b> abierto. ¿Deseas agregar platos a ese pedido?`, okText: "Agregar platos" });
      if (ok) iniciarEdicion(m.comanda_id); else cargarMesas();
      return;
    }
    $("#tipo").value = "Salón"; $("#mesaWrap").classList.remove("d-none");
    $("#mesa").value = m.id; cargarMesas(); validar();
  }
  $("#mesas").addEventListener("click", (e) => { const b = e.target.closest("[data-mesa]"); if (b && !st.editando) elegirMesa(b.dataset.mesa); });
  $("#mesa").addEventListener("change", (e) => elegirMesa(e.target.value));
  $("#tipo").addEventListener("change", () => { $("#mesaWrap").classList.toggle("d-none", $("#tipo").value !== "Salón"); validar(); });
  $("#comensales").addEventListener("input", () => { pintarComensales(); pintarCarrito(); });

  // ---------- Detalle del pedido ----------
  const nComensales = () => Math.max(1, Math.min(20, Number($("#comensales").value) || 1));
  function pintarComensales() {
    const n = nComensales(); const v = Number($("#comensal").value) || 1;
    $("#comensal").innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">Comensal ${i + 1}</option>`).join("");
    $("#comensal").value = Math.min(v, n); $("#comensal").disabled = n === 1;
  }
  $("#btnAgregar").addEventListener("click", () => {
    const p = productoSel(); if (!p) return;
    const cantidad = Math.max(1, Math.min(50, Number($("#cantidad").value) || 1));
    const nota = $("#nota").value.trim(); const comensal = Number($("#comensal").value) || 1;
    const igual = st.carrito.find((l) => l.producto_id === p.id && l.nota === nota && l.comensal === comensal);
    if (igual) igual.cantidad = Math.min(50, igual.cantidad + cantidad);
    else st.carrito.push({ key: Date.now() + Math.random(), producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad, nota, comensal });
    $("#cantidad").value = 1; $("#nota").value = "";
    pintarCarrito();
  });
  function pintarCarrito() {
    const n = nComensales();
    st.carrito.forEach((l) => { if (l.comensal > n) l.comensal = 1; });
    $("#carrito").innerHTML = st.carrito.length ? st.carrito.map((l) => `<tr data-key="${l.key}">
        <td><div class="fw-medium">${esc(l.nombre)}</div>${l.nota ? `<small class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${esc(l.nota)}</small>` : ""}</td>
        <td><input class="form-control form-control-sm" type="number" min="1" max="50" value="${l.cantidad}" data-f="cantidad" aria-label="Cantidad"></td>
        <td class="text-end">${money(l.precio)}</td>
        <td class="text-end fw-semibold" data-sub>${money(l.precio * l.cantidad)}</td>
        <td><select class="form-select form-select-sm" data-f="comensal" aria-label="Comensal" ${n === 1 ? "disabled" : ""}>${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${l.comensal === i + 1 ? "selected" : ""}>C${i + 1}</option>`).join("")}</select></td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger" type="button" data-del title="Quitar"><i class="bi bi-trash"></i></button></td>
      </tr>`).join("")
      : '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-basket me-1"></i>Agrega platos con el botón “Agregar plato”.</td></tr>';
    totalizar();
  }
  function totalizar() { $("#carritoTotal").textContent = money(st.carrito.reduce((a, l) => a + l.precio * l.cantidad, 0)); validar(); }
  $("#carrito").addEventListener("input", (e) => {
    const tr = e.target.closest("[data-key]"); if (!tr) return;
    const l = st.carrito.find((x) => String(x.key) === tr.dataset.key);
    if (e.target.dataset.f === "cantidad") { l.cantidad = Math.max(1, Math.min(50, Number(e.target.value) || 1)); tr.querySelector("[data-sub]").textContent = money(l.precio * l.cantidad); totalizar(); }
    if (e.target.dataset.f === "comensal") l.comensal = Number(e.target.value);
  });
  $("#carrito").addEventListener("click", (e) => {
    if (!e.target.closest("[data-del]")) return;
    const key = e.target.closest("[data-key]").dataset.key;
    st.carrito = st.carrito.filter((x) => String(x.key) !== key); pintarCarrito();
  });
  function validar() {
    const okMesa = st.editando || $("#tipo").value !== "Salón" || !$("#mesa").selectedOptions[0]?.dataset.ocupada;
    $("#btnRegistrar").disabled = !st.carrito.length || !okMesa;
  }

  // ---------- Agregar platos a un pedido existente ----------
  async function iniciarEdicion(id) {
    const c = await HK.get("/api/comandas/" + id);
    st.editando = c; st.carrito = [];
    $("#builderTitle").textContent = `Agregar platos al pedido #${c.numero}`;
    $("#builderSub").textContent = `${c.mesa || c.tipo} · ${c.cliente} · los nuevos platos se envían a cocina.`;
    $("#datosComanda").classList.add("d-none"); $("#datosPago").classList.add("d-none");
    $("#comensales").value = c.comensales; pintarComensales();
    $("#btnRegistrar").textContent = "Agregar al pedido";
    pintarCarrito(); cargarMesas();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function limpiar() {
    st.editando = null; st.carrito = [];
    $("#builderTitle").textContent = "Registrar nuevo pedido";
    $("#builderSub").textContent = "Complete la información para registrar el pedido.";
    $("#datosComanda").classList.remove("d-none"); $("#datosPago").classList.remove("d-none");
    $("#btnRegistrar").textContent = "Guardar pedido";
    $("#cliente").value = "Cliente general"; $("#comensales").value = 1; $("#metodo").value = ""; $("#observacion").value = "";
    $("#cantidad").value = 1; $("#nota").value = "";
    pintarComensales(); pintarCarrito(); cargarMesas();
  }
  $("#btnCancelar").addEventListener("click", async () => {
    if (st.carrito.length && !(await HK.confirmar("Cancelar pedido", "Se descartarán los platos agregados.", "Descartar", "btn-secondary"))) return;
    limpiar();
  });

  $("#btnRegistrar").addEventListener("click", async () => {
    const btn = $("#btnRegistrar"); btn.disabled = true;
    const items = st.carrito.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, nota: l.nota, comensal: l.comensal }));
    try {
      if (st.editando) {
        await HK.post(`/api/comandas/${st.editando.id}/items`, { items, comensales: nComensales() });
        HK.toast(`Platos agregados al pedido #${st.editando.numero}. Cocina fue notificada.`);
      } else {
        const c = await HK.post("/api/comandas", {
          tipo: $("#tipo").value, mesa_id: Number($("#mesa").value), cliente: $("#cliente").value, comensales: nComensales(),
          metodo_sugerido: $("#metodo").value || null, observacion: $("#observacion").value, items,
        });
        HK.toast(`Pedido #${c.numero} guardado y enviado a cocina · ${money(c.total)}`);
      }
      limpiar(); cargarComandas();
    } catch (e) { HK.error(e); validar(); }
  });

  // ---------- Listado de comandas ----------
  async function cargarComandas() {
    const est = $("#filtroEstado").value;
    const q = new URLSearchParams({ estado: est });
    if (est !== "Abierta") { q.set("desde", HK.hoyISO()); q.set("hasta", HK.hoyISO()); }
    if ($("#soloMias").checked) q.set("mias", 1);
    try {
      const lista = await HK.get("/api/comandas?" + q);
      $("#comandas").innerHTML = lista.length ? lista.map(tarjeta).join("") : '<div class="col-12"><div class="empty-state"><i class="bi bi-inbox"></i>No hay comandas para este filtro.</div></div>';
    } catch (e) { HK.error(e); }
  }
  function tarjeta(c) {
    const abierta = c.estado === "Abierta";
    const listos = c.items.filter((i) => i.estado === "Listo").length;
    const puedeAnular = abierta && !c.pagado && (me.rol === "admin" || c.items.every((i) => ["Pendiente", "Anulado"].includes(i.estado)));
    return `<div class="col-12 col-lg-6 col-xxl-4"><div class="card h-100">
      <div class="card-header bg-white d-flex justify-content-between align-items-start">
        <div><div class="fw-semibold">#${c.numero} · ${esc(c.mesa || c.tipo)}</div>
          <small class="text-muted">${esc(c.cliente)} · ${c.comensales} comensal(es) · ${hora(c.creado_en)} · ${esc(c.mesero)}</small></div>
        ${estadoComanda(c.estado)}
      </div>
      <div class="card-body py-2">
        ${c.items.map((i) => `<div class="d-flex align-items-center gap-2 py-1 border-bottom small ${i.estado === "Anulado" ? "opacity-50 text-decoration-line-through" : ""}">
          <span class="fw-semibold">${i.cantidad}×</span>
          <span class="flex-grow-1">${esc(i.producto)}${c.comensales > 1 ? ` <span class="badge text-bg-light border">C${i.comensal}</span>` : ""}${i.nota ? `<br><small class="text-muted">${esc(i.nota)}</small>` : ""}</span>
          ${estado(i.estado)}${i.pagado ? '<i class="bi bi-check-circle-fill text-success" title="Pagado"></i>' : ""}
          ${abierta && !i.pagado && i.estado !== "Anulado" ? `<div class="dropdown"><button class="btn btn-sm btn-light py-0" data-bs-toggle="dropdown" aria-label="Acciones"><i class="bi bi-three-dots-vertical"></i></button>
            <ul class="dropdown-menu dropdown-menu-end small">
              ${i.estado === "Pendiente" ? `<li><button class="dropdown-item" data-act="editar" data-item="${i.id}" data-c="${c.id}"><i class="bi bi-pencil me-2"></i>Modificar</button></li>` : `<li><button class="dropdown-item" data-act="editar" data-item="${i.id}" data-c="${c.id}"><i class="bi bi-person me-2"></i>Cambiar comensal</button></li>`}
              ${i.estado === "Listo" ? `<li><button class="dropdown-item" data-act="entregar" data-item="${i.id}"><i class="bi bi-check2-all me-2"></i>Marcar entregado</button></li>` : ""}
              ${i.estado === "Pendiente" || (me.rol === "admin" && i.estado === "En preparación") ? `<li><button class="dropdown-item text-danger" data-act="anular-item" data-item="${i.id}" data-estado="${i.estado}"><i class="bi bi-x-circle me-2"></i>Anular plato</button></li>` : `<li><span class="dropdown-item-text text-muted" style="font-size:.75rem">No se puede anular: ${esc(i.estado.toLowerCase())}</span></li>`}
            </ul></div>` : ""}
        </div>`).join("")}
        ${c.observacion ? `<div class="small text-muted mt-2"><i class="bi bi-chat-square-text me-1"></i>${esc(c.observacion)}</div>` : ""}
        ${c.metodo_sugerido ? `<div class="small text-muted"><i class="bi bi-wallet2 me-1"></i>Pagará con ${esc(c.metodo_sugerido)}</div>` : ""}
        ${c.motivo_anulacion ? `<div class="small text-danger mt-2"><i class="bi bi-info-circle me-1"></i>${esc(c.motivo_anulacion)}</div>` : ""}
      </div>
      <div class="card-footer bg-white d-flex flex-wrap gap-2 align-items-center">
        <div class="me-auto small"><span class="text-muted">Total</span> <b>${money(c.total)}</b>${c.pagado ? ` · <span class="text-success">pagado ${money(c.pagado)}</span>` : ""}</div>
        ${abierta && listos ? `<button class="btn btn-sm btn-success" data-act="entregar-todo" data-c="${c.id}"><i class="bi bi-check2-all me-1"></i>Entregar (${listos})</button>` : ""}
        ${abierta ? `<button class="btn btn-sm btn-outline-primary" data-act="agregar" data-c="${c.id}"><i class="bi bi-plus-lg me-1"></i>Platos</button>` : ""}
        ${puedeAnular ? `<button class="btn btn-sm btn-outline-danger" data-act="anular" data-c="${c.id}" data-n="${c.numero}"><i class="bi bi-x-lg"></i></button>` : ""}
      </div></div></div>`;
  }

  $("#comandas").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    try {
      if (act === "agregar") return iniciarEdicion(b.dataset.c);
      if (act === "editar") return abrirItem(Number(b.dataset.c), Number(b.dataset.item));
      if (act === "entregar") { await HK.put(`/api/items/${b.dataset.item}/estado`, { estado: "Entregado" }); HK.toast("Plato entregado."); }
      if (act === "entregar-todo") { await HK.put(`/api/comandas/${b.dataset.c}/estado`, { desde: "Listo", estado: "Entregado" }); HK.toast("Platos entregados."); }
      if (act === "anular-item") {
        const enCurso = b.dataset.estado !== "Pendiente";
        const motivo = await HK.ask({ title: "Anular plato", message: enCurso ? "El plato ya está en preparación. Indica el motivo:" : "Indica el motivo (opcional):", input: true, required: enCurso, placeholder: "Motivo", okText: "Anular", okClass: "btn-danger" });
        if (motivo === null) return;
        await HK.post(`/api/items/${b.dataset.item}/anular`, { motivo }); HK.toast("Plato anulado.", "warning");
      }
      if (act === "anular") {
        const motivo = await HK.ask({ title: `Anular comanda #${b.dataset.n}`, message: "Esta acción no se puede deshacer. Indica el motivo:", input: true, required: true, placeholder: "Ej. cliente se retiró", okText: "Anular comanda", okClass: "btn-danger" });
        if (!motivo) return;
        await HK.post(`/api/comandas/${b.dataset.c}/anular`, { motivo }); HK.toast("Comanda anulada.", "warning");
      }
      cargarComandas(); cargarMesas();
    } catch (err) { HK.error(err); }
  });

  // ---------- Modificar plato ----------
  async function abrirItem(cid, itemId) {
    const c = await HK.get("/api/comandas/" + cid);
    const i = c.items.find((x) => x.id === itemId);
    const pend = i.estado === "Pendiente";
    $("#itemId").value = i.id;
    $("#itemNombre").textContent = i.producto;
    $("#itemEstado").innerHTML = "Estado: " + estado(i.estado);
    $("#itemCantidad").value = i.cantidad; $("#itemCantidad").disabled = !pend;
    $("#itemNota").value = (i.nota || "").replace(/\s*\[Anulado:.*\]$/, ""); $("#itemNota").disabled = !pend;
    $("#itemComensal").innerHTML = Array.from({ length: c.comensales }, (_, k) => `<option value="${k + 1}" ${i.comensal === k + 1 ? "selected" : ""}>Comensal ${k + 1}</option>`).join("");
    $("#itemAyuda").textContent = pend ? "El plato aún no entra a preparación: puedes cambiar cantidad y nota." : "Cocina ya inició este plato: solo puedes reasignar el comensal.";
    bootstrap.Modal.getOrCreateInstance($("#itemModal")).show();
  }
  $("#itemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { comensal: Number($("#itemComensal").value) };
    if (!$("#itemCantidad").disabled) { body.cantidad = Number($("#itemCantidad").value); body.nota = $("#itemNota").value; }
    try {
      await HK.put("/api/items/" + $("#itemId").value, body);
      bootstrap.Modal.getInstance($("#itemModal")).hide();
      HK.toast("Plato actualizado."); cargarComandas();
    } catch (err) { HK.error(err); }
  });

  $("#filtroEstado").addEventListener("change", cargarComandas);
  $("#soloMias").addEventListener("change", cargarComandas);

  await Promise.all([cargarMenu(), cargarMesas(), cargarComandas()]);
  pintarComensales(); pintarCarrito();
  HK.onChange((d) => { cargarComandas(); cargarMesas(); if (d.type === "menu" || d.type === "config") cargarMenu(); });
  setInterval(cargarMenu, 60000); // cambia de turno automáticamente
})();
