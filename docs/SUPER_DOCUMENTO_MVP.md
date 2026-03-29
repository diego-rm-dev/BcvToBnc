# Super Documento Técnico - MVP Privado USDT (Transak)

## 1. Qué se hizo (resumen ejecutivo)

Se construyó un MVP privado para una sola usuaria que inicia compras de USDT usando checkout oficial de Transak.

El sistema actual:
- crea orden local en backend,
- solicita `widgetUrl` real a Transak,
- abre widget oficial en frontend,
- procesa webhooks con idempotencia fuerte,
- protege la lectura de estado por token privado por orden,
- registra observabilidad mínima con logs estructurados y `requestId`.

No se procesan pagos internamente ni se custodian fondos.

---

## 2. Qué contiene este MVP

## 2.1 Flujo funcional

1. Usuaria abre `/paula`.
2. Frontend envía `POST /api/session/create`.
3. Backend valida input, crea `Order`, genera token privado de estado y crea sesión en Transak.
4. Backend devuelve `widgetUrl` + `statusUrl`.
5. Frontend abre widget Transak (SDK `@transak/ui-js-sdk`).
6. Transak envía webhook a `POST /api/webhooks/transak`.
7. Backend actualiza estado de orden con idempotencia por evento.
8. Usuaria consulta `/paula/status/[id]?token=...`.

## 2.2 Módulos principales

- Frontend:
  - `src/app/paula/page.tsx`
  - `src/components/PaulaPurchaseForm.tsx`
  - `src/app/paula/status/[id]/page.tsx`
  - `src/components/RecoveryNotice.tsx`
- API:
  - `src/app/api/session/create/route.ts`
  - `src/app/api/webhooks/transak/route.ts`
  - `src/app/api/orders/[id]/route.ts`
- Proveedor Transak:
  - `src/lib/providers/transak.ts`
  - `src/lib/providers/transak-widget-params.ts`
  - `src/lib/transak-widget.ts`
- Seguridad/operación:
  - `src/lib/security/order-access.ts`
  - `src/lib/security/request.ts`
  - `src/lib/security/rate-limit.ts`
  - `src/lib/logger.ts`
  - `src/lib/observability/request-context.ts`
- Redes:
  - `src/lib/networks.ts`
- Datos:
  - `prisma/schema.prisma`
  - `prisma/migrations/*`

---

## 3. Arquitectura (simple y mantenible)

- Next.js App Router para UI + API routes.
- Prisma para persistencia (`Order`, `ProcessedWebhookEvent`).
- Integración Transak encapsulada en `src/lib/providers/transak.ts`.
- Validación de entrada con Zod.
- Errores/recuperación UX centralizados en `src/lib/ui/recovery-messages.ts`.

Principio aplicado:
- backend = fuente de verdad de orden y estado,
- frontend = interfaz y recuperación UX,
- proveedor externo = checkout y eventos de lifecycle.

---

## 4. Modelo de datos actual (Prisma)

## 4.1 `Order`

Campos clave:
- identidad/tracking: `id`, `provider`, `partnerOrderId`
- protección status page: `statusAccessToken`
- compra: `walletAddress`, `customerEmail`, `fiatAmount`, `fiatCurrency`, `cryptoCurrency`, `network`
- quote/estimación: `quotedCryptoAmount`, `quotedTotalFee`, `quoteRequestedAt`, `quoteInput`, `quoteSummary`
- lifecycle: `status`, `redirectUrl`, `rawSessionPayload`, `rawWebhookPayload`, `createdAt`, `updatedAt`

Estados internos:
- `PENDING`
- `WAITING_PAYMENT`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `EXPIRED`

## 4.2 `ProcessedWebhookEvent`

Para idempotencia fuerte de webhook:
- `provider`
- `eventId`
- `partnerOrderId`
- `orderId`
- `rawPayload`
- `processedAt`

Unicidad:
- `@@unique([provider, eventId])`

---

## 5. Endpoints y comportamiento real

## 5.1 `POST /api/session/create`

Hace:
- validación Zod (`walletAddress`, `email`, `fiatAmount`, `targetNetCryptoAmount`, `network`),
- rate limit por IP,
- creación de orden local,
- generación de `statusAccessToken`,
- creación de sesión Transak (`/api/v2/auth/session`),
- persistencia `rawSessionPayload`,
- retorno de `orderId`, `widgetUrl`, `statusUrl`, etc.

Respuesta esperada (éxito):
- `200` con `orderId`, `partnerOrderId`, `status`, `widgetUrl`, `statusUrl`.

## 5.2 `POST /api/webhooks/transak`

Hace:
- lectura de raw body,
- parse de envelope,
- decode JWT de `data`,
- extracción `partnerOrderId`/referencia,
- mapeo estado externo -> interno,
- idempotencia fuerte por `eventId`,
- update de orden si aplica,
- respuesta `200` también para duplicados (`duplicate: true`).

En `NODE_ENV=production`:
- webhook JWT inválido -> `401`.

## 5.3 `GET /api/orders/[id]?token=...`

Hace:
- exige token de query,
- compara token en tiempo constante,
- retorna datos de estado de orden.

Si token falta/no coincide:
- responde `404` (evita enumeración de IDs).

---

## 6. Integración Transak (estado actual)

## 6.1 Session API

Implementación real con:
- endpoint `POST /api/v2/auth/session`,
- header `access-token`,
- body `{ widgetParams }`.

`widgetUrl`:
- tratado como efímero y single-use.

## 6.2 Widget params mínimos adoptados

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

## 6.3 Webhook

Contrato aplicado en código:
- `data` llega como JWT,
- se verifica/decodifica con token de partner/webhook token,
- se procesa status y referencias.

---

## 7. Seguridad implementada (MVP)

- Validación de input con Zod.
- Rate limit básico por IP (`session/create`).
- CORS con orígenes permitidos.
- Token privado por orden para status page.
- Comparación segura de token (`timingSafeEqual`).
- Idempotencia fuerte de webhook por evento persistido.
- Logs sanitizados (no exponen secretos completos).

---

## 8. Observabilidad implementada

## 8.1 Correlación

- `requestId` por request (`x-request-id` o UUID generado).
- API responde `x-request-id` para correlación.

## 8.2 Eventos de log disponibles

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

Formato:
- JSON estructurado en consola.

---

## 9. UX de error y recuperación

Implementado en frontend:
- mensajes centralizados en español,
- notices sobrios con CTAs:
  - `Reintentar`,
  - `Abrir estado`,
  - `Volver al inicio`,
  - `Iniciar nueva compra`.

Casos cubiertos:
- falla `session/create`,
- falla creación de sesión Transak,
- falla apertura de widget,
- fallback de quote,
- webhook tardío (mensaje de estado en proceso),
- status sin token/token inválido,
- estados `FAILED`/`EXPIRED`.

---

## 10. Normalización de network

Fuente única: `src/lib/networks.ts`

Red interna soportada:
- `polygon`
- `bsc`

Funciones clave:
- `isSupportedInternalNetwork()`
- `normalizeInternalNetwork()`
- `mapInternalNetworkToTransak()`
- `mapInternalNetworkToDisplayLabel()`
- `mapInternalNetworkToBinanceReferenceLabel()`

Evita inconsistencias entre UI, backend y Transak.

---

## 11. Qué funcionó (confirmado)

- Build OK (`next build`).
- Tests OK (`vitest`).
- Flujo básico completo operativo:
  - crear sesión,
  - abrir widget,
  - actualizar por webhook,
  - consultar status protegido.
- Idempotencia fuerte webhook funcionando en duplicados.
- Observabilidad mínima útil para debugging real.

---

## 12. Qué NO está implementado todavía (honesto)

1. Persistencia/operación para escala (sigue SQLite).
2. Rate limiting distribuido (hoy memoria local, no multi-instancia).
3. Monitoreo/alertas centralizadas (APM/metrics externo).
4. Capa de autenticación de usuario completa (intencionalmente fuera del MVP).
5. Endurecimiento final de verificación de firma webhook además del decode JWT, según contrato final exacto de cuenta en producción.

---

## 13. Secrets / keys que debes buscar y agregar

## 13.1 Base del proyecto

- `DATABASE_URL`
- `APP_BASE_URL`
- `DEFAULT_WALLET_ADDRESS`
- `DEFAULT_NETWORK`
- `DEFAULT_CRYPTO_CURRENCY`
- `DEFAULT_FIAT_CURRENCY`

## 13.2 Seguridad/operación

- `ALLOWED_ORIGINS`
- `SESSION_CREATE_RATE_LIMIT_WINDOW_MS`
- `SESSION_CREATE_RATE_LIMIT_MAX_REQUESTS`

## 13.3 Transak (obligatorios para integración real)

- `TRANSAK_ENVIRONMENT` (`STAGING`/`PRODUCTION`)
- `TRANSAK_API_KEY`
- `TRANSAK_PARTNER_ACCESS_TOKEN`
- `TRANSAK_WEBHOOK_ACCESS_TOKEN` (recomendado)
- `TRANSAK_REFERRER_DOMAIN`

## 13.4 Transak (opcionales útiles)

- `TRANSAK_SESSIONS_API_URL`
- `TRANSAK_QUOTES_API_URL`
- `TRANSAK_DEFAULT_PAYMENT_METHOD`

## 13.5 Variables legacy (opcionales)

- `TRANSAK_WEBHOOK_SECRET`
- `TRANSAK_WEBHOOK_SIGNATURE_HEADER`
- `TRANSAK_WEBHOOK_SIGNATURE_ALGO`

---

## 14. Ejemplo de `.env` para staging

```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="https://staging.tudominio.com"
ALLOWED_ORIGINS="https://staging.tudominio.com"

DEFAULT_WALLET_ADDRESS="0xTU_WALLET"
DEFAULT_NETWORK="polygon"
DEFAULT_CRYPTO_CURRENCY="USDT"
DEFAULT_FIAT_CURRENCY="USD"

TRANSAK_ENVIRONMENT="STAGING"
TRANSAK_API_KEY=""
TRANSAK_PARTNER_ACCESS_TOKEN=""
TRANSAK_WEBHOOK_ACCESS_TOKEN=""
TRANSAK_REFERRER_DOMAIN="staging.tudominio.com"
TRANSAK_DEFAULT_PAYMENT_METHOD=""

SESSION_CREATE_RATE_LIMIT_WINDOW_MS="60000"
SESSION_CREATE_RATE_LIMIT_MAX_REQUESTS="20"
```

---

## 15. Código clave (snippets reales)

## 15.1 Generación de token privado de estado

```ts
// src/lib/security/order-access.ts
export function generateStatusAccessToken(): string {
  return randomBytes(32).toString("hex");
}
```

## 15.2 Validación del token en lectura de orden

```ts
// src/app/api/orders/[id]/route.ts
if (!order.statusAccessToken || !safeTokenEquals(order.statusAccessToken, token)) {
  return NextResponse.json({ error: "Order not found" }, { status: 404 });
}
```

## 15.3 Idempotencia fuerte de webhook

```ts
// prisma/schema.prisma
model ProcessedWebhookEvent {
  provider OnRampProvider
  eventId  String
  @@unique([provider, eventId])
}
```

```ts
// src/lib/webhooks/transak-idempotency.ts
export function resolveTransakWebhookEventId(providerEventId: string | null, rawBody: string) {
  if (providerEventId?.trim()) return { eventId: providerEventId.trim(), isFallback: false };
  const hash = createHash("sha256").update(rawBody).digest("hex");
  return { eventId: `payload_sha256_${hash}`, isFallback: true };
}
```

## 15.4 Evento estructurado con requestId

```ts
// src/lib/logger.ts
logger.event("info", "webhook_processed", {
  requestId,
  metadata: { orderId, status, eventId }
});
```

## 15.5 Network como fuente única

```ts
// src/lib/networks.ts
export type InternalNetwork = "polygon" | "bsc";
export function mapInternalNetworkToTransak(network: InternalNetwork): InternalNetwork {
  return network === "polygon" ? "polygon" : "bsc";
}
```

---

## 16. Comandos operativos

Instalación y arranque:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run dev
```

Tests:

```bash
npm test
```

Build:

```bash
npm run build
```

Migraciones Prisma:

```bash
npx prisma migrate dev --name <nombre>
```

---

## 17. Recomendación de siguiente fase (pragmática)

1. Ejecutar `docs/STAGING_TEST_PLAN.md` completo con evidencia.
2. Cerrar verificación criptográfica final del webhook según tu cuenta Transak en producción.
3. Migrar a Postgres + rate limit distribuido para operar fuera de single-instance.
4. Definir rollout gradual (1 usuaria -> ventana controlada -> ampliación).

---

## 18. Estado final de este MVP

Este MVP ya es funcional y trazable para pruebas reales controladas.

Está bien posicionado para una producción gradual de bajo riesgo, siempre que se complete:
- hardening final de webhook,
- infraestructura mínima de operación (DB/rate limit/monitoring),
- disciplina operativa de pruebas y seguimiento de incidentes.
