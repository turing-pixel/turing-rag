"use client";

import { createElement } from "react";

import { cn } from "@/lib/utils";
import { KB_ICONS, resolveKbIconName } from "@/lib/kb-icons";
import {
  getKbIconColorStyles,
  resolveKbIconColor,
} from "@/lib/kb-icon-colors";

interface KnowledgeBaseIconProps {
  icon: string | null | undefined;
  iconColor?: string | null;
  className?: string;
  iconClassName?: string;
}

export function KnowledgeBaseIcon({
  icon,
  iconColor,
  className,
  iconClassName,
}: KnowledgeBaseIconProps) {
  const { pedestal, icon: iconTone } = getKbIconColorStyles(
    resolveKbIconColor(iconColor)
  );

  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-lg",
        pedestal,
        className
      )}
    >
      {createElement(KB_ICONS[resolveKbIconName(icon)], {
        className: cn("size-5", iconTone, iconClassName),
        "aria-hidden": true,
      })}
    </div>
  );
}
