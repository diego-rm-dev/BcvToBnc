import type { CreateTransakSessionInput } from "@/types/payments";
import { mapInternalNetworkToTransak } from "@/lib/networks";

export type TransakWidgetParams = {
  // Obligatorios según Create Widget URL API.
  apiKey: string;
  referrerDomain: string;

  // Tracking + retorno.
  partnerOrderId: string;
  redirectURL: string;

  // Scope del flujo (MVP solo on-ramp BUY).
  productsAvailed: "BUY";

  // Prefill + lock para reducir errores de usuario.
  fiatCurrency: string;
  fiatAmount: string;
  cryptoCurrencyCode: string;
  network: string;
  walletAddress: string;
  disableWalletAddressForm: true;

  // UX simple y enfocada.
  hideMenu: true;

  // Opcionales de prefill.
  email?: string;
  defaultPaymentMethod?: string;
};

export const TRANSAK_WIDGET_PARAM_GUIDE = {
  required: [
    "apiKey",
    "referrerDomain",
    "fiatCurrency",
    "fiatAmount",
    "cryptoCurrencyCode",
    "network",
    "walletAddress",
    "partnerOrderId",
    "redirectURL"
  ],
  optional: ["email", "defaultPaymentMethod", "hideMenu", "productsAvailed", "disableWalletAddressForm"],
  risky: [
    // Requiere paymentMethod + combinaciones exactas; mala config rompe el flujo.
    "hideExchangeScreen",
    // Puede ocultar info sensible de costo al usuario.
    "isFeeCalculationHidden",
    // Si se configura mal, deja sin opciones de pago válidas por región.
    "disablePaymentMethods"
  ]
} as const;

type BuildTransakWidgetParamsInput = {
  session: CreateTransakSessionInput;
  apiKey: string;
  referrerDomain: string;
  defaultPaymentMethod?: string;
};

function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeFiatAmount(value: number): string {
  // Transak recibe string/number; enviamos string consistente para evitar drift de formato.
  return Number.isFinite(value) ? String(value) : "0";
}

export function buildTransakWidgetParams(input: BuildTransakWidgetParamsInput): TransakWidgetParams {
  const { session } = input;

  const params: TransakWidgetParams = {
    apiKey: input.apiKey,
    referrerDomain: input.referrerDomain,
    partnerOrderId: session.partnerOrderId,
    redirectURL: session.redirectURL,
    productsAvailed: "BUY",
    fiatCurrency: normalizeCurrency(session.fiatCurrency),
    fiatAmount: normalizeFiatAmount(session.fiatAmount),
    cryptoCurrencyCode: normalizeCurrency(session.cryptoCurrency),
    network: mapInternalNetworkToTransak(session.network),
    walletAddress: session.walletAddress.trim(),
    disableWalletAddressForm: true,
    hideMenu: true
  };

  if (session.email) params.email = session.email.trim();

  // Preferimos lock opcional por backend config; no forzamos paymentMethod fijo por defecto.
  const paymentMethod = session.defaultPaymentMethod ?? input.defaultPaymentMethod;
  if (paymentMethod) params.defaultPaymentMethod = paymentMethod;

  return params;
}
