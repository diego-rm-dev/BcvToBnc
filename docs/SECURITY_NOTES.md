# Security Notes (MVP)

## Controles actuales

### Status page
- Acceso por `orderId` + `statusAccessToken`.
- Token se genera por orden y se valida en backend.
- En token inválido/faltante se responde `404` para no enumerar órdenes.

### Webhook
- Se decodifica JWT `data` del webhook con token de partner (`TRANSAK_WEBHOOK_ACCESS_TOKEN`).
- En `NODE_ENV=production`, JWT inválido se rechaza (`401`).
- Idempotencia fuerte por `provider + eventId` en `ProcessedWebhookEvent`.

### Input/API
- Validación de input con Zod (`/api/session/create`).
- Rate limit básico por IP en `session/create`.
- CORS restringido a orígenes permitidos.

### Logs
- Logs estructurados JSON con `requestId`.
- Sanitización de campos sensibles (`token`, `secret`, `apiKey`, etc.).
- No se deben loguear secretos completos.

## Riesgos aceptados (MVP)

1. SQLite + rate limit en memoria (no ideal multi-instancia).
2. Sin autenticación de usuario completa (diseño intencional para 1 usuaria).
3. Verificación de firma webhook (HMAC/header) aún no cerrada al 100% según contrato final de cuenta.
4. Tokens de status via query string (pragmático para MVP, requiere cuidado en compartición de URLs).

## Antes de producción más seria

1. Migrar a Postgres y rate limit distribuido (Redis).
2. Confirmar y aplicar verificación criptográfica completa del webhook según cuenta Transak.
3. Definir rotación de credenciales y proceso de revocación.
4. Añadir monitoreo/alertas centralizadas y retención de auditoría.
