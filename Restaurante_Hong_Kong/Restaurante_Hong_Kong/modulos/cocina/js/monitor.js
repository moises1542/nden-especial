// ==========================================================
//  Monitor de cocina: recibe las comandas en tiempo real y
//  cambia el estado de cada plato.
// ==========================================================
(async () => {
  const { $, esc, estado, hora, minutosDesde } = HK;
  await HK.init();
  const LIMITE = 15; // minutos para marcar un pedido como demorado
  $("#cLimite").textContent = LIMITE;
  let comandas = [];
  const vistos = new Set();
  let primera = true;

  async function cargar() {
    try { comandas = await HK.get("/api/comandas?cocina=1"); pintar(); } catch (e) { HK.error(e); }
  }

  function pintar() {
    const fe = document.querySelector("input[name=fe]:checked").value;
    const ft = $("#fTipo").value; const fturno = $("#fTurno").value;
    const activos = (c) => c.items.filter((i) => ["Pendiente", "En preparación", "Listo"].includes(i.estado));
    let tPend = 0, tPrep = 0, tList = 0, tTarde = 0;
    comandas.forEach((c) => c.items.forEach((i) => { if (i.estado === "Pendiente") tPend += i.cantidad; if (i.estado === "En preparación") tPrep += i.cantidad; if (i.estado === "Listo") tList += i.cantidad; }));

    const lista = comandas
      .filter((c) => (!ft || c.tipo === ft) && (!fturno || c.turno === fturno))
      .filter((c) => fe === "activos" || c.items.some((i) => i.estado === fe))
      .sort((a, b) => a.id - b.id);

    $("#board").innerHTML = lista.length ? lista.map((c) => {
      const its = activos(c);
      const pend = its.filter((i) => i.estado === "Pendiente").length;
      const prep = its.filter((i) => i.estado === "En preparación").length;
      const desde = its.filter((i) => i.estado !== "Listo").map((i) => i.creado_en).sort()[0] || c.creado_en;
      const min = minutosDesde(desde);
      const tarde = min >= LIMITE && (pend || prep);
      if (tarde) tTarde++;
      const clase = pend ? "" : prep ? "is-cooking" : "is-ready";
      const nuevo = !primera && !vistos.has(c.id + ":" + its.length) ? "is-new" : "";
      vistos.add(c.id + ":" + its.length);
      return `<article class="ticket ${clase} ${tarde ? "is-late" : ""} ${nuevo}">
        <div class="ticket-head d-flex justify-content-between align-items-start">
          <div><div class="fw-bold">#${c.numero} · ${esc(c.mesa || c.tipo)}</div>
            <small class="text-muted">${esc(c.tipo)} · ${esc(c.mesero)} · ${hora(c.creado_en)}</small></div>
          <span class="timer badge ${tarde ? "text-bg-danger" : "text-bg-light border"}"><i class="bi bi-stopwatch me-1"></i>${min} min</span>
        </div>
        <div class="ticket-body">
          ${c.observacion ? `<div class="k-note d-block my-1"><i class="bi bi-exclamation-circle me-1"></i>${esc(c.observacion)}</div>` : ""}
          ${c.items.filter((i) => i.estado !== "Entregado").map((i) => `<div class="k-item d-flex gap-2 align-items-start ${i.estado === "Anulado" ? "anulado" : ""}">
            <span class="k-qty">${i.cantidad}×</span>
            <div class="flex-grow-1"><div class="fw-medium">${esc(i.producto)}</div>${i.nota ? `<span class="k-note"><i class="bi bi-chat-left-text me-1"></i>${esc(i.nota)}</span>` : ""}</div>
            <div class="text-end">${estado(i.estado)}
              ${i.estado === "Pendiente" ? `<button class="btn btn-sm btn-link p-0 d-block ms-auto" data-item="${i.id}" data-to="En preparación">Iniciar</button>` : ""}
              ${i.estado === "En preparación" ? `<button class="btn btn-sm btn-link p-0 d-block ms-auto text-success" data-item="${i.id}" data-to="Listo">Listo</button>` : ""}
            </div>
          </div>`).join("")}
        </div>
        <div class="ticket-foot d-flex gap-2">
          ${pend ? `<button class="btn btn-sm btn-info text-white flex-fill" data-c="${c.id}" data-from="Pendiente" data-to="En preparación"><i class="bi bi-play-fill me-1"></i>Iniciar todo</button>` : ""}
          ${prep ? `<button class="btn btn-sm btn-success flex-fill" data-c="${c.id}" data-from="En preparación" data-to="Listo"><i class="bi bi-check2 me-1"></i>Todo listo</button>` : ""}
          ${!pend && !prep ? `<button class="btn btn-sm btn-outline-secondary flex-fill" data-c="${c.id}" data-from="Listo" data-to="Entregado"><i class="bi bi-check2-all me-1"></i>Entregado</button>` : ""}
        </div>
      </article>`;
    }).join("") : '<div class="card shadow-sm" style="grid-column:1/-1"><div class="empty-state"><i class="bi bi-cup-hot"></i>No hay pedidos para preparar.</div></div>';

    $("#cPend").textContent = tPend; $("#cPrep").textContent = tPrep; $("#cListo").textContent = tList; $("#cTarde").textContent = tTarde;
    primera = false;
  }

  $("#board").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-to]"); if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.item) await HK.put(`/api/items/${b.dataset.item}/estado`, { estado: b.dataset.to });
      else await HK.put(`/api/comandas/${b.dataset.c}/estado`, { desde: b.dataset.from, estado: b.dataset.to });
      await cargar();
    } catch (err) { HK.error(err); b.disabled = false; }
  });
  document.querySelectorAll("input[name=fe]").forEach((r) => r.addEventListener("change", pintar));
  $("#fTipo").addEventListener("change", pintar);
  $("#fTurno").addEventListener("change", pintar);

  await cargar();
  HK.onChange(cargar);
  setInterval(pintar, 30000); // refresca los cronómetros
})();
