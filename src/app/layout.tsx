import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paula USDT MVP",
  description: "MVP privado para iniciar compra de USDT"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
