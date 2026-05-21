export const DEFAULT_KB_ICON_COLOR = "primary" as const;

export const KB_ICON_COLOR_NAMES = [
  "primary",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "lime",
  "amber",
  "orange",
  "rose",
  "pink",
  "fuchsia",
  "violet",
  "indigo",
  "slate",
] as const;

export type KbIconColor = (typeof KB_ICON_COLOR_NAMES)[number];

const KB_ICON_COLOR_SET = new Set<string>(KB_ICON_COLOR_NAMES);

export function resolveKbIconColor(
  color: string | null | undefined
): KbIconColor {
  if (color && KB_ICON_COLOR_SET.has(color)) {
    return color as KbIconColor;
  }
  return DEFAULT_KB_ICON_COLOR;
}

type KbIconColorStyles = {
  pedestal: string;
  icon: string;
  swatch: string;
};

const KB_ICON_COLOR_STYLES: Record<KbIconColor, KbIconColorStyles> = {
  primary: {
    pedestal: "bg-primary/10",
    icon: "text-primary",
    swatch: "bg-primary/25",
  },
  blue: {
    pedestal: "bg-blue-500/10",
    icon: "text-blue-600 dark:text-blue-400",
    swatch: "bg-blue-500/25",
  },
  sky: {
    pedestal: "bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    swatch: "bg-sky-500/25",
  },
  cyan: {
    pedestal: "bg-cyan-500/10",
    icon: "text-cyan-600 dark:text-cyan-400",
    swatch: "bg-cyan-500/25",
  },
  teal: {
    pedestal: "bg-teal-500/10",
    icon: "text-teal-600 dark:text-teal-400",
    swatch: "bg-teal-500/25",
  },
  emerald: {
    pedestal: "bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    swatch: "bg-emerald-500/25",
  },
  lime: {
    pedestal: "bg-lime-500/10",
    icon: "text-lime-600 dark:text-lime-400",
    swatch: "bg-lime-500/25",
  },
  amber: {
    pedestal: "bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    swatch: "bg-amber-500/25",
  },
  orange: {
    pedestal: "bg-orange-500/10",
    icon: "text-orange-600 dark:text-orange-400",
    swatch: "bg-orange-500/25",
  },
  rose: {
    pedestal: "bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
    swatch: "bg-rose-500/25",
  },
  pink: {
    pedestal: "bg-pink-500/10",
    icon: "text-pink-600 dark:text-pink-400",
    swatch: "bg-pink-500/25",
  },
  fuchsia: {
    pedestal: "bg-fuchsia-500/10",
    icon: "text-fuchsia-600 dark:text-fuchsia-400",
    swatch: "bg-fuchsia-500/25",
  },
  violet: {
    pedestal: "bg-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
    swatch: "bg-violet-500/25",
  },
  indigo: {
    pedestal: "bg-indigo-500/10",
    icon: "text-indigo-600 dark:text-indigo-400",
    swatch: "bg-indigo-500/25",
  },
  slate: {
    pedestal: "bg-slate-500/10",
    icon: "text-slate-600 dark:text-slate-400",
    swatch: "bg-slate-500/25",
  },
};

export function getKbIconColorStyles(color: KbIconColor): KbIconColorStyles {
  return KB_ICON_COLOR_STYLES[resolveKbIconColor(color)];
}
