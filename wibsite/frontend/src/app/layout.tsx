import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wibsite 2.0 - Portal Unificado",
  description: "Sales Automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="flex h-screen bg-background text-on-surface overflow-hidden">
        <ThemeProvider>
          <ToastProvider>
            <Sidebar />
            <main className="flex-1 flex flex-col relative overflow-hidden">
              {children}
              <StatusBar />
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
