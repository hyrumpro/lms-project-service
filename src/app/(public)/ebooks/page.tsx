import { desc } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { ebooks } from "@/db/schema";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { purchaseEbookForm } from "@/server/actions/addons";

export const metadata = { title: "Ebooks" };

export default async function EbooksPage() {
  const rows = await db.select().from(ebooks).orderBy(desc(ebooks.createdAt));
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <PageIntro kicker="Catalog" title="Ebooks" description="Download a book on its own, or get a free title instantly." />
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<BookOpen />}
          title="No ebooks yet"
          description="Published ebooks will appear here with a price and a download."
          href="/courses"
          action="Browse courses"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((book) => (
            <li key={book.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{book.title}</CardTitle>
                  {book.category ? <CardDescription>{book.category}</CardDescription> : null}
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-semibold tabular-nums">
                    {book.price === 0 ? "Free" : `$${(book.price / 100).toFixed(2)}`}
                  </p>
                </CardContent>
                <CardFooter className="gap-3">
                  <form action={purchaseEbookForm}>
                    <input type="hidden" name="slug" value={book.slug} />
                    <Button className="h-11" type="submit">
                      {book.price === 0 ? "Get ebook" : "Buy ebook"}
                    </Button>
                  </form>
                  {book.fileUrl ? (
                    <Button className="h-11" variant="outline" nativeButton={false} render={<a href={book.fileUrl} />}>
                      Open file
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
