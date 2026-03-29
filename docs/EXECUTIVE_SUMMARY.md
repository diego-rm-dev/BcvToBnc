# Resumen Ejecutivo — MVP Privado USDT

## Qué es

MVP privado para una sola usuaria que inicia compras de USDT a través de un proveedor externo (Transak), con trazabilidad local de cada orden.

## Qué ya funciona

- Pantalla simple de inicio de compra (`/paula`).
- Creación de orden local y redirección al checkout oficial del proveedor.
- Webhook para actualizar estado de orden.
- Pantalla de estado por orden (`/paula/status/[id]`).
- Seguridad mínima implementada:
  - validación de input,
  - rate limit básico,
  - control de origin/CORS,
  - manejo de errores y logs sanitizados.

## Valor actual

- Flujo operativo completo de punta a punta para pruebas reales.
- Base limpia y mantenible para seguir iterando sin rehacer el proyecto.
- Trazabilidad suficiente para auditar sesiones y webhooks en MVP.

## Qué falta para endurecer producción

1. Confirmar contrato final de integración Transak (session/quote/webhook signature exacta).
2. Reemplazar rate limit en memoria por Redis si hay más de una instancia.
3. Agregar capa simple de acceso protegido para lectura de órdenes.
4. Mejorar observabilidad (métricas y alertas básicas).

## Secretos/variables clave a conseguir

- `TRANSAK_API_KEY`
- `TRANSAK_WEBHOOK_SECRET`
- `TRANSAK_ENVIRONMENT` (STAGING/PRODUCTION)
- `TRANSAK_SESSIONS_API_URL` y `TRANSAK_QUOTES_API_URL` (si aplica)

## Riesgo principal actual

La estimación de “neto objetivo USDT” es aproximada; el valor final lo determina el checkout del proveedor en tiempo real.

## Recomendación

Mantener esta base, cerrar primero la integración exacta del proveedor y luego endurecer seguridad operativa en pasos pequeños.
