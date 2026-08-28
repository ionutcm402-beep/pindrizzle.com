"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const ProductClientRuntime = dynamic(() => import("@/components/ProductClientRuntime"), {
  ssr: false,
  loading: () => null,
});

const STATIC_ROUTES = new Set(["/privacy", "/cookies", "/terms", "/safety"]);

export default function ProductRuntimeGate() {
  const pathname = usePathname();
  if (STATIC_ROUTES.has(pathname)) return null;
  return <ProductClientRuntime />;
}
