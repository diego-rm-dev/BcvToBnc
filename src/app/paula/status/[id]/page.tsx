"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecoveryNotice } from "@/components/RecoveryNotice";
import { mapInternalNetworkToDisplayLabel, normalizeInternalNetwork } from "@/lib/networks";
import {
  type NoticeContent,
  getStatusErrorNotice,
  getStatusProgressNotice
} from "@/lib/ui/recovery-messages";

type OrderStatus =
  | "PENDING"
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

type OrderResponse = {
  id: string;
  status: OrderStatus;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: string;
  walletAddress: string;
  provider: string;
  createdAt: string;
};

function statusLabel(status: OrderStatus) {
  if (status === "PENDING") return "Pendiente";
  if (status === "WAITING_PAYMENT") return "Esperando pago";
  if (status === "PROCESSING") return "Procesando";
  if (status === "COMPLETED") return "Completada";
  if (status === "FAILED") return "Fallida";
  return "Expirada";
}

function statusClass(status: OrderStatus) {
  if (status === "COMPLETED") return "bg-green-100 text-green-800";
  if (status === "FAILED") return "bg-red-100 text-red-800";
  if (status === "EXPIRED") return "bg-slate-200 text-slate-700";
  if (status === "WAITING_PAYMENT") return "bg-amber-100 text-amber-800";
  if (status === "PROCESSING") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-800";
}

function shortWallet(wallet: string) {
  if (wallet.length <= 14) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;
}

function formatDate(dateISO: string) {
  return new Date(dateISO).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default function PaulaOrderStatusPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<NoticeContent | null>(null);

  const orderId = params.id;
  const token = searchParams.get("token")?.trim() ?? "";

  const loadOrder = useCallback(async () => {
    if (!token) {
      setOrder(null);
      setErrorNotice(getStatusErrorNotice({ tokenMissing: true }));
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorNotice(null);

    try {
      const response = await fetch(`/api/orders/${orderId}?token=${encodeURIComponent(token)}`, {
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as
        | OrderResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const backendError = (data as { error?: string } | null)?.error;
        throw new Error(backendError ?? "No se pudo consultar la orden.");
      }

      setOrder(data as OrderResponse);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Error inesperado.";
      setErrorNotice(getStatusErrorNotice({ tokenMissing: false, rawMessage: message }));
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const createdAtText = useMemo(() => {
    if (!order?.createdAt) return "-";
    return formatDate(order.createdAt);
  }, [order]);

  const statusNotice = useMemo(() => {
    if (!order) return null;
    return getStatusProgressNotice(order.status);
  }, [order]);

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Estado de compra USDT</h1>
        <p className="text-sm text-slate-600">Consulta manual del estado de tu orden en tiempo real.</p>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500 sm:text-sm">
          ID de orden: <span className="font-mono text-slate-700">{orderId}</span>
        </p>
        <button
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={() => void loadOrder()}
          type="button"
        >
          {loading ? "Actualizando..." : "Refrescar"}
        </button>
      </div>

      {loading && !order ? <p className="text-sm text-slate-600">Cargando estado de la orden...</p> : null}

      {errorNotice ? (
        <RecoveryNotice
          actions={[
            { label: "Reintentar", onClick: () => void loadOrder() },
            { label: "Volver al inicio", href: "/" },
            { label: "Iniciar nueva compra", href: "/paula" }
          ]}
          message={errorNotice.message}
          title={errorNotice.title}
          tone={errorNotice.tone}
        />
      ) : null}

      {order ? (
        <>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusClass(order.status)}`}
          >
            {statusLabel(order.status)}
          </div>

          {statusNotice ? (
            <RecoveryNotice
              actions={[
                { label: "Refrescar", onClick: () => void loadOrder() },
                ...(order.status === "FAILED" || order.status === "EXPIRED"
                  ? [{ label: "Reintentar compra", href: "/paula" }]
                  : []),
                { label: "Volver al inicio", href: "/" }
              ]}
              message={statusNotice.message}
              title={statusNotice.title}
              tone={statusNotice.tone}
            />
          ) : null}

          <dl className="rounded-xl border border-slate-200 px-4 py-1 text-sm">
            <InfoRow label="Monto fiat" value={String(order.fiatAmount)} />
            <InfoRow label="Moneda fiat" value={order.fiatCurrency} />
            <InfoRow label="Cripto" value={order.cryptoCurrency} />
            <InfoRow
              label="Red"
              value={mapInternalNetworkToDisplayLabel(normalizeInternalNetwork(order.network))}
            />
            <InfoRow label="Wallet" value={shortWallet(order.walletAddress)} />
            <InfoRow label="Proveedor" value={order.provider} />
            <InfoRow label="Creada" value={createdAtText} />
          </dl>

          <div className="pt-1">
            <Link className="text-sm font-medium text-slate-800 underline" href="/paula">
              Iniciar otra compra
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
