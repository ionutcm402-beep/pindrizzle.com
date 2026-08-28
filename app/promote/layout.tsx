import type { Metadata } from "next";
import Phase9CheckoutPanel from "@/components/Phase9CheckoutPanel";
import Phase18BusinessShortcut from "@/components/Phase18BusinessShortcut";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function PromoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Phase18BusinessShortcut />
      <Phase9CheckoutPanel />
    </>
  );
}
