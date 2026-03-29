"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RecoveryNotice } from "@/components/RecoveryNotice";
import { InternalNetwork, mapInternalNetworkToDisplayLabel } from "@/lib/networks";
import {
  type NoticeContent,
  getQuoteFallbackNotice,
  getSessionErrorNotice
} from "@/lib/ui/recovery-messages";
import { openTransakWidget, type TransakWidgetController } from "@/lib/transak-widget";

type PaulaPurchaseFormProps = {
  initialWalletAddress: string;
  defaultNetwork: InternalNetwork;
};

type SessionResponse = {
  orderId: string;
  partnerOrderId: string;
  provider: string;
  redirectUrl?: string;
  widgetUrl?: string;
  statusAccessToken?: string;
  statusUrl?: string;
  status: string;
  estimate?: {
    targetNetCryptoAmount: number;
    estimatedFiatAmount: number;
    marginPct: number;
    isEstimate: boolean;
    disclaimer: string;
    strategy: string;
  } | null;
};

function isBasicEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function PaulaPurchaseForm({ initialWalletAddress, defaultNetwork }: PaulaPurchaseFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const widgetRef = useRef<TransakWidgetController | null>(null);

  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [email, setEmail] = useState("");
  const [network, setNetwork] = useState<InternalNetwork>(defaultNetwork);

  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<NoticeContent | null>(null);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const [statusPath, setStatusPath] = useState<string | null>(null);
  const [widgetFallbackUrl, setWidgetFallbackUrl] = useState<string | null>(null);

  const walletError = useMemo(() => {
    if (!walletAddress.trim()) return "La wallet address es obligatoria.";
    if (!isBasicEvmAddress(walletAddress)) return "Wallet inválida. Debe verse como 0x... (40 hex).";
    return null;
  }, [walletAddress]);

  const canSubmit = !loading && !walletError;

  useEffect(() => {
    return () => {
      widgetRef.current?.cleanup();
      widgetRef.current = null;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorNotice(null);
    setNotice(null);
    setWidgetFallbackUrl(null);

    if (walletError) {
      setErrorNotice({
        tone: "error",
        title: "Datos incompletos",
        message: walletError
      });
      return;
    }

    setLoading(true);
    let createdStatusPath: string | null = null;
    let createdWidgetUrl: string | null = null;
    let phase: "session_create" | "transak_session" | "widget_open" = "session_create";

    try {
      const response = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddress.trim(),
          email: email.trim() || undefined,
          fiatAmount: 30,
          network
        })
      });

      const data = (await response.json().catch(() => null)) as
        | SessionResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? "No se pudo crear la sesión.");
      }

      const session = data as SessionResponse;
      const statusUrl =
        session.statusUrl ??
        (session.statusAccessToken
          ? `/paula/status/${session.orderId}?token=${encodeURIComponent(session.statusAccessToken)}`
          : `/paula/status/${session.orderId}`);
      const widgetUrl = session.widgetUrl ?? session.redirectUrl;
      createdStatusPath = statusUrl;
      createdWidgetUrl = widgetUrl ?? null;

      setStatusPath(statusUrl);
      setWidgetFallbackUrl(widgetUrl ?? null);

      if (session.estimate?.strategy === "fallback") {
        setNotice(getQuoteFallbackNotice(session.estimate.disclaimer));
      } else if (session.estimate?.disclaimer) {
        setNotice({
          tone: "info",
          title: "Estimación de compra",
          message: session.estimate.disclaimer
        });
      }

      phase = "transak_session";
      if (!widgetUrl) {
        throw new Error("No se recibió widgetUrl de Transak.");
      }

      phase = "widget_open";
      widgetRef.current?.cleanup();
      widgetRef.current = await openTransakWidget({
        widgetUrl,
        callbacks: {
          onEvent({ type }) {
            if (type === "TRANSAK_WIDGET_INITIALISED") {
              setNotice({
                tone: "info",
                title: "Checkout abierto",
                message: "Completa la operación en la ventana segura de Transak."
              });
            }
            if (type === "TRANSAK_ORDER_CREATED") {
              setNotice({
                tone: "info",
                title: "Orden creada en Transak",
                message: "Puedes revisar su estado en cualquier momento."
              });
            }
            if (type === "TRANSAK_ORDER_CANCELLED") {
              setNotice({
                tone: "warning",
                title: "Operación cancelada",
                message: "Puedes intentarlo de nuevo cuando quieras."
              });
            }
            if (type === "TRANSAK_ORDER_FAILED") {
              setErrorNotice({
                tone: "error",
                title: "Transak reportó un fallo",
                message: "Reintenta la compra o revisa el estado de tu orden."
              });
            }
          },
          onOrderSuccessful() {
            router.push(statusUrl);
          },
          onWidgetClose() {
            setNotice({
              tone: "info",
              title: "Checkout cerrado",
              message: "Puedes retomarlo consultando el estado de la orden."
            });
          }
        }
      });

      setLoading(false);
    } catch (submitError) {
      const rawMessage =
        submitError instanceof Error ? submitError.message : "Error inesperado al iniciar checkout.";

      setLoading(false);
      setErrorNotice(getSessionErrorNotice({ phase, rawMessage }));

      // Fallback seguro: si ya existe orden, dejamos accesos manuales para recuperación.
      if (createdStatusPath) setStatusPath(createdStatusPath);
      if (createdWidgetUrl) setWidgetFallbackUrl(createdWidgetUrl);
      if (createdStatusPath || createdWidgetUrl) {
        setNotice({
          tone: "warning",
          title: "Recuperación manual disponible",
          message: "Usa los enlaces para continuar sin perder seguimiento de la orden." 
        });
      }
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} ref={formRef}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Checkout provisto por un tercero (Transak). Esta app solo inicia la sesión de compra.
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="walletAddress">
            Wallet address
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            id="walletAddress"
            name="walletAddress"
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="0x..."
            type="text"
            value={walletAddress}
          />
          {walletError ? <p className="text-xs text-red-600">{walletError}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="network">
            Red
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            id="network"
            name="network"
            onChange={(event) => setNetwork(event.target.value as InternalNetwork)}
            value={network}
          >
            <option value="polygon">Polygon</option>
            <option value="bsc">BNB Chain</option>
          </select>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
        <dl className="text-sm">
          <SummaryRow label="Pagarás" value="30 USD" />
          <SummaryRow
            label="Recibirás"
            value="Estimado en USDT según cotización y comisiones (no garantizado)"
          />
          <SummaryRow label="Red" value={mapInternalNetworkToDisplayLabel(network)} />
        </dl>
      </section>

      {errorNotice ? (
        <RecoveryNotice
          actions={[
            {
              label: "Reintentar",
              onClick: () => formRef.current?.requestSubmit()
            },
            ...(statusPath ? [{ label: "Abrir estado", href: statusPath }] : []),
            { label: "Volver al inicio", href: "/" }
          ]}
          message={errorNotice.message}
          title={errorNotice.title}
          tone={errorNotice.tone}
        />
      ) : null}

      {notice ? <RecoveryNotice message={notice.message} title={notice.title} tone={notice.tone} /> : null}

      {(statusPath || widgetFallbackUrl) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {statusPath ? (
            <Link className="font-medium text-slate-800 underline" href={statusPath}>
              Ver estado de la orden
            </Link>
          ) : null}
          {widgetFallbackUrl ? (
            <a
              className="font-medium text-slate-800 underline"
              href={widgetFallbackUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Abrir checkout manualmente
            </a>
          ) : null}
        </div>
      )}

      <button
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canSubmit}
        type="submit"
      >
        {loading ? "Abriendo checkout seguro..." : "Continuar"}
      </button>
    </form>
  );
}
