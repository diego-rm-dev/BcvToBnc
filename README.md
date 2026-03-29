# Paula USDT MVP

MVP privado (una sola usuaria) para iniciar compra de USDT con checkout oficial de Transak.

La app no procesa pagos: crea una orden local, solicita `widgetUrl` a Transak y abre el checkout externo.

## Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- Zod
- Vitest

## Flujo funcional actual

1. Usuaria abre `/paula`.
2. Frontend llama `POST /api/session/create`.
3. Backend valida input, crea `Order`, genera `statusAccessToken`, solicita `widgetUrl` y guarda `rawSessionPayload`.
4. Frontend abre widget oficial Transak.
5. Transak envía webhook a `POST /api/webhooks/transak`.
6. Backend procesa webhook con idempotencia fuerte por `eventId` y actualiza orden.
7. Usuaria consulta `/paula/status/[id]?token=...`.

## Endpoints

- `POST /api/session/create`
- `POST /api/webhooks/transak`
- `GET /api/orders/[id]?token=...`

## Endurecimientos implementados

### 1) Protección status page

- Cada orden genera `statusAccessToken` aleatorio.
- `GET /api/orders/[id]` exige `token` y compara en forma segura.
- Si falta/no coincide token, responde `404` (no filtra existencia de IDs).

### 2) Idempotencia fuerte de webhook

- Se persiste evento procesado en `ProcessedWebhookEvent`.
- Clave única: `provider + eventId`.
- Duplicado devuelve `200` con `duplicate: true` y no reprocesa efectos.
- Si Transak no envía `eventId`, se usa fallback hash SHA-256 del `rawBody`.

### 3) Normalización de network

Fuente única en `src/lib/networks.ts`:
- Interna: `polygon | bsc`
- Helpers: validación, normalización, mapeo a Transak y labels UI.
- UI + validación + backend usan esta capa para evitar strings inconsistentes.

### 4) Observabilidad mínima

- `requestId` por request (`x-request-id` si llega, o UUID generado).
- Logs estructurados JSON con sanitización.
- Eventos disponibles:
  - `session_create_started`
  - `session_create_succeeded`
  - `session_create_failed`
  - `transak_session_created`
  - `transak_session_failed`
  - `webhook_received`
  - `webhook_invalid`
  - `webhook_duplicate`
  - `webhook_processed`
  - `order_status_changed`
  - `order_status_read`

## Variables de entorno clave

### Base

- `DATABASE_URL`
- `APP_BASE_URL`
- `DEFAULT_WALLET_ADDRESS`
- `DEFAULT_NETWORK`
- `DEFAULT_CRYPTO_CURRENCY`
- `DEFAULT_FIAT_CURRENCY`

### Seguridad/operación

- `ALLOWED_ORIGINS`
- `SESSION_CREATE_RATE_LIMIT_WINDOW_MS`
- `SESSION_CREATE_RATE_LIMIT_MAX_REQUESTS`

### Transak

- `TRANSAK_ENVIRONMENT` (`STAGING` o `PRODUCTION`)
- `TRANSAK_API_KEY`
- `TRANSAK_PARTNER_ACCESS_TOKEN`
- `TRANSAK_WEBHOOK_ACCESS_TOKEN` (recomendado)
- `TRANSAK_REFERRER_DOMAIN`
- `TRANSAK_SESSIONS_API_URL` (opcional)
- `TRANSAK_QUOTES_API_URL` (opcional)
- `TRANSAK_DEFAULT_PAYMENT_METHOD` (opcional)

## Local dev

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Prisma

```bash
npx prisma migrate dev --name <migration_name>
npm run prisma:generate
```

## Documentación adicional

- Integración técnica Transak: `docs/INTEGRACION_TRANSAK.md`
- Seguridad mínima MVP: `docs/SECURITY_NOTES.md`
- Plan de pruebas staging: `docs/STAGING_TEST_PLAN.md`

## Lo que falta para producción más seria

1. Base de datos gestionada (Postgres) y migraciones en pipeline.
2. Rate limiting distribuido (Redis) en lugar de memoria local.
3. Firma/verificación de webhook confirmada y endurecida 100% según contrato final de cuenta.
4. Monitoreo/alerta centralizado (logs + métricas + alertas).
5. Control de acceso más robusto para panel/operación (aunque siga siendo 1 usuaria).
# BcvToBnc
