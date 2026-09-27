"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Send } from "lucide-react";
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

interface Recipient {
  id: string;
  name: string;
  isInstructor?: boolean | null;
  role?: string | null;
  image?: string | null;
}

export function NewConversationDialog({ recipients }: { recipients: Recipient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId) {
      toast.error("Please select a recipient.");
      return;
    }
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
          <Button size="sm" className="gap-2">
            <MessageSquarePlus className="size-4" />
            New conversation
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Send a direct message to an instructor or peer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recipient-select" className="text-xs font-medium text-foreground">
              Recipient
            </label>
            <select
              id="recipient-select"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            >
              <option value="">Select a user...</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isInstructor ? "(Instructor)" : r.role === "admin" ? "(Admin)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="message-body" className="text-xs font-medium text-foreground">
              Message
            </label>
            <Textarea
              id="message-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              required
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !message.trim() || !recipientId}>
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
