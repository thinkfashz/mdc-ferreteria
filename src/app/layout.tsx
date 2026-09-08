import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/layout/Providers";
import BrandLoader from "@/components/layout/BrandLoader";

export const metadata: Metadata = {
  title: "MDC - Sistema de Gestión",
  description: "Plataforma de gestión de productos, inventario y stock",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MDC",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF6600",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-page">
        <Providers>
          <BrandLoader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
