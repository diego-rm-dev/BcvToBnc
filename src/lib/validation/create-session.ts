import { z } from "zod";
import { InternalNetwork, isSupportedInternalNetwork } from "@/lib/networks";

export const createSessionSchema = z.object({
  // Puede venir del frontend o usarse el valor por defecto de configuración.
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress debe ser una dirección EVM válida")
    .optional(),
  email: z.string().trim().email().optional(),
  fiatAmount: z.coerce.number().positive().max(10000).optional(),
  // Objetivo neto aproximado en cripto (ej. 30 USDT).
  targetNetCryptoAmount: z.coerce.number().positive().max(100000).optional(),
  network: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isSupportedInternalNetwork, "network debe ser 'polygon' o 'bsc'")
    .transform((value) => value as InternalNetwork)
    .optional()
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
