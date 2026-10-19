// ==========================================================
//  Reportes de ventas: por día/hora, medio de pago, turno,
//  platos más vendidos, meseros y detalle exportable.
// ==========================================================
(async () => {
  const { $, $$, money, esc, estadoComanda, fecha, hora } = HK;
  await HK.init();
  let data = null; let serie = "dia";

  function rango(r) {
    const h = new Date(); const d = new Date();
    if (r === "mes") d.setDate(1); else d.setDate(d.getDate() - Number(r));
    const iso = (x) => { x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
    $("#desde").value = iso(d); $("#hasta").value = iso(h);
  }

  async function cargar() {
    try {
      data = await HK.get(`/api/reportes?desde=${$("#desde").value}&hasta=${$("#hasta").value}`);
      pintar();
    } catch (e) { HK.error(e); }
  }

  const barra = (label, valor, max, extra = "") => `<div class="bar-row"><span class="text-truncate">${esc(label)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${max ? (valor / max) * 100 : 0}%"></div></div><span class="text-end fw-semibold">${extra || money(valor)}</span></div>`;

  function pintarSerie() {
    let puntos;
    if (serie === "dia") {
      // completa los días sin ventas
      const mapa = Object.fromEntries(data.porDia.map((d) => [d.dia, d.total]));
      puntos = []; const d = new Date(data.desde + "T00:00"); const fin = new Date(data.hasta + "T00:00");
      while (d <= fin && puntos.length < 62) { const k = d.toISOString().slice(0, 10); puntos.push({ l: k.slice(8, 10) + "/" + k.slice(5, 7), v: mapa[k] || 0 }); d.setDate(d.getDate() + 1); }
    } else {
      const mapa = Object.fromEntries(data.porHora.map((h) => [h.hora, h.total]));
      puntos = Array.from({ length: 14 }, (_, i) => ({ l: String(i + 6).padStart(2, "0") + "h", v: mapa[i + 6] || 0 }));
    }
    const max = Math.max(...puntos.map((p) => p.v), 1);
    $("#tituloSerie").textContent = serie === "dia" ? "Ventas por día" : "Ventas por hora del día";
    $("#serie").innerHTML = puntos.map((p) => `<div class="chart-col" style="height:${(p.v / max) * 100}%" title="${p.l}: ${money(p.v)}"></div>`).join("");
    const paso = Math.ceil(puntos.length / 8);
    $("#serieEje").innerHTML = puntos.filter((_, i) => i % paso === 0).map((p) => `<span>${p.l}</span>`).join("");
  }

  function pintar() {
    const d = data;
    $("#rVentas").textContent = money(d.ventas);
    $("#rPagadas").textContent = d.comandas.pagadas || 0;
    $("#rAbiertas").textContent = d.comandas.abiertas || 0;
    $("#rTicket").textContent = money(d.ticket);
    $("#rAnuladas").textContent = d.comandas.anuladas || 0;
    $("#rRango").textContent = `${fecha(d.desde)} al ${fecha(d.hasta)}`;
    pintarSerie();

    const maxM = Math.max(...d.porMetodo.map((m) => m.total), 0);
    $("#metodos").innerHTML = d.porMetodo.length ? d.porMetodo.map((m) => barra(m.metodo, m.total, maxM)).join("") + `<div class="small text-muted mt-2">${d.porMetodo.reduce((a, m) => a + m.n, 0)} pagos en total</div>` : '<p class="text-muted small mb-0">Sin cobros en el periodo.</p>';
    const maxT = Math.max(...d.porTurno.map((t) => t.total), 0);
    $("#turnos").innerHTML = d.porTurno.length ? d.porTurno.map((t) => barra(t.turno[0].toUpperCase() + t.turno.slice(1), t.total, maxT)).join("") : '<p class="text-muted small mb-0">Sin datos.</p>';

    const maxP = Math.max(...d.topPlatos.map((p) => p.cantidad), 0);
    $("#top").innerHTML = d.topPlatos.length ? d.topPlatos.map((p, i) => `<tr><td>${i + 1}</td><td class="fw-medium">${esc(p.nombre)}</td><td class="text-muted">${esc(p.categoria)}</td>
      <td class="text-end fw-semibold">${p.cantidad}</td><td class="text-end">${money(p.importe)}</td><td><div class="bar-track"><div class="bar-fill" style="width:${(p.cantidad / maxP) * 100}%"></div></div></td></tr>`).join("")
      : '<tr><td colspan="6" class="text-center text-muted py-3">Sin ventas en el periodo.</td></tr>';
    $("#meseros").innerHTML = d.porMesero.length ? d.porMesero.map((m) => `<tr><td>${esc(m.nombre)}</td><td class="text-end">${m.comandas}</td><td class="text-end">${money(m.total)}</td></tr>`).join("") : '<tr><td colspan="3" class="text-muted">Sin datos.</td></tr>';
    $("#detalle").innerHTML = d.detalle.length ? d.detalle.map((c) => `<tr><td>#${c.numero}</td><td>${fecha(c.fecha)} ${hora(c.fecha)}</td><td>${esc(c.mesa)}</td><td class="text-capitalize">${c.turno}</td><td>${esc(c.mesero)}</td>
      <td class="text-end">${c.platos}</td><td class="text-end">${money(c.total)}</td><td class="text-end">${money(c.pagado)}</td><td>${esc(c.metodos) || "—"}</td><td>${estadoComanda(c.estado)}</td></tr>`).join("")
      : '<tr><td colspan="10" class="text-center text-muted py-4">No hay comandas en el periodo.</td></tr>';
  }

  $("#btnCsv").addEventListener("click", () => {
    if (!data) return;
    const filas = [["Numero", "Fecha", "Mesa/Tipo", "Turno", "Mesero", "Platos", "Total", "Pagado", "Saldo", "Medios", "Estado"],
      ...data.detalle.map((c) => [c.numero, c.fecha, c.mesa, c.turno, c.mesero, c.platos, c.total.toFixed(2), c.pagado.toFixed(2), c.saldo.toFixed(2), c.metodos, c.estado])];
    const csv = "﻿" + filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ventas_${data.desde}_${data.hasta}.csv`; a.click();
  });

  $("#filtros").addEventListener("submit", (e) => { e.preventDefault(); cargar(); });
  $$("[data-rango]").forEach((b) => b.addEventListener("click", () => { rango(b.dataset.rango); cargar(); }));
  $$("[data-serie]").forEach((b) => b.addEventListener("click", () => { serie = b.dataset.serie; $$("[data-serie]").forEach((x) => x.classList.toggle("active", x === b)); if (data) pintarSerie(); }));

  rango(0); await cargar();
  HK.onChange((d) => { if (["pago", "comanda_nueva", "comanda_anulada"].includes(d.type)) cargar(); });
})();
