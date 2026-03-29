import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Paula USDT MVP</h1>
      <p className="text-slate-600">
        Esta es una app privada para iniciar compras de USDT con un proveedor externo de on-ramp.
      </p>

      <Link
        className="inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        href="/paula"
      >
        Ir a /paula
      </Link>
    </section>
  );
}
