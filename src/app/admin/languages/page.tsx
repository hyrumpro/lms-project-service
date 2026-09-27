import { readFileSync } from "node:fs";
import path from "node:path";
import { Languages } from "lucide-react";
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
import { LEGACY_FILE, locales } from "@/i18n/locales";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { SettingsSection } from "@/components/shared/settings-section";
import { savePhrase, importPhrases } from "@/server/actions/phrases";

export const metadata = { title: "Admin · Languages" };

export default async function LanguagesPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale } = await searchParams;
  const selected = locales.includes(locale as (typeof locales)[number]) ? locale! : "en";
  const file = path.join(
    process.cwd(),
    "..",
    "Academy-LMS",
    "languages",
    `${LEGACY_FILE[selected as keyof typeof LEGACY_FILE]}.json`,
  );
  let entries: [string, string][] = [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string | null>;
    entries = Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .slice(0, 40);
  } catch {
    entries = [];
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Languages"
        description={`Editing ${selected}. The first 40 phrases are shown. Export the full file before a large import.`}
        action={
          <Button className="h-11" variant="outline" nativeButton={false} render={<a href={`/api/admin/phrases?locale=${selected}`} />}>
            Export JSON
          </Button>
        }
      />
      <nav aria-label="Locales" className="flex flex-wrap gap-2">
        {locales.map((code) => (
          <Button
            key={code}
            className="h-11"
            variant={code === selected ? "default" : "outline"}
            nativeButton={false}
            render={<a href={`/admin/languages?locale=${code}`} />}
            aria-current={code === selected ? "page" : undefined}
          >
            {code}
          </Button>
        ))}
      </nav>
      <form action={importPhrases}>
        <input type="hidden" name="locale" value={selected} />
        <SettingsSection
          title="Import JSON"
          description='Paste an object such as {"Hello":"Hola"}. Existing keys for this locale are updated.'
          footer={
            <Button className="h-11" type="submit">
              Import JSON
            </Button>
          }
        >
          <Field>
            <FieldLabel htmlFor="json">Phrase JSON</FieldLabel>
            <Textarea id="json" name="json" className="min-h-28 font-mono text-sm" />
          </Field>
        </SettingsSection>
      </form>
      {entries.length === 0 ? (
        <CatalogEmpty
          icon={<Languages />}
          title="No phrases for this locale"
          description="The language file is missing or empty. Import a JSON object to start translating."
          href="/admin/languages?locale=en"
          action="Open English"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Phrase</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Save</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, value], index) => {
              const formId = `phrase-${selected}-${index}`;
              return (
              <TableRow key={key}>
                <TableCell className="max-w-48 whitespace-normal align-top">
                  <form id={formId} action={savePhrase}>
                    <input type="hidden" name="locale" value={selected} />
                    <input type="hidden" name="key" value={key} />
                    <span className="text-muted-foreground text-xs [overflow-wrap:anywhere]">{key}</span>
                  </form>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Input name="value" form={formId} defaultValue={value} className="h-11" />
                </TableCell>
                <TableCell>
                  <Button className="h-11" type="submit" form={formId}>
                    Save
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
