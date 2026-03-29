# STAGING TEST PLAN - MVP On-Ramp USDT (Transak)

## 1. Objetivo
Validar en `staging` el flujo real de compra de USDT con Transak, minimizando riesgo operativo antes de abrir producción gradual.

## 2. Pre-flight (antes de probar)

### 2.1 Entorno
- Verificar que la app de staging esté desplegada y accesible por HTTPS.
- Confirmar base URL de staging (ej. `https://staging.tudominio.com`).
- Confirmar que la DB de staging no sea la de producción.

### 2.2 Variables de entorno críticas
- `APP_BASE_URL`
- `ALLOWED_ORIGINS`
- `DEFAULT_WALLET_ADDRESS`
- `DEFAULT_NETWORK` (`polygon` o `bsc` según estrategia de prueba)
- `DEFAULT_CRYPTO_CURRENCY` (USDT)
- `DEFAULT_FIAT_CURRENCY` (USD)
- `TRANSAK_ENVIRONMENT` (`STAGING`)
- `TRANSAK_API_KEY`
- `TRANSAK_PARTNER_ACCESS_TOKEN`
- `TRANSAK_REFERRER_DOMAIN` (debe corresponder al dominio staging)
- `TRANSAK_WEBHOOK_ACCESS_TOKEN` (si aplica para decode/verify)
- `TRANSAK_DEFAULT_PAYMENT_METHOD` (opcional)
- `TRANSAK_SESSIONS_API_URL` (si sobrescribes endpoint)
- `TRANSAK_QUOTES_API_URL` (si sobrescribes endpoint)

### 2.3 Configuración externa (Transak Dashboard)
- Webhook URL configurada a `https://<staging>/api/webhooks/transak`.
- Referrer/domain permitido en Transak para staging.
- API key/token activos para entorno de staging.

## 3. Checklist manual paso a paso

1. Abrir `/paula` en staging.
2. Ingresar wallet válida + email de prueba + red esperada (`polygon` o `bsc`).
3. Hacer clic en `Continuar`.
4. Confirmar respuesta `200` de `POST /api/session/create`.
5. Confirmar que llega `orderId` y `widgetUrl` (o `redirectUrl`) y que abre widget.
6. Completar flujo en widget (caso exitoso) con monto pequeño.
7. Ir a `/paula/status/[id]?token=...` y validar transición de estado.
8. Esperar webhook y refrescar estado manualmente.
9. Repetir con escenarios de fallo/cancelación.
10. Repetir enviando manualmente el mismo webhook para validar idempotencia.

## 4. Logs a observar (mínimo)

### 4.1 Session create
- `session_create_started`
- `transak_session_created` o `transak_session_failed`
- `session_create_succeeded` o `session_create_failed`
- `order_status_changed` (cuando aplique)

### 4.2 Webhook
- `webhook_received`
- `webhook_invalid` (si hay problemas de payload/verify)
- `webhook_processed`
- `webhook_duplicate` (si se reenvía el mismo evento)
- `order_status_changed`

### 4.3 Lectura de estado
- `order_status_read`

Nota: usar `requestId` en logs para correlacionar toda la traza end-to-end.

## 5. Respuestas/estados esperados

### 5.1 Creación de sesión (`POST /api/session/create`)
- Esperado:
  - HTTP `200`
  - `orderId`, `partnerOrderId`, `status`, `statusUrl`
  - `widgetUrl` presente para abrir checkout
- Errores controlados:
  - `400` validación input
  - `429` rate limit
  - `5xx` error de proveedor o interno

### 5.2 Apertura del widget
- Esperado:
  - Se abre modal/iframe de Transak
  - Eventos básicos del SDK (`INITIALISED`, `ORDER_CREATED`, etc.) en UI
- Si falla:
  - Mensaje claro y CTA
  - Link de fallback `Abrir checkout manualmente`
  - Link `Ver estado de la orden`

### 5.3 Orden completada
- Esperado:
  - Webhook procesa evento
  - Estado final en orden: `COMPLETED`
  - `/paula/status/[id]` refleja `Completada`

### 5.4 Orden fallida
- Esperado:
  - Estado final: `FAILED` (o `EXPIRED` según caso)
  - UI muestra mensaje de recuperación y CTA para reintento

### 5.5 Webhook duplicado
- Esperado:
  - Respuesta webhook `200` con `duplicate: true`
  - Log `webhook_duplicate`
  - Sin side effects duplicados (no re-escrituras inconsistentes)

## 6. Evidencia mínima por prueba (guardar siempre)
- `testCaseId`
- Fecha/hora UTC
- `orderId`
- `partnerOrderId`
- `requestId` principal
- Red (`polygon`/`bsc`)
- Monto fiat
- Resultado esperado vs real
- Estado final (`COMPLETED`, `FAILED`, `EXPIRED`, etc.)
- Captura de pantalla (widget y status page)
- Extracto de logs correlacionados
- Payload webhook relevante (sanitizado)

## 7. Casos de prueba (tabla rápida)

| ID | Caso | Pasos clave | Resultado esperado |
|---|---|---|---|
| STG-01 | Pago exitoso | Crear sesión, completar pago, esperar webhook | `COMPLETED`, logs completos, status correcto |
| STG-02 | Pago rechazado | Crear sesión, forzar rechazo/fallo en proveedor | `FAILED` y mensaje de recuperación |
| STG-03 | Usuario cierra widget | Crear sesión y cerrar checkout antes de pagar | Orden no completada, CTA para retomar/ver estado |
| STG-04 | Webhook llega tarde | Completar flujo y demorar verificación de estado | Status intermedio al inicio, luego transición correcta |
| STG-05 | Token inválido status | Abrir `/paula/status/[id]` con token incorrecto | Respuesta no autorizada por diseño (404), UI clara |
| STG-06 | Webhook duplicado | Reenviar mismo evento | `duplicate: true`, sin duplicar side effects |
| STG-07 | Falla quote (degradación) | Probar neto objetivo con quote no disponible | Se usa fiat fijo + aviso de estimación/degradación |

## 8. Criterios de salida a producción gradual
- 0 errores críticos en `STG-01` a `STG-06`.
- Idempotencia confirmada en webhook duplicado.
- Sin exposición de secretos/tokens en logs.
- `requestId` visible y útil en trazas end-to-end.
- Mensajes de error en español claros y con CTA funcional.
- Estados finales consistentes entre webhook, DB y `/paula/status/[id]`.
- Evidencia completa de al menos 2 corridas exitosas por caso crítico (`STG-01`, `STG-02`, `STG-06`).
- Runbook operativo mínimo listo (qué hacer si webhook falla o se retrasa).

## 9. Go-live gradual recomendado
- Fase 1: 1 usuaria, montos bajos, monitoreo manual en tiempo real.
- Fase 2: ventana controlada de uso (horario definido), revisión diaria de logs y estados.
- Fase 3: ampliar límites solo si no hay incidentes en 5-7 días.
