import Phase9CheckoutPanel from "@/components/Phase9CheckoutPanel";
import Phase18BusinessShortcut from "@/components/Phase18BusinessShortcut";

export default function PromoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Phase18BusinessShortcut />
      <Phase9CheckoutPanel />
    </>
  );
}
