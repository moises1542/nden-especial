# Restaurante Hong Kong — Sistema de comandas, cocina y caja

Frontend con **HTML, Bootstrap 5.3.8 personalizado con Sass y JavaScript**, organizado en **módulos por usuario**. Por ahora no usa servidor ni base de datos: la información se guarda en el navegador (localStorage).

## 1. Cómo abrirlo

1. Abre la carpeta del proyecto en Visual Studio Code.
2. Haz clic derecho en `index.html` y elige **Open with Live Server**. También puedes abrirlo con doble clic.
3. Elige el rol, escribe el usuario y la contraseña, y entra a tu módulo.

> Las pestañas del mismo navegador se sincronizan. Puedes tener al mesero en una pestaña, a cocina en otra y a caja en otra. Cada pestaña mantiene su propia sesión.

## 2. Usuarios y acceso

| Rol | Usuario | Contraseña | Módulo |
|---|---|---|---|
| Administrador | `administrador` | `Admin123` | `modulos/administrador` (y acceso a todos) |
| Mesero | `mesero` | `Mesero123` | `modulos/mesero` |
| Cocina | `cocina` | `Cocina123` | `modulos/cocina` |
| Caja | `caja` | `Caja123` | `modulos/caja` |

- En el login se elige el rol. Si la cuenta no pertenece a ese rol, se rechaza.
- Después de 5 intentos fallidos, la cuenta se bloquea 5 minutos.
- Cada usuario ve solo su módulo. Si intenta abrir otro, vuelve al suyo.
- El administrador crea más cuentas (usuario, nombre, rol y contraseña) en **Configuración › Usuarios y roles**. Las contraseñas se guardan cifradas.
- El menú de usuario, arriba a la derecha, tiene:
  - **Ver mis datos**
  - **Editar perfil**
  - **Cambiar contraseña**
  - **Preferencias**
  - **Mi sesión**
  - **Cerrar sesión**

## 3. Estructura

```
RESTAURANTE_HONG_KONG/
├── css/
│   ├── bootstrap.css(.map)      Bootstrap personalizado (de scss/bootstrap.scss)
│   ├── custom.css(.map)         Estilos propios (de scss/custom.scss)
│   ├── fonts/inter/             Fuente Inter
│   └── icons/                   Bootstrap Icons
├── js/
│   ├── bootstrap.bundle.min.js(.map)
│   ├── datos.js                 Datos del sistema en el navegador (localStorage)
│   ├── app.js                   Común: sesión, menú por rol, perfil, avisos
│   ├── login.js                 Inicio de sesión por rol
│   └── inicio.js                Panel de inicio de cada módulo
├── scss/
│   ├── _variables.scss          Colores, fuente y bordes
│   ├── bootstrap.scss           → css/bootstrap.css
│   └── custom.scss              → css/custom.css
├── modulos/
│   ├── administrador/   index.html · usuarios.html · productos.html   + js/
│   ├── mesero/          index.html · pedidos.html                     + js/
│   ├── cocina/          index.html · monitor.html                     + js/
│   └── caja/            index.html · caja.html · reportes.html        + js/
├── img/                 Logo, ícono y patrón de fondo
├── node_modules/        Bootstrap y Sass (solo para compilar el estilo)
├── index.html           ← Inicio de sesión
└── package.json
```

## 4. Estilo (Sass)

- Para cambiar los colores, la fuente o los bordes, edita `scss/_variables.scss`.
- Compila con **Watch Sass** (Live Sass Compiler). `.vscode/settings.json` ya trae `savePath: /css`.
- También puedes compilar desde la terminal: `npm install` y luego `npm run sass`.

## 5. Funciones por módulo

| Módulo | Funciones |
|---|---|
| Mesero | Registrar pedidos por mesa. La carta cambia según el turno de desayuno o almuerzo. Agregar platos a un pedido abierto, modificar o anular platos pendientes y marcar como entregados los platos listos. |
| Cocina | Monitor con los pedidos que llegan, cronómetro, alerta de demora y cambio de estado: Pendiente → En preparación → Listo. |
| Caja | Apertura de caja. Cobro con efectivo (con vuelto), Yape, Plin o tarjeta. División de cuentas (total, por consumo, partes iguales o parcial). Boleta interna, arqueo con cierre y reportes. |
| Administrador | Acceso a todos los módulos. Usuarios y roles, carta, precios y horarios. |

> Para probar fuera del horario de atención (06:00–19:00), entra como administrador a **Configuración › Carta y horarios** y desactiva “Validar horario”.
