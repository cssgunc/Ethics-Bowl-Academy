import type { Metadata } from "next";
import {
  Inter,
  Roboto_Mono,
  Playfair_Display,
  Work_Sans,
  Cormorant_Garamond,
} from "next/font/google";
import "./globals.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/lib/theme";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Toaster } from "sonner";
import { AlertProvider } from "@/context/AlertContext";

const inter = Inter({
  variable: "--font-primary",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-secondary",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-tertiary",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ethics Bowl Academy | Parr Center for Ethics",
  description: "Interactive learning platform for ethics education and philosophy",
  icons: {
    icon: "/icon.ico",
    shortcut: "/icon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} ${playfairDisplay.variable} ${workSans.variable} ${cormorantGaramond.variable}`}
      >
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AlertProvider>
              <Navbar />
              <Toaster position="top-center" />

              <main className="flex-1">
                <div
                  className="relative w-full min-h-full overflow-hidden"
                  style={{
                    background: "linear-gradient(to bottom, white 0%, white 1%, #abd8ff 100%)",
                  }}
                >
                  <div className="relative">
                    {children}
                  </div>
                </div>
              </main>

              <Footer />
            </AlertProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}