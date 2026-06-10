"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { bootstrapArchivePersistence } from "@/lib/localArchive";

export function ArchivePersistence() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/app")) return;

    void bootstrapArchivePersistence();
  }, [pathname]);

  return null;
}
