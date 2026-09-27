"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Moon, Sun, MoonStar } from "lucide-react";
import { useTheme } from "next-themes";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/i18n";
import { LOCALE_LABEL, locales } from "@/i18n/locales";

/** Language (EN/ES) + dark-mode controls in one settings dropdown. */
export function PreferencesMenu() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        aria-label={t("language")}
      >
        <Languages className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        {locales.map((code) => (
          <DropdownMenuItem
            key={code}
            disabled={pending || locale === code}
            onClick={() => {
              startTransition(async () => {
                await setLocale(code);
                router.refresh();
              });
            }}
          >
            {LOCALE_LABEL[code]} {locale === code && "· ✓"}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        </DropdownMenuGroup>
        <DropdownMenuGroup>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="size-3.5" aria-hidden="true" /> Light {theme === "light" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="size-3.5" aria-hidden="true" /> Dark {theme === "dark" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MoonStar className="size-3.5" aria-hidden="true" /> System {theme === "system" && "· ✓"}
        </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
