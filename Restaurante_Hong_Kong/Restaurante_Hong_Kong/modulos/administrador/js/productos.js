// ==========================================================
//  Carta y horarios (administrador)
// ==========================================================
(async () => {
  const { $, money, esc } = HK;
  await HK.init();
  let productos = [];
  const TURNOS = { desayuno: '<span class="badge text-bg-warning">Desayuno</span>', almuerzo: '<span class="badge text-bg-primary">Almuerzo</span>', ambos: '<span class="badge text-bg-dark">Todo el día</span>' };

  async function cargarConfig() {
    const c = await HK.get("/api/config");
    $("#hApertura").value = c.hora_apertura; $("#hAlmuerzo").value = c.hora_inicio_almuerzo; $("#hCierre").value = c.hora_cierre;
    $("#validarHorario").checked = c.validar_horario;
    $("#turnoHoy").innerHTML = "Ahora: " + HK.turnoBadge(c.turno);
  }
  $("#horarioForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await HK.put("/api/config", { hora_apertura: $("#hApertura").value, hora_inicio_almuerzo: $("#hAlmuerzo").value, hora_cierre: $("#hCierre").value, validar_horario: $("#validarHorario").checked });
      HK.toast("Horarios actualizados."); cargarConfig();
    } catch (err) { HK.error(err); }
  });

  async function cargar() {
    const cats = await HK.get("/api/categorias");
    $("#prodCategoria").innerHTML = cats.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
    productos = await HK.get("/api/productos");
    pintar();
  }
  function pintar() {
    const t = $("#fTurnoProd").value; const q = $("#fBuscarProd").value.trim().toLowerCase();
    const l = productos.filter((p) => (!t || p.turno === t) && p.nombre.toLowerCase().includes(q));
    $("#productos").innerHTML = l.map((p) => `<tr class="${p.activo ? "" : "opacity-50"}">
      <td class="fw-medium">${esc(p.nombre)}</td><td>${esc(p.categoria)}</td><td>${TURNOS[p.turno]}</td>
      <td class="text-end">${money(p.precio)}</td><td class="text-end">${p.vendidos}</td>
      <td>${p.activo ? '<span class="text-success">Disponible</span>' : '<span class="text-muted">Oculto</span>'}</td>
      <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-edit="${p.id}" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm ${p.activo ? "btn-outline-danger" : "btn-outline-success"}" data-toggle="${p.id}" title="${p.activo ? "Ocultar" : "Mostrar"}"><i class="bi ${p.activo ? "bi-eye-slash" : "bi-eye"}"></i></button></td></tr>`).join("")
      || '<tr><td colspan="7" class="text-center text-muted py-4">Sin resultados.</td></tr>';
  }
  $("#fTurnoProd").addEventListener("change", pintar);
  $("#fBuscarProd").addEventListener("input", pintar);

  const datos = () => ({ nombre: $("#prodNombre").value, categoria_id: Number($("#prodCategoria").value), precio: Number($("#prodPrecio").value), turno: $("#prodTurno").value, activo: $("#prodActivo").checked });
  $("#prodForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("#prodId").value;
    try {
      if (id) await HK.put("/api/productos/" + id, datos()); else await HK.post("/api/productos", datos());
      HK.toast(id ? "Plato actualizado." : "Plato agregado a la carta.");
      $("#prodReset").click(); cargar();
    } catch (err) { HK.error(err); }
  });
  $("#prodReset").addEventListener("click", () => { $("#prodId").value = ""; $("#prodTitulo").innerHTML = '<i class="bi bi-plus-circle me-1 text-primary"></i>Nuevo plato'; });
  $("#productos").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"); const tg = e.target.closest("[data-toggle]");
    if (ed) {
      const p = productos.find((x) => x.id === Number(ed.dataset.edit));
      $("#prodId").value = p.id; $("#prodNombre").value = p.nombre; $("#prodCategoria").value = p.categoria_id; $("#prodPrecio").value = p.precio;
      $("#prodTurno").value = p.turno; $("#prodActivo").checked = !!p.activo;
      $("#prodTitulo").innerHTML = `<i class="bi bi-pencil-square me-1 text-primary"></i>Editar: ${esc(p.nombre)}`;
      $("#prodNombre").focus();
    }
    if (tg) {
      const p = productos.find((x) => x.id === Number(tg.dataset.toggle));
      try { await HK.put("/api/productos/" + p.id, { ...p, activo: !p.activo }); cargar(); } catch (err) { HK.error(err); }
    }
  });

  await Promise.all([cargarConfig(), cargar()]);
})();
