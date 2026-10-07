# Cafetería: demo de arquitectura Microkernel

Aplicación real (no simulada) para gestionar los pedidos de una cafetería, hecha para mostrar la
arquitectura **Microkernel / plugins**: el Core ofrece solo lo mínimo y todo lo demás se agrega con
plugins que se **inyectan en vivo, sin reiniciar nada**.

Trabajo práctico de Taller de Lenguajes de Programación IV, Instituto Politécnico Formosa.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Front | React 19, TypeScript, Vite |
| Core (servidor) | Node.js, Express 5, TypeScript |
| Base de datos | SQLite con Prisma (ORM, migraciones y seed) |
| Tiempo real | Server-Sent Events |
| Despliegue | Docker y Docker Compose |

## Puesta en marcha

### Con Docker (recomendado)

Solo hace falta tener Docker instalado y abierto.

```bash
docker compose up -d --build     # primera vez: construye la imagen y arranca
docker compose up -d             # veces siguientes
docker compose down              # apagar
```

Abrir **http://localhost:3001**. Si el puerto está ocupado: `PORT=3002 docker compose up -d`.

Al iniciar, el contenedor aplica las migraciones y carga el menú (seed) solo. La base queda en
`data/` y los plugins se inyectan en `plugins/`; las dos carpetas son del proyecto, así que
sobreviven a reinicios.

Después de cambiar código del Core o del front hay que reconstruir: `docker compose up -d --build`.

### Sin Docker (desarrollo)

Requiere Node 22 o superior.

```bash
npm run install:all      # instala dependencias y genera el cliente de Prisma
npm run dev              # Core en :3001 y front en http://localhost:5173
```

`npm run dev` aplica las migraciones y el seed antes de arrancar. El front se recarga solo al
editarlo; el Core hay que reiniciarlo para tomar cambios.

## Comandos de plugins

Con la app corriendo, en otra terminal y dentro de esta carpeta:

```bash
npm run plugin -- listar
npm run plugin -- inyectar combo-desayuno
npm run plugin -- inyectar notificaciones
npm run plugin -- inyectar estadisticas
npm run plugin -- inyectar plugin-defectuoso
npm run plugin -- quitar combo-desayuno
npm run plugin -- quitar notificaciones
npm run plugin -- quitar estadisticas
npm run plugin -- quitar plugin-defectuoso
```

Inyectar es copiar el archivo de `plugins-disponibles/` a `plugins/`; quitar es borrarlo. También se
puede hacer a mano, y editar un archivo de `plugins/` lo recarga solo (el Core revisa la carpeta
cada segundo). Sin Node en la computadora, el mismo comando corre dentro del contenedor:

```bash
docker compose exec cafeteria node /app/scripts/plugin.mjs inyectar combo-desayuno
```

| Plugin | Qué hace |
|---|---|
| `combo-desayuno` | Bebida + pastelería en el mismo pedido = 15 % de descuento sobre la pastelería |
| `notificaciones` | Escribe avisos de cocina y salón en un archivo real (`data/plugins/notificaciones/notificaciones.log`) |
| `estadisticas` | Agrega un botón **Estadísticas** al encabezado con datos reales de la base (consultas SQL) |
| `plugin-defectuoso` | Lanza errores a propósito para mostrar que una falla no tumba al Core |

## Cómo encaja con la arquitectura

| Pieza del Microkernel | En este proyecto |
|---|---|
| **Core** | `server/src/core/` y `server/src/routes/`: menú, pedidos, estados y base de datos |
| **API / contrato** | `server/src/api/plugin-api.ts`: la interfaz `Plugin` y sus puntos de extensión |
| **Plugins** | Archivos `.mjs` que cumplen el contrato, en `plugins/` y `plugins-disponibles/` |
| **Gestor de plugins** | `server/src/core/pluginManager.ts`: carga, recarga y descarga sin reiniciar, y aísla fallas |
| **Open-Closed** | Los plugins cambian precios, notifican y agregan rutas y botones sin editar el Core |

### Contrato

Un plugin es un archivo `.mjs` que exporta por defecto un objeto con `name`, `version` y lo que
quiera extender:

| Elemento | Para qué sirve |
|---|---|
| `hooks.onOrderPricing(order, ctx)` | Devuelve descuentos o recargos antes de guardar un pedido |
| `hooks.onOrderCreated(order, ctx)` | Reacciona después de guardar un pedido |
| `hooks.onStatusChanged(order, previous, ctx)` | Reacciona cuando un pedido cambia de estado |
| `routes(router, ctx)` | Agrega endpoints propios en `/api/ext/<nombre>/` |
| `panel` | El front muestra sus datos; con `placement: 'header'` agrega un botón al encabezado |
| `onLoad` / `onUnload` | Se ejecutan al cargar y descargar el plugin |

El `ctx` que recibe ofrece `log()`, `query()` (una sentencia SELECT), `kv` (almacenamiento propio),
`dataDir` (carpeta propia) y `preview` (indica que es solo una vista previa del precio).
`query()` y `kv` son asíncronos: usarlos con `await`.

Ejemplo mínimo:

```js
export default {
  name: 'mi-plugin',
  version: '1.0.0',
  hooks: {
    onOrderPricing(order) {
      const amount = Math.round(order.subtotal * 0.1);
      return [{ label: 'Propina sugerida 10%', amount }];
    },
  },
};
```

## Estructura

```
server/
  prisma/schema.prisma     modelos de la base
  prisma/migrations/       migraciones SQL generadas por Prisma
  prisma/seed.ts           menú inicial
  src/api/plugin-api.ts    contrato entre el Core y los plugins
  src/core/                pedidos, gestor de plugins, eventos, acceso a la base
  src/routes/              endpoints HTTP (pedidos, plugins, tiempo real)
client/src/                interfaz React
plugins/                   plugins activos (carpeta vigilada)
plugins-disponibles/       plugins listos para inyectar
scripts/plugin.mjs         comando para inyectar y quitar plugins
Dockerfile, docker-compose.yml
```

## API del Core

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/products` | Carta |
| GET | `/api/orders` | Últimos 50 pedidos |
| POST | `/api/orders/preview` | Precio con los plugins activos, sin guardar |
| POST | `/api/orders` | Crea un pedido |
| PATCH | `/api/orders/:id/status` | Avanza el estado (pendiente, preparando, listo, entregado) |
| DELETE | `/api/orders/:id` | Elimina un pedido |
| DELETE | `/api/orders?status=entregado` | Vacía los entregados |
| GET | `/api/plugins` | Plugins cargados |
| POST | `/api/plugins/:name/enabled` | Activa o desactiva un plugin |
| ANY | `/api/ext/:name/...` | Rutas que aporta cada plugin |
| GET | `/api/stream` | Tiempo real (SSE) |
| DELETE | `/api/log` | Vacía el registro |

## Guion sugerido para la exposición (3 minutos)

1. Mostrar la app con **0 plugins** y armar un pedido de **Latte + Brownie**: el ticket marca $6.500 sin descuento.
2. `npm run plugin -- inyectar combo-desayuno`: aparece un aviso "Plugin cargado". El ticket **se recalcula solo** a $6.050 con el descuento detallado. Confirmar el pedido. *No se tocó ni reinició el Core.*
3. Inyectar `notificaciones`, avanzar el pedido de estado y abrir el archivo de log para mostrar que se escribió.
4. Inyectar `estadisticas`: aparece un botón nuevo en el encabezado con datos reales de la base.
5. Inyectar `plugin-defectuoso` y armar un pedido: el error queda en el **Registro**, pero el pedido se crea igual.
6. Desactivar o quitar un plugin: su comportamiento desaparece en vivo.

## Notas

- Si un plugin lanza una excepción o tarda más de 2 segundos, el Core registra el error y sigue funcionando.
- Los plugins corren dentro del proceso del Core: sirven para la demo, pero no son un sandbox de seguridad.
- La base está en `data/cafeteria.db`. Borrar esa carpeta (con la app apagada) reinicia los datos; el menú se vuelve a cargar con el seed.
- Ver la base en el navegador (sin Docker): `npm run studio --prefix server`.
