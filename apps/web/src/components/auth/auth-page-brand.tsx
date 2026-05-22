import Image from "next/image";

import { Link } from "@/i18n/navigation";

type AuthPageBrandProps = {
  appName: string;
  subtitle: string;
  logoAlt: string;
};

export function AuthPageBrand({
  appName,
  subtitle,
  logoAlt,
}: AuthPageBrandProps) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <Link
        href="/"
        className="flex flex-col items-center gap-3 rounded-lg outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src="/logo.svg"
          alt={logoAlt}
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl"
          priority
        />
        <span className="text-2xl font-semibold tracking-tight">{appName}</span>
      </Link>
      <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
