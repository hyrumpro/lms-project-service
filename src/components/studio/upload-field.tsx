"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * File-upload field for the course builder (spec §7.8): uploads to
 * /api/upload and hands the resulting URL to the parent form.
 */
export function UploadField({
  bucket,
  accept,
  label,
  value,
  onChange,
  hint,
}: {
  bucket: string;
  accept: string;
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const body = new FormData();
      body.set("bucket", bucket);
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url);
      setFileName(file.name);
      toast.success("Uploaded");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onPick}
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          {value || fileName ? "Replace" : "Upload"}
        </Button>
        {value && (
          <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
            <Paperclip className="size-3 shrink-0" />
            <span className="truncate">{fileName ?? value.split("/").pop()}</span>
            <button
              type="button"
              className="text-coral ml-1 hover:underline"
              onClick={() => {
                onChange(null);
                setFileName(null);
              }}
            >
              remove
            </button>
          </span>
        )}
      </div>
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}
