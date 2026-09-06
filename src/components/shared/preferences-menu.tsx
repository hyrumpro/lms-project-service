"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Moon, Sun, MoonStar } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/server/actions/i18n";

/** Language (EN/ES) + dark-mode controls in one settings dropdown. */
export function PreferencesMenu() {
  const t = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("language")}>
            <Languages className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={pending || locale === "en"}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(async () => setLocale("en"));
          }}
        >
          🇬🇧 English {locale === "en" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending || locale === "es"}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(async () => setLocale("es"));
          }}
        >
          🇪🇸 Español {locale === "es" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        </DropdownMenuGroup>
        <DropdownMenuGroup>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun className="size-3.5" /> Light {theme === "light" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Moon className="size-3.5" /> Dark {theme === "dark" && "· ✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          <MoonStar className="size-3.5" /> System {theme === "system" && "· ✓"}
        </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
