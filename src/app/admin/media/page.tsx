import { readdir } from "node:fs/promises";
import path from "node:path";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Admin · Media" };

export default async function MediaPage() {
  const root = path.join(process.cwd(), "uploads");
  let files: string[] = [];
  try {
    const buckets = await readdir(root);
    for (const bucket of buckets) {
      const names = await readdir(path.join(root, bucket)).catch(() => []);
      files.push(...names.slice(0, 20).map((name) => `${bucket}/${name}`));
    }
  } catch {
    files = [];
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Media library"
        description="Local uploads. Set STORAGE_DRIVER=s3 to write new files to the bucket."
        action={
          <Button className="h-11" nativeButton={false} render={<a href="/api/admin/backup" />}>
            Download data backup
          </Button>
        }
      />
      {files.length === 0 ? (
        <CatalogEmpty
          icon={<ImageOff />}
          title="No uploaded files yet"
          description="Lesson files and images appear here after an instructor uploads them."
          href="/studio"
          action="Open the studio"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file}>
                <TableCell className="whitespace-normal">
                  <a className="text-coral font-medium hover:underline" href={`/api/files/uploads/${file}`}>
                    {file}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
