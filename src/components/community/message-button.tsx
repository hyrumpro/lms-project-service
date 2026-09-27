"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { createMessageThread } from "@/server/actions/community";

interface MessageButtonProps {
  recipientId: string;
  recipientName: string;
  currentUserId?: string | null;
  buttonText?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
}

export function MessageButton({
  recipientId,
  recipientName,
  currentUserId,
  buttonText = "Message",
  variant = "outline",
  size = "sm",
  className,
}: MessageButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (currentUserId && currentUserId === recipientId) {
    return null;
  }

  function handleTriggerClick(e: React.MouseEvent) {
    if (!currentUserId) {
      e.preventDefault();
      router.push("/sign-in");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setPending(true);
    const res = await createMessageThread({
      recipientId,
      message: trimmed,
    });
    setPending(false);

    if (res.ok) {
      toast.success("Message sent!");
      setOpen(false);
      setMessage("");
      router.push(`/dashboard/messages/${res.threadCode}`);
    } else {
      toast.error(
        res.error === "cannot_message_self"
          ? "You cannot message yourself."
          : "Failed to send message.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleTriggerClick}
          />
        }
      >
        <MessageSquare className="size-4" />
        {buttonText && <span>{buttonText}</span>}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message {recipientName}</DialogTitle>
          <DialogDescription>
            Send a direct message to start a conversation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows={4}
            required
            autoFocus
            className="resize-none"
          />

          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !message.trim()}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send className="size-4" data-icon="inline-start" />
              )}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
