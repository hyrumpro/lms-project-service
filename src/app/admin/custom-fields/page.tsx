import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { courses, settings } from "@/db/schema";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { SettingsSection } from "@/components/shared/settings-section";
import { saveCustomField, setCourseFieldValue } from "@/server/actions/custom-fields";
import { ListTree } from "lucide-react";

export const metadata = { title: "Admin · Custom fields" };

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export default async function CustomFieldsPage() {
  const [row] = await db.select().from(settings).where(eq(settings.key, "custom_fields"));
  const fields = Array.isArray(row?.value) ? (row.value as { section: string; key: string; label: string }[]) : [];
  const courseRows = await db.select({ id: courses.id, title: courses.title }).from(courses).limit(30);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Custom fields"
        description="Define extra course attributes, then store a value on a specific course."
      />
      <form action={saveCustomField}>
        <SettingsSection
          title="New field"
          footer={
            <Button className="h-11" type="submit">
              Add field
            </Button>
          }
        >
          <Field>
            <FieldLabel htmlFor="section">Section</FieldLabel>
            <Input id="section" name="section" required className="h-11" />
          </Field>
          <Field>
            <FieldLabel htmlFor="key">Key</FieldLabel>
            <Input id="key" name="key" required className="h-11" autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="label">Label</FieldLabel>
            <Input id="label" name="label" required className="h-11" />
          </Field>
        </SettingsSection>
      </form>

      {fields.length === 0 ? (
        <CatalogEmpty
          icon={<ListTree />}
          title="No custom fields yet"
          description="Add a section, key, and label above. Fields show up here once they are saved."
          href="/admin/courses"
          action="Open courses"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field.key}>
                <TableCell>{field.section}</TableCell>
                <TableCell>{field.label}</TableCell>
                <TableCell className="font-mono text-xs">{field.key}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {courseRows[0] && fields[0] ? (
        <form action={setCourseFieldValue}>
          <SettingsSection
            title="Course value"
            description="Pick a course and a field, then save the value."
            footer={
              <Button className="h-11" type="submit">
                Save course value
              </Button>
            }
          >
            <Field>
              <FieldLabel htmlFor="courseId">Course</FieldLabel>
              <select id="courseId" name="courseId" className={selectClass}>
                {courseRows.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="fieldKey">Field</FieldLabel>
              <select id="fieldKey" name="key" className={selectClass}>
                {fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="value">Value</FieldLabel>
              <Input id="value" name="value" className="h-11" />
            </Field>
          </SettingsSection>
        </form>
      ) : null}
    </div>
  );
}
