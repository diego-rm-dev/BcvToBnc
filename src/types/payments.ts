import type { InternalNetwork } from "@/lib/networks";

export type PaymentProvider = "TRANSAK";

export type InternalPaymentStatus =
  | "PENDING"
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type CreateTransakSessionInput = {
  partnerOrderId: string;
  walletAddress: string;
  email?: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: InternalNetwork;
  redirectURL: string;
  defaultPaymentMethod?: string;
};

export type CreateTransakSessionResult = {
  provider: PaymentProvider;
  status: InternalPaymentStatus;
  redirectUrl: string;
  widgetUrl: string;
  raw: unknown;
};

export type GetTransakPriceQuoteInput = {
  fiatCurrency: string;
  cryptoCurrency: string;
  network: InternalNetwork;
  fiatAmount?: number;
  cryptoAmount?: number;
  isBuyOrSell?: "BUY";
  paymentMethod?: string;
  quoteCountryCode?: string;
  walletAddress?: string;
};

export type GetTransakPriceQuoteResult = {
  provider: PaymentProvider;
  quoteTimestamp: string;
  quoteId: string | null;
  fiatAmount: number | null;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: InternalNetwork;
  estimatedCryptoAmount: number | null;
  estimatedTotalFee: number | null;
  input: {
    fiatCurrency: string;
    cryptoCurrency: string;
    network: InternalNetwork;
    isBuyOrSell: "BUY";
    fiatAmount: number | null;
    cryptoAmount: number | null;
    paymentMethod: string | null;
    quoteCountryCode: string | null;
  };
  summary: {
    quoteId: string | null;
    fiatAmount: number | null;
    cryptoAmount: number | null;
    totalFee: number | null;
    conversionPrice: number | null;
    marketConversionPrice: number | null;
    paymentMethod: string | null;
    slippage: number | null;
  };
  raw: unknown;
};

export type MapTransakStatusInput = {
  status?: string | null;
};

export type VerifyTransakWebhookSignatureInput = {
  payload: string;
  signatureHeader?: string | null;
};

export type VerifyTransakWebhookSignatureResult = {
  isValid: boolean;
  reason?: string;
};
