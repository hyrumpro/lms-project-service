import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { CookieBanner } from "@/components/shared/cookie-banner";
import { PortfolioModal } from "@/components/shared/portfolio-modal";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      <CookieBanner />
      <PortfolioModal />
    </div>
  );
}
