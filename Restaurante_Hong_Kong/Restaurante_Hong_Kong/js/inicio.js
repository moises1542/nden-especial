// Inicio: resumen del día (se actualiza en tiempo real)
(async () => {
  const { $, money, esc, estadoComanda, hora } = HK;
  const me = await HK.init();

  async function cargar() {
    try {
      const r = await HK.get("/api/resumen");
      $("#kAbiertas").textContent = r.abiertas;
      $("#kCocina").textContent = r.enCocina;
      $("#kVentas").textContent = money(r.ventasHoy);
      $("#kCaja").innerHTML = r.caja === "Abierta" ? '<span class="text-success fw-semibold">abierta</span>' : '<span class="text-danger fw-semibold">cerrada</span>';
      $("#kMesas").textContent = r.mesasOcupadas;
      $("#kMesasTotal").textContent = r.mesasTotal;
      $("#kTurno").innerHTML = HK.turnoBadge(r.turno);
      $("#recientes").innerHTML = r.recientes.length
        ? r.recientes.map((c) => `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div><div class="fw-semibold small">Pedido #${c.numero} · ${esc(c.mesa)}</div><small class="text-muted">${hora(c.creado_en)} · ${money(c.total)}</small></div>${estadoComanda(c.estado)}</div>`).join("")
        : '<div class="empty-state"><i class="bi bi-inbox"></i>Todavía no hay comandas.</div>';
    } catch (e) { HK.error(e); }
  }
  const ROL = {
    admin: ["bi-shield-lock-fill", ["Supervisa pedidos, cocina y caja", "Configura la carta, horarios y usuarios", "Revisa reportes y cierres de caja"]],
    mesero: ["bi-person-badge-fill", ["Registra pedidos por mesa", "Agrega, modifica o anula platos pendientes", "Entrega los platos que cocina marque como listos"]],
    cocina: ["bi-fire", ["Recibe los pedidos al instante", "Cambia el estado: en preparación → listo", "Atiende primero los pedidos demorados"]],
    caja: ["bi-cash-stack", ["Abre la caja con el fondo inicial", "Cobra y divide cuentas (efectivo, Yape, Plin, tarjeta)", "Imprime boletas y realiza el arqueo de cierre"]],
  }[me.rol];
  $("#rbIcon").className = "bi " + ROL[0];
  $("#rbRol").textContent = me.rol_nombre;
  $("#rbTareas").innerHTML = ROL[1].map((t) => `<li>${esc(t)}</li>`).join("");

  const c = me.config;
  $("#horario").innerHTML = `
    <div class="col-sm-4"><div class="p-2 rounded border bg-light"><i class="bi bi-door-open me-1 text-primary"></i>Apertura: <b>${c.hora_apertura}</b></div></div>
    <div class="col-sm-4"><div class="p-2 rounded border bg-light"><i class="bi bi-sunrise me-1 text-warning"></i>Desayunos: <b>${c.hora_apertura} – ${c.hora_inicio_almuerzo}</b></div></div>
    <div class="col-sm-4"><div class="p-2 rounded border bg-light"><i class="bi bi-sun me-1 text-primary"></i>Almuerzos: <b>${c.hora_inicio_almuerzo} – ${c.hora_cierre}</b></div></div>`;
  cargar();
  HK.onChange(cargar);
})();
