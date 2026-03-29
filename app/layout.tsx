import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineQueueStarter } from "@/components/offline/queue-starter";
import { AuthRedirector } from "@/components/auth/auth-provider";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Peekaboo Miniclub",
  description: "Kids store at Katapadi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${plusJakarta.variable} ${beVietnam.variable} font-sans antialiased bg-[#fff8f7]`}>
        <AuthProvider>
          <AuthRedirector />
          <ToastProvider>
            {children}
            <OfflineQueueStarter />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
