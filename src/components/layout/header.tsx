import Link from "next/link";
import { headers } from "next/headers";
import { Bell, GraduationCap, Menu, ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { auth } from "@/lib/auth";
import { getSystemSettings } from "@/lib/settings";
import { getUnreadCount } from "@/server/queries/community";
import { getCategoryTree } from "@/server/queries/catalog";
import { getCategoryCounts } from "@/server/queries/catalog";
import { getCartCount } from "@/server/queries/commerce";
import { SignOutMenuItem } from "@/components/layout/sign-out-button";
import { PreferencesMenu } from "@/components/shared/preferences-menu";

export async function Header() {
  const t = await getTranslations("nav");
  const session = await auth.api.getSession({ headers: await headers() });
  const [system, unread, cartCount, categoryTree] = await Promise.all([
    getSystemSettings(),
    session ? getUnreadCount(session.user.id) : Promise.resolve(0),
    session ? getCartCount(session.user.id) : Promise.resolve(0),
    getCategoryTree(),
  ]);
  const user = session?.user;

  const mobileLinks = [
    { href: "/", label: t("home") },
    { href: "/courses", label: t("courses") },
    { href: "/courses?price=free", label: t("freeCourses") },
    { href: "/blog", label: t("blog") },
  ];

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
        {/* mobile nav */}
        <Sheet>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
            aria-label={t("openMenu")}
          >
            <Menu className="size-4" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-heading flex items-center gap-2">
                <GraduationCap className="size-4" aria-hidden="true" />
                {system.name}
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col px-4">
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground border-l-2 border-transparent py-2.5 pl-3 text-sm hover:border-coral hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              {user && (
                <Link
                  href="/dashboard"
                  className="text-coral py-2.5 pl-3 text-sm font-medium hover:underline"
                >
                  {t("dashboard")}
                </Link>
              )}
              {!user && (
                <>
                  <div className="rule-dash my-2" aria-hidden />
                  <Link href="/sign-in" className="text-muted-foreground py-2.5 pl-3 text-sm hover:text-foreground">
                    {t("signIn")}
                  </Link>
                  <Link href="/sign-up" className="text-muted-foreground py-2.5 pl-3 text-sm hover:text-foreground">
                    {t("signUp")}
                  </Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2" aria-label={`${system.name} home`}>
          <GraduationCap className="size-6" aria-hidden="true" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            {system.name}
            <span className="text-coral">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>{t("home")}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "ghost" })}>
              {t("courses")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 overflow-auto">
              <DropdownMenuGroup>
              <DropdownMenuLabel>{t("courses")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/courses" />}>All Courses</DropdownMenuItem>
              {categoryTree.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  render={<Link href={`/courses?category=${category.slug}`} />}
                >
                  {category.name}
                </DropdownMenuItem>
              ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" nativeButton={false} render={<Link href="/pricing" />}>{t("pricing")}</Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/blog" />}>{t("blog")}</Button>
        </nav>

        <form action="/courses" className="ml-auto hidden w-64 sm:block">
          <Input type="search" name="q" placeholder={t("search")} aria-label={t("search")} />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <PreferencesMenu />
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            nativeButton={false}
            aria-label={cartCount > 0 ? `${t("cart")}: ${cartCount}` : t("cart")}
            render={<Link href="/dashboard/shopping-cart" />}
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="bg-coral text-coral-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
                {cartCount}
              </span>
            )}
          </Button>

          {user ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                nativeButton={false}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                render={<Link href="/dashboard/notifications" />}
              >
                <Bell className={cn("size-4", unread > 0 && "text-coral")} aria-hidden="true" />
                {unread > 0 && (
                  <span className="bg-coral text-coral-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton
                  render={
                    <button type="button" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <Avatar className="size-8">
                        <AvatarImage src={user.image ?? undefined} alt={user.name} />
                        <AvatarFallback>
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link href="/dashboard" />}>{t("dashboard")}</DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/dashboard/my-courses" />}>{t("myCourses")}</DropdownMenuItem>
                    {user.isInstructor && (
                      <DropdownMenuItem render={<Link href="/studio" />}>
                        Instructor studio
                      </DropdownMenuItem>
                    )}
                    {user.role === "admin" && (
                      <DropdownMenuItem render={<Link href="/admin" />}>{t("admin")}</DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <SignOutMenuItem />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/sign-in" />}>{t("signIn")}</Button>
              <Button className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/sign-up" />}>{t("signUp")}</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
