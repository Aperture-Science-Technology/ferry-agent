import type { ReactNode } from "react";
import "./globals.css";

type Props = {
  children: ReactNode;
};

// Root layout must exist; html/body live in [locale]/layout.tsx so lang can follow the locale.
export default function RootLayout({ children }: Props) {
  return children;
}
