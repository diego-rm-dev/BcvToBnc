# Integración Transak (técnica corta)

## Alcance implementado

- Backend usa **Create Widget URL API** (`POST /api/v2/auth/session`).
- Frontend abre checkout oficial de Transak vía SDK con `widgetUrl`.
- `widgetUrl` se trata como **efímero y single-use**.
- Webhook de órdenes:
  - parsea envelope,
  - decodifica JWT (`data`) con token de partner,
  - extrae `partnerOrderId`/referencia,
  - mapea estado externo -> interno,
  - persiste payload crudo,
  - aplica idempotencia fuerte por evento.

## Parámetros de widget adoptados (MVP)

- `apiKey`
- `referrerDomain`
- `partnerOrderId`
- `redirectURL`
- `productsAvailed: "BUY"`
- `fiatCurrency`
- `fiatAmount`
- `cryptoCurrencyCode`
- `network`
- `walletAddress`
- `disableWalletAddressForm: true`
- `hideMenu: true`
- `email` (opcional)
- `defaultPaymentMethod` (opcional)

## Networks (fuente única)

Se centraliza en `src/lib/networks.ts`:
- interna soportada: `polygon | bsc`
- validación de input: `isSupportedInternalNetwork`
- normalización: `normalizeInternalNetwork`
- mapeo a Transak: `mapInternalNetworkToTransak`

No usar strings de network sueltos fuera de esta capa.

## Protección de status page

- Al crear orden se genera `statusAccessToken`.
- Se devuelve `statusUrl` con query `?token=...`.
- `GET /api/orders/[id]` exige token; mismatch/missing -> `404`.

## Idempotencia de webhook (actual)

- Tabla: `ProcessedWebhookEvent`.
- Unicidad: `@@unique([provider, eventId])`.
- Si el mismo evento llega de nuevo:
  - se responde `200`,
  - `duplicate: true`,
  - sin reprocesar side effects.
- Si falta `eventId`, se usa fallback estable: `payload_sha256_<hash_raw_body>`.

## Observabilidad mínima

- `requestId` por request (`x-request-id` o UUID generado).
- Logs JSON estructurados con sanitización.
- Eventos principales:
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

- `TRANSAK_ENVIRONMENT`
- `TRANSAK_API_KEY`
- `TRANSAK_PARTNER_ACCESS_TOKEN`
- `TRANSAK_WEBHOOK_ACCESS_TOKEN` (recomendado)
- `TRANSAK_REFERRER_DOMAIN`
- `TRANSAK_SESSIONS_API_URL` (opcional)
- `TRANSAK_QUOTES_API_URL` (opcional)
- `TRANSAK_DEFAULT_PAYMENT_METHOD` (opcional)

## Pendientes honestos

1. Confirmar y endurecer verificación de firma webhook (además del decode JWT) según contrato final de cuenta.
2. Migrar de SQLite a Postgres para operación más seria.
3. Añadir métricas y alertas fuera de logs locales.
