import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { seoMeta } from "@/db/schema";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { SettingsSection } from "@/components/shared/settings-section";
import { saveSeo } from "@/server/actions/platform-admin";

export const metadata = { title: "Admin · SEO" };

export default async function SeoAdminPage() {
  const rows = await db.select().from(seoMeta);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="SEO"
        description="Set the title and description used for a public route."
      />
      <form action={saveSeo}>
        <SettingsSection
          title="Route meta"
          footer={
            <Button className="h-11" type="submit">
              Save route
            </Button>
          }
        >
          <Field>
            <FieldLabel htmlFor="route">Route</FieldLabel>
            <Input id="route" name="route" required placeholder="/courses" className="h-11" />
          </Field>
          <Field>
            <FieldLabel htmlFor="metaTitle">Title</FieldLabel>
            <Input id="metaTitle" name="metaTitle" className="h-11" />
          </Field>
          <Field>
            <FieldLabel htmlFor="metaDescription">Description</FieldLabel>
            <Textarea id="metaDescription" name="metaDescription" className="min-h-24" />
          </Field>
        </SettingsSection>
      </form>
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<Search />}
          title="No routes saved"
          description="Add a path such as /courses. The public pages will use that title and description."
          href="/courses"
          action="View the catalog"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.route}>
                <TableCell className="font-medium">{row.route}</TableCell>
                <TableCell className="text-muted-foreground whitespace-normal">{row.metaTitle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
