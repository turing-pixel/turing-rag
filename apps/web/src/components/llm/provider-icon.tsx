"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { getProviderIconSrc, resolveProviderTheme } from "@/lib/llm-providers";
import { cn } from "@/lib/utils";

interface ProviderIconProps {
  provider: string;
  size?: number;
  className?: string;
}

export function ProviderIcon({
  provider,
  size = 20,
  className,
}: ProviderIconProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = mounted ? resolveProviderTheme(resolvedTheme) : "light";
  const src = getProviderIconSrc(provider, theme);

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
      unoptimized
    />
  );
}
