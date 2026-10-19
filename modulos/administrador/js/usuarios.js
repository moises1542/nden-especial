// ==========================================================
//  Usuarios y roles (administrador)
// ==========================================================
(async () => {
  const { $, esc, fecha, hora, iniciales } = HK;
  const me = await HK.init();
  let usuarios = [];
  const ROLES = { admin: ["Administrador", "bi-shield-check", "danger"], mesero: ["Mesero", "bi-person-badge", "primary"], cocina: ["Cocina", "bi-fire", "warning"], caja: ["Caja", "bi-cash-coin", "success"] };
  const PERMISOS = [
    ["Registrar y modificar comandas", 1, 1, 0, 0], ["Anular platos pendientes", 1, 1, 0, 0], ["Anular platos en preparación", 1, 0, 0, 0],
    ["Monitor de cocina y estados", 1, 0, 1, 0], ["Marcar platos entregados", 1, 1, 1, 0], ["Cobros y división de cuentas", 1, 0, 0, 1],
    ["Apertura, arqueo y cierre de caja", 1, 0, 0, 1], ["Reportes de ventas", 1, 0, 0, 1], ["Carta, precios y horarios", 1, 0, 0, 0], ["Usuarios y roles", 1, 0, 0, 0],
  ];
  $("#permisos").innerHTML = PERMISOS.map(([f, ...v]) => `<tr><td class="text-start">${f}</td>${v.map((x) => `<td>${x ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-dash text-muted"></i>'}</td>`).join("")}</tr>`).join("");

  async function cargar() {
    usuarios = await HK.get("/api/usuarios");
    $("#rolesResumen").innerHTML = Object.entries(ROLES).map(([k, [n, ic, c]]) => `<div class="col-6 col-xl-3"><div class="card stat-card shadow-sm"><div class="card-body d-flex align-items-center gap-3">
      <div class="stat-icon bg-${c}-subtle text-${c}"><i class="bi ${ic}"></i></div><div><div class="text-muted small">${n}</div><div class="stat-value">${usuarios.filter((u) => u.rol === k && u.activo).length}</div></div></div></div></div>`).join("");
    $("#usuarios").innerHTML = usuarios.map((u) => `<tr class="${u.activo ? "" : "opacity-50"}">
      <td><div class="d-flex align-items-center gap-2"><span class="avatar" style="width:32px;height:32px">${iniciales(u.nombre)}</span><span class="fw-medium">${esc(u.usuario)}</span></div></td>
      <td>${esc(u.nombre)}<br><small class="text-muted">${esc(u.email || "")}</small></td>
      <td><span class="badge text-bg-${ROLES[u.rol][2]}">${ROLES[u.rol][0]}</span></td>
      <td>${u.ultimo_acceso ? fecha(u.ultimo_acceso) + " " + hora(u.ultimo_acceso) : '<span class="text-muted">Nunca</span>'}</td>
      <td>${u.activo ? '<span class="text-success">Activo</span>' : '<span class="text-muted">Inactivo</span>'}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-edit="${u.id}"><i class="bi bi-pencil"></i></button></td></tr>`).join("");
  }

  function abrir(u) {
    $("#uId").value = u ? u.id : "";
    $("#userTitulo").textContent = u ? "Editar usuario" : "Nuevo usuario";
    $("#uUsuario").value = u ? u.usuario : ""; $("#uUsuario").disabled = !!u;
    $("#uNombre").value = u ? u.nombre : ""; $("#uEmail").value = u ? u.email || "" : "";
    $("#uRol").value = u ? u.rol : "mesero"; $("#uActivo").checked = u ? !!u.activo : true;
    $("#uPassword").value = ""; $("#uPassword").required = !u;
    $("#uPassLabel").textContent = u ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña";
    const yo = u && u.id === me.id; $("#uRol").disabled = yo; $("#uActivo").disabled = yo;
    bootstrap.Modal.getOrCreateInstance($("#userModal")).show();
  }
  $("#btnNuevo").addEventListener("click", () => abrir(null));
  $("#usuarios").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) abrir(usuarios.find((u) => u.id === Number(b.dataset.edit))); });
  $("#userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("#uId").value;
    const body = { usuario: $("#uUsuario").value, nombre: $("#uNombre").value, email: $("#uEmail").value, rol: $("#uRol").value, activo: $("#uActivo").checked, password: $("#uPassword").value || undefined };
    try {
      if (id) await HK.put("/api/usuarios/" + id, body); else await HK.post("/api/usuarios", body);
      bootstrap.Modal.getInstance($("#userModal")).hide();
      HK.toast(id ? "Usuario actualizado." : "Usuario creado."); cargar();
    } catch (err) { HK.error(err); }
  });
  cargar();
})();
