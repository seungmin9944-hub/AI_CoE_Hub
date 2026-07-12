import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const noto = Noto_Sans_KR({ variable: "--font-noto", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "AI CoE Hub | 한화이센셜";
  const description = "한화이센셜 임직원을 위한 AI 실습 가이드, 프롬프트와 자료 저장소";
  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1734, height: 907, alt: "AI CoE Hub — Data to Live Web" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={noto.variable}>{children}</body></html>;
}
