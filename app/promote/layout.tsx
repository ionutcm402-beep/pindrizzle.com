import Phase9CheckoutPanel from "@/components/Phase9CheckoutPanel";

export default function PromoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Phase9CheckoutPanel />
    </>
  );
}
