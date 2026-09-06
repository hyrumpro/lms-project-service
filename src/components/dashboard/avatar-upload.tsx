"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Profile avatar upload (legacy users.image parity): uploads then updates the session user. */
export function AvatarUpload({ currentImage }: { currentImage: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [image, setImage] = useState(currentImage);

  async function onPick(file: File) {
    setPending(true);
    try {
      const body = new FormData();
      body.set("bucket", "user_image");
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      const { authClient } = await import("@/lib/auth-client");
      const { error } = await authClient.updateUser({ image: data.url });
      if (error) {
        toast.error(error.message ?? "Could not save the avatar.");
        return;
      }
      setImage(data.url);
      toast.success("Avatar updated");
      router.refresh();
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative w-fit">
      <Avatar className="size-20 border">
        <AvatarImage src={image ?? undefined} alt="Your avatar" />
        <AvatarFallback className="text-xl">?</AvatarFallback>
      </Avatar>
      <button
        type="button"
        aria-label="Upload avatar"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-background disabled:opacity-60"
      >
        {pending ? <Loader2 className="animate-spin size-3.5" /> : <Camera className="size-3.5" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
        }}
      />
    </div>
  );
}
