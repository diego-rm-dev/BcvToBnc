# Documento Técnico — MVP Privado de Compra de USDT

## 1. Resumen ejecutivo técnico

Este proyecto implementa un MVP privado para una sola usuaria que inicia compras de USDT mediante un proveedor externo (Transak). La aplicación no intenta reemplazar el checkout del proveedor: actúa como capa de orquestación para validar input, crear y trazar órdenes locales, redirigir al checkout oficial y procesar webhooks de actualización de estado.

## 2. Objetivo del MVP

- Mantener flujo simple, confiable y trazable.
- Separar claramente frontend (captura de intención) y backend (lógica de negocio, seguridad y persistencia).
- Dejar base lista para evolucionar a:
  - cotización por neto objetivo de USDT,
  - endurecimiento de seguridad,
  - despliegue gradual en producción.

## 3. Alcance implementado

### 3.1 Frontend

- `/paula`: formulario principal para iniciar compra.
  - Campos: wallet address, email, red (Polygon/BNB Chain).
  - Monto inicial fijo por defecto: 30 USD.
  - Resumen de operación y redirección automática al checkout externo.
- `/paula/status/[id]`: consulta de estado de orden.
  - Estado amigable, datos operativos básicos y botón de refrescar manual.

### 3.2 Backend

- `POST /api/session/create`
  - Validación con Zod.
  - Rate limiting básico por IP.
  - Control básico de origin/CORS.
  - Creación de orden local en Prisma.
  - Integración abstracta con proveedor (sesión + URL de checkout).
  - Soporte opcional de estimación por neto objetivo en USDT.
- `POST /api/webhooks/transak`
  - Lectura de raw body.
  - Verificación de firma (placeholder robusto y configurable).
  - Parsing flexible de payload.
  - Actualización idempotente de estado de orden.
  - Persistencia de payload crudo.
- `GET /api/orders/[id]`
  - Lectura de orden por id para seguimiento de estado.

### 3.3 Persistencia

- Prisma + SQLite.
- Modelo `Order` con estado, referencias de proveedor y trazabilidad (`rawSessionPayload`, `rawWebhookPayload`).

## 4. Arquitectura actual (visión simple)

1. UI privada captura intención de compra.
2. Backend crea `Order` local con `partnerOrderId`.
3. Backend obtiene/arma sesión de proveedor y devuelve URL.
4. Usuario completa flujo en checkout oficial.
5. Webhook del proveedor actualiza estado local.
6. Pantalla de estado consulta `GET /api/orders/[id]`.

## 5. Estructura principal del código

- `src/app/api/session/create/route.ts`: creación de sesión/orden.
- `src/app/api/webhooks/transak/route.ts`: webhook.
- `src/app/api/orders/[id]/route.ts`: lectura de orden.
- `src/lib/providers/transak.ts`: abstracción de proveedor.
- `src/lib/services/estimation.ts`: estimación de fiat bruto para neto objetivo.
- `src/lib/orders/mappers.ts`: mapeos compartidos (red, moneda, estados).
- `src/lib/config.ts` + `src/lib/env.server.ts`: configuración centralizada.
- `src/lib/security/*`: CORS/origin, IP y rate limit.
- `src/lib/logger.ts`: logging con redacción básica.
- `prisma/schema.prisma`: modelo de datos.
- `tests/*`: suite mínima útil con Vitest.

## 6. Modelo de datos (Order)

Campos clave:

- Identidad y trazabilidad:
  - `id`, `partnerOrderId`, `provider`
- Datos de compra:
  - `walletAddress`, `fiatAmount`, `fiatCurrency`, `cryptoCurrency`, `network`
- Estimaciones:
  - `quotedCryptoAmount`, `quotedTotalFee`
- Estado de negocio:
  - `status` (`PENDING`, `WAITING_PAYMENT`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`)
- Auditoría:
  - `rawSessionPayload`, `rawWebhookPayload`, `createdAt`, `updatedAt`

## 7. Seguridad mínima implementada

- Validación de input (Zod).
- Wallet EVM validada por regex.
- Rate limit in-memory en `session/create`.
- Control básico de Origin/CORS en creación de sesión.
- Variables de entorno obligatorias/opcionales centralizadas.
- Logging con redacción de secretos/token/api keys.
- Error handling consistente (menos detalles en producción).
- Webhook con verificación de firma configurable e idempotencia simple.

## 8. Qué funcionó (validado)

- `npm run build` exitoso.
- `npm run test` exitoso (12 tests).
- Endpoints principales operativos con respuestas JSON claras.
- Flujo UI -> API -> checkout -> webhook -> status funcionando en modo MVP.

## 9. Qué no está implementado aún (o está parcial)

1. Contrato final exacto de Transak para:
   - endpoint de sesión server-to-server,
   - endpoint de quote final,
   - formato exacto de firma webhook.
2. Rate limit distribuido (actualmente memoria local).
3. Control de acceso adicional para `GET /api/orders/[id]`.
4. Observabilidad avanzada (métricas, tracing, alertas).
5. Garantía de neto exacto (solo estimación aproximada).

## 10. Secret keys / variables a conseguir

### Requeridas para correr

- `DATABASE_URL`
- `APP_BASE_URL`
- `DEFAULT_WALLET_ADDRESS`
- `DEFAULT_NETWORK`
- `DEFAULT_CRYPTO_CURRENCY`
- `DEFAULT_FIAT_CURRENCY`

### Seguridad / operación recomendadas

- `ALLOWED_ORIGINS`
- `SESSION_CREATE_RATE_LIMIT_WINDOW_MS`
- `SESSION_CREATE_RATE_LIMIT_MAX_REQUESTS`

### Integración proveedor (Transak)

- `TRANSAK_API_KEY`
- `TRANSAK_ENVIRONMENT` (`STAGING` / `PRODUCTION`)
- `TRANSAK_WEBHOOK_SECRET`
- `TRANSAK_SESSIONS_API_URL` (opcional)
- `TRANSAK_QUOTES_API_URL` (opcional)
- `TRANSAK_WEBHOOK_SIGNATURE_HEADER` (opcional)
- `TRANSAK_WEBHOOK_SIGNATURE_ALGO` (opcional)

## 11. Ejemplos de código clave

### 11.1 Validación de create session (extracto)

```ts
export const createSessionSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  email: z.string().trim().email().optional(),
  fiatAmount: z.coerce.number().positive().max(10000).optional(),
  targetNetCryptoAmount: z.coerce.number().positive().max(100000).optional(),
  network: z.enum(["polygon", "bsc"]).optional()
});
```

### 11.2 Estrategia de estimación (extracto)

```ts
const estimation = input.targetNetCryptoAmount
  ? await estimateGrossFiatForTargetNetCrypto({
      targetNetCryptoAmount: input.targetNetCryptoAmount,
      fiatCurrency,
      cryptoCurrency,
      network,
      walletAddress,
      initialFiatAmount: explicitFiatAmount
    })
  : null;
```

### 11.3 Webhook idempotente (extracto)

```ts
const nextStatus = mapExternalStatusToOrderStatus(parsed.externalStatus);
const isDuplicate = order.status === nextStatus && order.rawWebhookPayload === rawBody;

if (!isDuplicate) {
  await prisma.order.update({
    where: { id: order.id },
    data: { status: nextStatus, rawWebhookPayload: rawBody }
  });
}
```

## 12. Flujo local recomendado

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run dev
```

Opcional:

```bash
npm run test
npm run build
```

## 13. Riesgos actuales y mitigación pragmática

1. Rate limit en memoria:
   - Riesgo: no compartido entre instancias.
   - Mitigación futura: Redis.
2. Firma webhook no cerrada al 100% con contrato final:
   - Riesgo: validación incompleta.
   - Mitigación: alinear con docs oficiales antes de producción.
3. Lectura de orden por ID:
   - Riesgo: exposición por ID si se filtra.
   - Mitigación: token simple privado o secret header.
4. Estimación no es precio final ejecutado:
   - Riesgo: diferencia entre estimación y checkout.
   - Mitigación: mostrar margen y mensaje explícito en UI.

## 14. Próximos pasos sugeridos

1. Cerrar contrato real de endpoints de Transak y firma webhook.
2. Endurecer webhook: rechazar firma inválida en producción (`401`).
3. Añadir protección mínima a `GET /api/orders/[id]`.
4. Guardar timestamp de quote y mostrarlo en UI.
5. Agregar observabilidad operativa básica (request-id, errores por endpoint, latencias).

---

Este documento describe el estado real del MVP al momento actual y deja una base clara para iterar sin sobreingeniería.
