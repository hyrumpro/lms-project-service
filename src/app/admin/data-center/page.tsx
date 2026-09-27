import { Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Admin · Data center" };

export default function DataCenterPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Data center"
        description="Download a JSON snapshot of users, courses, and settings."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" aria-hidden="true" />
            Backup
          </CardTitle>
          <CardDescription>The file is generated when you download it. It is not stored on the server.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Includes account data</AlertTitle>
            <AlertDescription>
              Keep the snapshot private. It contains user records and system settings.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button className="h-11" nativeButton={false} render={<a href="/api/admin/backup" />}>
            Download backup
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
