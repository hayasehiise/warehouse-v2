import type { Metadata } from "next";
import { Nunito_Sans, Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/providers";

const montserratHeading = Montserrat({subsets:['latin'],variable:'--font-heading'});

const nunitoSans = Nunito_Sans({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Warehouse Management System",
  description: "Warehouse Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", nunitoSans.variable, montserratHeading.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
