// ==========================================================
//  Caja: apertura, cobros (efectivo, Yape, Plin, tarjeta),
//  división de cuentas, pagos parciales y arqueo de cierre.
// ==========================================================
(async () => {
  const { $, $$, money, esc, estado, hora, fecha } = HK;
  await HK.init();
  const METODOS = [["Efectivo", "bi-cash"], ["Yape", "bi-phone"], ["Plin", "bi-phone-vibrate"], ["Tarjeta", "bi-credit-card"]];
  const st = { caja: null, pedidos: [], sel: null, modalidad: "Total", metodo: "Efectivo", items: new Set(), partes: 2 };

  // ---------- Estado de la caja ----------
  async function cargarCaja() {
    st.caja = await HK.get("/api/caja/actual");
    const c = st.caja;
    if (!c) {
      $("#cajaEstado").innerHTML = `<form class="row g-2 align-items-end" id="abrirForm">
        <div class="col-12 col-md-5"><div class="d-flex align-items-center gap-3"><i class="bi bi-lock-fill fs-2 text-danger"></i>
          <div><div class="fw-semibold">Caja cerrada</div><small class="text-muted">Abre la caja para empezar a registrar cobros.</small></div></div></div>
        <div class="col-6 col-md-3"><label class="form-label small text-muted" for="montoInicial">Fondo inicial (S/)</label><input class="form-control" id="montoInicial" type="number" min="0" step="0.10" value="100" required></div>
        <div class="col-6 col-md-2 d-grid"><button class="btn btn-success" type="submit"><i class="bi bi-unlock me-1"></i>Abrir caja</button></div>
      </form>`;
      $("#abrirForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { await HK.post("/api/caja/abrir", { monto_inicial: Number($("#montoInicial").value) }); HK.toast("Caja abierta."); cargarCaja(); }
        catch (err) { HK.error(err); }
      });
      return;
    }
    const r = c.resumen;
    $("#cajaEstado").innerHTML = `<div class="row g-3 align-items-center">
      <div class="col-12 col-lg-3"><div class="d-flex align-items-center gap-3"><i class="bi bi-unlock-fill fs-2 text-success"></i>
        <div><div class="fw-semibold">Caja abierta</div><small class="text-muted">${esc(c.cajero)} · desde ${fecha(c.abierto_en)} ${hora(c.abierto_en)}</small></div></div></div>
      ${METODOS.map(([m, ic]) => `<div class="col-6 col-md-3 col-lg"><div class="small text-muted"><i class="bi ${ic} me-1"></i>${m}</div><div class="fw-bold">${money(r.porMetodo[m])}</div></div>`).join("")}
      <div class="col-6 col-md-3 col-lg"><div class="small text-muted">Total cobrado</div><div class="fw-bold text-primary">${money(r.total)}</div></div>
      <div class="col-12 col-lg-auto d-grid"><button class="btn btn-outline-primary" id="btnCerrar"><i class="bi bi-safe me-1"></i>Arqueo y cierre</button></div>
    </div>
    <div class="small text-muted mt-2">Fondo inicial ${money(c.monto_inicial)} · Efectivo esperado en caja <b>${money(r.efectivo_esperado)}</b> · ${r.num_pagos} pago(s)</div>`;
    $("#btnCerrar").addEventListener("click", abrirCierre);
  }

  // ---------- Pedidos del día (tabla) ----------
  function estadoEntrega(c) {
    if (c.estado === "Anulada") return "Anulado";
    const its = c.items.filter((i) => i.estado !== "Anulado");
    if (its.length && its.every((i) => i.estado === "Entregado")) return "Entregado";
    if (its.some((i) => i.estado === "En preparación")) return "En preparación";
    if (its.length && its.every((i) => ["Listo", "Entregado"].includes(i.estado))) return "Listo";
    return "Pendiente";
  }
  async function cargarPedidos() {
    const hoy = HK.hoyISO();
    const [abiertas, deHoy, resumen] = await Promise.all([
      HK.get("/api/comandas?estado=Abierta"),
      HK.get(`/api/comandas?estado=Todas&desde=${hoy}&hasta=${hoy}`),
      HK.get("/api/resumen"),
    ]);
    const mapa = new Map([...deHoy, ...abiertas].map((c) => [c.id, c]));
    st.pedidos = [...mapa.values()].sort((a, b) => b.id - a.id);
    const validos = deHoy.filter((c) => c.estado !== "Anulada");
    $("#kVentas").textContent = money(resumen.ventasHoy);
    $("#kPendientes").textContent = st.pedidos.filter((c) => c.estado !== "Anulada" && estadoEntrega(c) !== "Entregado").length;
    $("#kEntregados").textContent = validos.filter((c) => estadoEntrega(c) === "Entregado").length;
    $("#nCobrar").textContent = st.pedidos.filter((c) => c.estado === "Abierta" && c.saldo > 0).length;
    if (st.sel) st.sel = st.pedidos.find((c) => c.id === st.sel.id) || null;
    pintarPedidos();
  }
  function pintarPedidos() {
    const vista = document.querySelector("input[name=vista]:checked").value;
    const q = $("#buscar").value.trim().toLowerCase();
    const l = st.pedidos
      .filter((c) => vista === "hoy" || (c.estado === "Abierta" && c.saldo > 0))
      .filter((c) => `${c.numero} ${c.mesa || c.tipo} ${c.cliente}`.toLowerCase().includes(q));
    $("#ventas").innerHTML = l.length ? l.map((c) => {
      const ent = estadoEntrega(c);
      const pago = c.estado === "Anulada" ? '<span class="text-muted small">—</span>'
        : c.saldo <= 0 ? '<span class="pago-badge pagado">Pagado</span>'
        : c.pagado > 0 ? '<span class="pago-badge porcobrar">Pago parcial</span>' : '<span class="pago-badge porcobrar">Por cobrar</span>';
      return `<tr data-id="${c.id}" class="${st.sel && st.sel.id === c.id ? "selected" : ""}">
        <td class="fw-semibold">#${c.numero}</td><td>${esc(c.mesa || c.tipo)}</td><td>${esc(c.cliente)}</td>
        <td class="text-end">${money(c.total)}</td><td class="text-end ${c.saldo > 0 ? "fw-semibold" : "text-muted"}">${money(c.saldo)}</td>
        <td><span class="estado estado-${ent.replace(/ /g, "-")}">${ent}</span></td><td>${pago}</td><td>${hora(c.creado_en)}</td></tr>`;
    }).join("") : `<tr><td colspan="8" class="text-center text-muted py-4">${vista === "hoy" ? "Aún no hay pedidos hoy." : "No hay pedidos pendientes de cobro."}</td></tr>`;
    actualizarAcciones();
  }
  function actualizarAcciones() {
    const c = st.sel;
    $("#btnCobrar").disabled = !c || c.estado !== "Abierta" || c.saldo <= 0;
    $("#btnBoleta").disabled = !c || c.estado === "Anulada";
    $("#seleccionInfo").innerHTML = c ? `Seleccionado: <b>pedido #${c.numero}</b> · ${esc(c.mesa || c.tipo)} · saldo ${money(c.saldo)}${c.metodo_sugerido ? ` · el cliente indicó pagar con <b>${esc(c.metodo_sugerido)}</b>` : ""}` : "Selecciona un pedido de la tabla.";
  }
  $("#ventas").addEventListener("click", (e) => {
    const tr = e.target.closest("[data-id]"); if (!tr) return;
    st.sel = st.pedidos.find((c) => c.id === Number(tr.dataset.id));
    pintarPedidos();
  });
  $("#ventas").addEventListener("dblclick", (e) => { if (e.target.closest("[data-id]") && !$("#btnCobrar").disabled) abrirCobro(); });
  document.querySelectorAll("input[name=vista]").forEach((r) => r.addEventListener("change", pintarPedidos));
  $("#buscar").addEventListener("input", pintarPedidos);
  $("#btnActualizar").addEventListener("click", async () => { await Promise.all([cargarPedidos(), cargarCaja()]); HK.toast("Ventas actualizadas."); });
  $("#btnCobrar").addEventListener("click", abrirCobro);
  $("#btnBoleta").addEventListener("click", () => imprimirBoleta(st.sel));

  function abrirCobro() {
    const c = st.sel; if (!c) return;
    st.items = new Set(); st.modalidad = "Total";
    st.metodo = c.metodo_sugerido || "Efectivo";
    const iguales = c.pagos.filter((p) => p.modalidad === "Partes iguales");
    st.partes = iguales.length ? Number(iguales.at(-1).detalle.split(" de ")[1]) : Math.max(2, c.comensales);
    pintarCobro();
    bootstrap.Modal.getOrCreateInstance($("#cobroModal")).show();
  }

  // Boleta interna de venta (sin valor tributario: SUNAT está fuera del alcance)
  function imprimirBoleta(c) {
    if (!c) return;
    const its = c.items.filter((i) => i.estado !== "Anulado");
    const pagada = c.saldo <= 0;
    const html = `<div style="max-width:320px;margin:auto;font-family:Inter,Arial,sans-serif;font-size:12px">
      <div style="text-align:center"><img src="${new URL("../../img/logo.svg", location.href).href}" style="width:90px"><div style="font-weight:700;font-size:15px;margin-top:4px">HONG KONG</div>
      <div>Restaurant · Cevichería</div><div style="margin:6px 0;font-weight:700">${pagada ? "BOLETA DE VENTA INTERNA" : "PRE-CUENTA"}</div>
      <div>N.° ${c.numero} · ${fecha(c.creado_en)} ${hora(c.creado_en)}</div><div>${esc(c.mesa || c.tipo)} · ${esc(c.cliente)}</div></div>
      <hr><table style="width:100%;border-collapse:collapse">${its.map((i) => `<tr><td>${i.cantidad} ${esc(i.producto)}</td><td style="text-align:right">${money(i.subtotal)}</td></tr>`).join("")}</table><hr>
      <table style="width:100%"><tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${money(c.total)}</b></td></tr>
      ${c.pagos.map((p) => `<tr><td>${p.metodo}${p.detalle ? " (" + esc(p.detalle) + ")" : ""}</td><td style="text-align:right">${money(p.monto)}</td></tr>`).join("")}
      ${c.pagos.filter((p) => p.vuelto).map((p) => `<tr><td>Vuelto</td><td style="text-align:right">${money(p.vuelto)}</td></tr>`).join("")}
      <tr><td>Saldo</td><td style="text-align:right">${money(c.saldo)}</td></tr></table><hr>
      <div style="text-align:center;font-size:10px">Atendido por ${esc(c.mesero)}<br>Documento interno sin valor tributario.<br>¡Gracias por su preferencia!</div></div>`;
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Pedido ${c.numero}</title></head><body>${html}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  }

  // ---------- Panel de cobro ----------
  function parteActual() {
    return st.sel.pagos.filter((p) => p.modalidad === "Partes iguales" && p.detalle.endsWith(" de " + st.partes)).length + 1;
  }
  function montoACobrar() {
    const c = st.sel;
    if (st.modalidad === "Total") return c.saldo;
    if (st.modalidad === "Por consumo") return c.items.filter((i) => st.items.has(i.id)).reduce((a, i) => a + i.subtotal, 0);
    if (st.modalidad === "Partes iguales") { const k = parteActual(); return k >= st.partes ? c.saldo : Math.round((c.saldo / (st.partes - k + 1)) * 100) / 100; }
    return Number($("#montoParcial")?.value || 0);
  }

  function pintarCobro() {
    const c = st.sel;
    if (!c) { $("#cobro").innerHTML = ""; return; }
    const porComensal = {};
    c.items.filter((i) => i.estado !== "Anulado").forEach((i) => { (porComensal[i.comensal] ||= []).push(i); });
    const yaParcial = c.pagos.some((p) => p.modalidad === "Parcial" || p.modalidad === "Partes iguales");

    $("#cobro").innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div><h2 class="h5 fw-bold mb-0">Comanda #${c.numero} · ${esc(c.mesa || c.tipo)}</h2>
          <small class="text-muted">${esc(c.cliente)} · ${c.comensales} comensal(es) · Mesero: ${esc(c.mesero)}</small></div>
        <div class="text-end small"><div>Total <b>${money(c.total)}</b></div><div class="text-success">Pagado ${money(c.pagado)}</div><div class="fs-5 fw-bold text-primary">Saldo ${money(c.saldo)}</div></div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="small fw-semibold text-muted mb-1">Consumo por comensal</div>
          <div class="border rounded p-2" style="max-height:290px;overflow:auto">
            ${Object.entries(porComensal).map(([n, its]) => {
              const libres = its.filter((i) => !i.pagado);
              return `<div class="mb-2">
                <div class="d-flex justify-content-between align-items-center"><span class="badge text-bg-dark">Comensal ${n}</span>
                  <span class="small">${money(its.reduce((a, i) => a + i.subtotal, 0))}
                  ${st.modalidad === "Por consumo" && libres.length ? `<button class="btn btn-link btn-sm py-0" data-comensal="${n}">Seleccionar</button>` : ""}</span></div>
                ${its.map((i) => `<label class="d-flex align-items-center gap-2 small py-1 border-bottom ${i.pagado ? "text-muted" : ""}">
                  ${st.modalidad === "Por consumo" ? `<input class="form-check-input mt-0" type="checkbox" data-item="${i.id}" ${i.pagado ? "disabled" : ""} ${st.items.has(i.id) ? "checked" : ""}>` : ""}
                  <span class="flex-grow-1">${i.cantidad}× ${esc(i.producto)}</span>${estado(i.estado)}
                  <span class="text-nowrap ${i.pagado ? "text-decoration-line-through" : ""}">${money(i.subtotal)}</span>${i.pagado ? '<i class="bi bi-check-circle-fill text-success"></i>' : ""}
                </label>`).join("")}
              </div>`;
            }).join("")}
          </div>
          ${c.pagos.length ? `<div class="small fw-semibold text-muted mt-3 mb-1">Pagos registrados</div>
            <ul class="list-group list-group-flush small">${c.pagos.map((p) => `<li class="list-group-item px-0 d-flex justify-content-between">
              <span>${hora(p.creado_en)} · ${esc(p.metodo)} · ${esc(p.modalidad)}${p.detalle ? ` <small class="text-muted">(${esc(p.detalle)})</small>` : ""}</span><b>${money(p.monto)}</b></li>`).join("")}</ul>` : ""}
        </div>

        <div class="col-12 col-lg-6">
          <ul class="nav nav-pills nav-fill split-tabs mb-3 small" role="tablist">
            ${["Total", "Por consumo", "Partes iguales", "Parcial"].map((m) => `<li class="nav-item"><button type="button" class="nav-link py-1 ${st.modalidad === m ? "active" : ""}" data-mod="${m}"
              ${m === "Por consumo" && yaParcial ? "disabled title='No disponible tras un pago a cuenta'" : ""}>${m === "Por consumo" ? "Por consumo" : m}</button></li>`).join("")}
          </ul>
          <div class="small text-muted mb-2" id="ayudaMod">${{
            "Total": "Cobra el saldo completo de la cuenta.",
            "Por consumo": "Marca los platos de cada comensal para cobrar solo lo que consumió.",
            "Partes iguales": "Divide el saldo en partes iguales y cobra cada parte por separado.",
            "Parcial": "Registra un pago a cuenta por cualquier monto.",
          }[st.modalidad]}</div>
          ${st.modalidad === "Partes iguales" ? `<div class="row g-2 mb-2 align-items-end">
            <div class="col-6"><label class="form-label small" for="nPartes">Número de partes</label><input class="form-control form-control-sm" id="nPartes" type="number" min="2" max="20" value="${st.partes}" ${c.pagos.some((p) => p.modalidad === "Partes iguales") ? "disabled" : ""}></div>
            <div class="col-6"><div class="small text-muted">Cobrando</div><div class="fw-semibold">Parte ${parteActual()} de ${st.partes}</div></div></div>` : ""}
          ${st.modalidad === "Parcial" ? `<div class="mb-2"><label class="form-label small" for="montoParcial">Monto a cuenta (S/)</label><input class="form-control" id="montoParcial" type="number" min="0.10" step="0.10" max="${c.saldo}" value="${(c.saldo / 2).toFixed(2)}"></div>` : ""}

          <div class="small fw-semibold text-muted mb-1">Método de pago</div>
          <div class="row g-2 metodo-option mb-3">
            ${METODOS.map(([m, ic]) => `<div class="col-3"><input type="radio" class="btn-check" name="metodo" id="m${m}" value="${m}" ${st.metodo === m ? "checked" : ""}>
              <label class="btn btn-outline-primary w-100" for="m${m}"><i class="bi ${ic}"></i>${m}</label></div>`).join("")}
          </div>
          <div id="metodoExtra"></div>

          <div class="saldo-box p-3 my-3 d-flex justify-content-between align-items-center"><span>A cobrar</span><span class="fs-3 fw-bold text-primary" id="aCobrar">S/ 0.00</span></div>
          <button class="btn btn-primary w-100 py-2" id="btnRegistrarCobro" ${st.caja ? "" : "disabled"}><i class="bi bi-check2-circle me-1"></i>${st.caja ? "Registrar cobro" : "Abre la caja para cobrar"}</button>
        </div>
      </div>`;
    pintarMetodo(); actualizarMonto();
  }

  function pintarMetodo() {
    const m = st.metodo;
    $("#metodoExtra").innerHTML = m === "Efectivo"
      ? `<div class="row g-2"><div class="col-6"><label class="form-label small" for="recibido">Recibido (S/)</label><input class="form-control" id="recibido" type="number" min="0" step="0.10" placeholder="Monto exacto"></div>
         <div class="col-6"><label class="form-label small">Vuelto</label><div class="form-control bg-light fw-semibold" id="vuelto">S/ 0.00</div></div></div>`
      : m === "Tarjeta"
        ? `<label class="form-label small" for="referencia">Referencia del voucher (opcional)</label><input class="form-control" id="referencia" maxlength="40" placeholder="Ej. últimos 4 dígitos / N° de lote">`
        : `<label class="form-label small" for="referencia">N.° de operación ${m} (opcional)</label><input class="form-control" id="referencia" inputmode="numeric" maxlength="12" placeholder="Ej. 123456">`;
  }
  function actualizarMonto() {
    if (!st.sel) return;
    const monto = montoACobrar();
    $("#aCobrar").textContent = money(monto);
    const rec = $("#recibido");
    if (rec) $("#vuelto").textContent = money(Math.max(0, (Number(rec.value) || monto) - monto));
    $("#btnRegistrarCobro").disabled = !st.caja || !(monto > 0) || monto > st.sel.saldo + 0.009;
  }

  $("#cobro").addEventListener("click", (e) => {
    const mod = e.target.closest("[data-mod]");
    if (mod && !mod.disabled) { st.modalidad = mod.dataset.mod; st.items = new Set(); pintarCobro(); return; }
    const com = e.target.closest("[data-comensal]");
    if (com) { st.sel.items.filter((i) => String(i.comensal) === com.dataset.comensal && !i.pagado && i.estado !== "Anulado").forEach((i) => st.items.add(i.id)); pintarCobro(); }
  });
  $("#cobro").addEventListener("change", (e) => {
    if (e.target.name === "metodo") { st.metodo = e.target.value; pintarMetodo(); actualizarMonto(); }
    if (e.target.dataset.item) { const id = Number(e.target.dataset.item); e.target.checked ? st.items.add(id) : st.items.delete(id); actualizarMonto(); }
    if (e.target.id === "nPartes") { st.partes = Math.max(2, Math.min(20, Number(e.target.value) || 2)); pintarCobro(); }
  });
  $("#cobro").addEventListener("input", (e) => { if (["montoParcial", "recibido"].includes(e.target.id)) actualizarMonto(); });

  $("#cobro").addEventListener("click", async (e) => {
    if (!e.target.closest("#btnRegistrarCobro")) return;
    const c = st.sel; const btn = $("#btnRegistrarCobro"); btn.disabled = true;
    const body = { comanda_id: c.id, modalidad: st.modalidad, metodo: st.metodo, referencia: $("#referencia")?.value };
    if (st.modalidad === "Parcial") body.monto = Number($("#montoParcial").value);
    if (st.modalidad === "Por consumo") body.item_ids = [...st.items];
    if (st.modalidad === "Partes iguales") { body.partes = st.partes; body.parte = parteActual(); }
    if (st.metodo === "Efectivo" && $("#recibido").value) body.recibido = Number($("#recibido").value);
    try {
      const r = await HK.post("/api/pagos", body);
      HK.toast(`Cobro de ${money(r.monto)} registrado${r.vuelto ? ` · Vuelto ${money(r.vuelto)}` : ""}${r.saldo > 0 ? ` · Saldo ${money(r.saldo)}` : " · Cuenta cancelada"}.`);
      st.items = new Set();
      await Promise.all([cargarPedidos(), cargarCaja()]);
      if (!st.sel || st.sel.saldo <= 0) {
        bootstrap.Modal.getInstance($("#cobroModal"))?.hide();
        const pagado = st.sel;
        if (pagado && await HK.ask({ title: "Cuenta cancelada", message: `El pedido #${pagado.numero} quedó pagado. ¿Imprimir la boleta?`, okText: "Imprimir boleta" })) imprimirBoleta(pagado);
      } else pintarCobro();
    } catch (err) { HK.error(err); btn.disabled = false; }
  });

  // ---------- Cierre y arqueo ----------
  function abrirCierre() {
    const r = st.caja.resumen;
    const pendientes = st.pedidos.filter((c) => c.estado === "Abierta" && c.saldo > 0).length;
    $("#cierreAviso").innerHTML = pendientes ? `<div class="alert alert-warning small py-2"><i class="bi bi-exclamation-triangle me-1"></i>Hay ${pendientes} cuenta(s) pendientes de cobro. Puedes cerrar igual; quedarán para la siguiente caja.</div>` : "";
    $("#cierreResumen").innerHTML = `
      <tr><td>Fondo inicial</td><td class="text-end">${money(st.caja.monto_inicial)}</td></tr>
      ${METODOS.map(([m]) => `<tr><td>Cobros en ${m}</td><td class="text-end">${money(r.porMetodo[m])}</td></tr>`).join("")}
      <tr class="fw-semibold"><td>Total cobrado</td><td class="text-end">${money(r.total)}</td></tr>
      <tr class="table-light fw-bold"><td>Efectivo esperado en caja</td><td class="text-end">${money(r.efectivo_esperado)}</td></tr>`;
    $("#contado").value = r.efectivo_esperado.toFixed(2);
    $("#observacion").value = "";
    actualizarDiferencia();
    bootstrap.Modal.getOrCreateInstance($("#cierreModal")).show();
  }
  function actualizarDiferencia() {
    const d = Number($("#contado").value || 0) - st.caja.resumen.efectivo_esperado;
    const el = $("#diferencia");
    el.textContent = (d > 0 ? "+" : "") + money(d) + (Math.abs(d) < 0.01 ? " (cuadra)" : d > 0 ? " (sobrante)" : " (faltante)");
    el.className = "form-control bg-light fw-semibold " + (Math.abs(d) < 0.01 ? "text-success" : "text-danger");
  }
  $("#contado").addEventListener("input", actualizarDiferencia);
  $("#cierreForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const rep = await HK.post("/api/caja/cerrar", { efectivo_contado: Number($("#contado").value), observacion: $("#observacion").value });
      bootstrap.Modal.getInstance($("#cierreModal")).hide();
      HK.toast("Caja cerrada. Se generó el reporte de cierre.");
      await Promise.all([cargarCaja(), cargarArqueos()]);
      mostrarReporte(rep);
    } catch (err) { HK.error(err); }
  });

  async function cargarArqueos() {
    const l = await HK.get("/api/caja/arqueos");
    $("#arqueos").innerHTML = l.length ? l.map((a) => `<tr>
      <td>${a.id}</td><td>${esc(a.cajero)}</td><td>${fecha(a.abierto_en)} ${hora(a.abierto_en)}</td>
      <td>${a.cerrado_en ? fecha(a.cerrado_en) + " " + hora(a.cerrado_en) : '<span class="badge text-bg-success">Abierta</span>'}</td>
      <td class="text-end">${a.total_ventas != null ? money(a.total_ventas) : "—"}</td>
      <td class="text-end">${a.efectivo_esperado != null ? money(a.efectivo_esperado) : "—"}</td>
      <td class="text-end">${a.efectivo_contado != null ? money(a.efectivo_contado) : "—"}</td>
      <td class="text-end ${a.diferencia ? "text-danger fw-semibold" : ""}">${a.diferencia != null ? money(a.diferencia) : "—"}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-arqueo="${a.id}"><i class="bi bi-file-earmark-text"></i></button></td></tr>`).join("")
      : '<tr><td colspan="9" class="text-center text-muted py-4">Aún no hay cierres registrados.</td></tr>';
  }
  $("#arqueos").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-arqueo]"); if (!b) return;
    try { mostrarReporte(await HK.get("/api/caja/arqueos/" + b.dataset.arqueo)); } catch (err) { HK.error(err); }
  });

  function mostrarReporte(rep) {
    const a = rep.arqueo; const r = rep.resumen;
    const dif = a.diferencia;
    $("#reporteBody").innerHTML = `
      <div class="text-center mb-3"><div class="fw-bold fs-5">RESTAURANTE HONG KONG</div><div class="small text-muted">Reporte consolidado de cierre de caja N.° ${a.id}</div></div>
      <div class="row small mb-3">
        <div class="col-6">Cajero: <b>${esc(a.cajero)}</b></div><div class="col-6 text-end">Estado: <b>${a.estado}</b></div>
        <div class="col-6">Apertura: ${fecha(a.abierto_en)} ${hora(a.abierto_en)}</div><div class="col-6 text-end">Cierre: ${a.cerrado_en ? fecha(a.cerrado_en) + " " + hora(a.cerrado_en) : "—"}</div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><table class="table table-sm small">
          <thead class="table-light"><tr><th>Medio de pago</th><th class="text-end">Importe</th></tr></thead>
          <tbody>${METODOS.map(([m]) => `<tr><td>${m}</td><td class="text-end">${money(r.porMetodo[m])}</td></tr>`).join("")}</tbody>
          <tfoot><tr class="fw-bold"><td>Total de ventas</td><td class="text-end">${money(r.total)}</td></tr></tfoot></table></div>
        <div class="col-md-6"><table class="table table-sm small">
          <thead class="table-light"><tr><th>Arqueo de efectivo</th><th class="text-end">Importe</th></tr></thead>
          <tbody><tr><td>Fondo inicial</td><td class="text-end">${money(a.monto_inicial)}</td></tr>
          <tr><td>Cobros en efectivo</td><td class="text-end">${money(r.porMetodo.Efectivo)}</td></tr>
          <tr class="fw-semibold"><td>Efectivo esperado</td><td class="text-end">${money(r.efectivo_esperado)}</td></tr>
          <tr><td>Efectivo contado</td><td class="text-end">${a.efectivo_contado != null ? money(a.efectivo_contado) : "—"}</td></tr></tbody>
          <tfoot><tr class="fw-bold ${dif ? "text-danger" : "text-success"}"><td>Diferencia</td><td class="text-end">${dif != null ? money(dif) : "—"}</td></tr></tfoot></table></div>
      </div>
      <div class="row small mb-3 text-center g-2">
        <div class="col-4"><div class="border rounded p-2"><div class="fw-bold fs-5">${r.comandas_cobradas}</div>comandas cobradas</div></div>
        <div class="col-4"><div class="border rounded p-2"><div class="fw-bold fs-5">${r.num_pagos}</div>pagos registrados</div></div>
        <div class="col-4"><div class="border rounded p-2"><div class="fw-bold fs-5">${rep.anuladas}</div>comandas anuladas</div></div>
      </div>
      ${rep.top.length ? `<div class="fw-semibold small mb-1">Platos más vendidos del turno</div><table class="table table-sm small"><tbody>${rep.top.map((t) => `<tr><td>${esc(t.nombre)}</td><td class="text-end">${t.cantidad}</td><td class="text-end">${money(t.importe)}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="fw-semibold small mb-1">Detalle de pagos</div>
      <table class="table table-sm small"><thead class="table-light"><tr><th>Hora</th><th>Comanda</th><th>Método</th><th>Modalidad</th><th class="text-end">Monto</th></tr></thead>
        <tbody>${rep.pagos.map((p) => `<tr><td>${hora(p.creado_en)}</td><td>#${p.numero}</td><td>${p.metodo}${p.referencia ? ` <small class="text-muted">${esc(p.referencia)}</small>` : ""}</td><td>${p.modalidad}${p.detalle ? ` <small class="text-muted">${esc(p.detalle)}</small>` : ""}</td><td class="text-end">${money(p.monto)}</td></tr>`).join("") || '<tr><td colspan="5" class="text-muted">Sin pagos.</td></tr>'}</tbody></table>
      ${rep.pendientes.length ? `<div class="alert alert-warning small py-2">Comandas que quedaron abiertas: ${rep.pendientes.map((n) => "#" + n).join(", ")}</div>` : ""}
      ${a.observacion ? `<div class="small"><b>Observación:</b> ${esc(a.observacion)}</div>` : ""}
      <div class="row small mt-5 text-center"><div class="col-6"><hr class="mx-4">Firma del cajero</div><div class="col-6"><hr class="mx-4">Firma del administrador</div></div>`;
    bootstrap.Modal.getOrCreateInstance($("#reporteModal")).show();
  }
  $("#btnImprimir").addEventListener("click", () => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cierre de caja</title><link rel="stylesheet" href="${new URL("../../css/bootstrap.css", location.href).href}"><link rel="stylesheet" href="${new URL("../../css/custom.css", location.href).href}"></head>
      <body class="bg-white p-4">${$("#reporteBody").innerHTML}<script>setTimeout(()=>{print();},400)<\/script></body></html>`);
    w.document.close();
  });

  await Promise.all([cargarCaja(), cargarPedidos(), cargarArqueos()]);
  HK.onChange(async (d) => {
    await cargarPedidos();
    if ($("#cobroModal").classList.contains("show") && st.sel) pintarCobro();
    if (["pago", "caja"].includes(d.type)) { cargarCaja(); cargarArqueos(); }
  });
})();
