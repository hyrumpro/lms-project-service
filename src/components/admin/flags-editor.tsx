"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setAdminFlags } from "@/server/actions/admin";

const SECTIONS = [
  { key: "categories", label: "Categories" },
  { key: "courses", label: "Courses" },
  { key: "users", label: "Users" },
  { key: "commerce", label: "Commerce" },
  { key: "content", label: "Content" },
  { key: "newsletters", label: "Newsletters" },
] as const;

/** Granular admin permission toggles (legacy permissions page parity). */
export function AdminFlagsEditor({
  userId,
  flags,
}: {
  userId: string;
  flags: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, boolean>>({ ...flags });
  const dirty = SECTIONS.some((s) => (local[s.key] ?? true) !== (flags[s.key] ?? true));

  function toggle(key: string, checked: boolean) {
    setLocal((prev) => ({ ...prev, [key]: checked }));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="kicker text-[10px]">Access</span>
      {SECTIONS.map((section) => (
        <label key={section.key} className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={local[section.key] ?? true}
            onCheckedChange={(checked) => toggle(section.key, checked === true)}
            disabled={pending}
          />
          {section.label}
        </label>
      ))}
      {dirty && (
        <button
          type="button"
          className="text-coral text-xs font-medium hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setAdminFlags(userId, local);
              if (result.ok) {
                toast.success("Permissions updated");
                router.refresh();
              } else toast.error(result.error ?? "Could not save");
            })
          }
        >
          Save
        </button>
      )}
    </div>
  );
}
