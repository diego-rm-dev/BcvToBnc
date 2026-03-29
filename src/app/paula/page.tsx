import { PaulaPurchaseForm } from "@/components/PaulaPurchaseForm";
import { config } from "@/lib/config";
import { resolveDefaultNetworkForUi } from "@/lib/orders/mappers";

export default function PaulaPage() {
  return (
    <section className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Iniciar compra de USDT
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Esta pantalla solo inicia la operación. Al continuar, se abrirá un checkout seguro del
          proveedor externo para completar la compra.
        </p>
      </header>

      <PaulaPurchaseForm
        defaultNetwork={resolveDefaultNetworkForUi(config.onRamp.defaultNetwork)}
        initialWalletAddress={config.onRamp.defaultWalletAddress}
      />
    </section>
  );
}
