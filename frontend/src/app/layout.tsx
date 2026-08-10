import type { Metadata } from "next";
import "pannellum/build/pannellum.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "مجتمع آموزشی بعثت | پیوند آموزش و بصیرت دینی",
  description: "وب‌سایت رسمی مجتمع آموزشی، تربیتی و فرهنگی بعثت در مشهد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
