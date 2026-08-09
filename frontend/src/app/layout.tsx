import type { Metadata } from "next";
import "pannellum/build/pannellum.css";
import "./globals.css";

export const metadata: Metadata = {
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
