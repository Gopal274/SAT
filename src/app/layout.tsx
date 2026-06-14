
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase';
import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import Link from 'next/link';
import { ChatAssistant } from '@/components/chat-assistant';
import { MobileNav } from '@/components/mobile-nav';

export const metadata: Metadata = {
  title: 'Rate Record & Logistics',
  description: 'A web app to record product rates and manage Trust logistics.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trust Store',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

function AppFooter() {
  return (
    <footer className="border-t bg-card/50 no-print pb-16 md:pb-0">
      <div className="container mx-auto flex h-16 items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              .printable-area, .printable-area * {
                visibility: visible;
              }
              .printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
        </style>
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseClientProvider>
              <div className="flex-grow pb-16 md:pb-0">
                {children}
              </div>
              <AppFooter />
              <MobileNav />
              <Toaster />
              <ChatAssistant />
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
