"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createCustomPage,
  deleteCustomPage,
  moderateCourse,
  moderatePost,
  setUserDisabled,
  setUserInstructor,
  reviewApplication,
  approveOfflineOrder,
  reviewPayout,
  createCoupon,
  deleteCoupon,
  deleteReview,
} from "@/server/actions/admin";

function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        if (success) toast.success(success);
        router.refresh();
      } else {
        toast.error("Action failed" + (result.error ? `: ${result.error}` : ""));
      }
    });
  return { pending, run };
}

export function ModerateCourseButtons({ courseId, status }: { courseId: string; status: string }) {
  const { pending, run } = useAdminAction();
  if (status === "active") {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => moderateCourse(courseId, "draft"), "Unpublished")}>
        Unpublish
      </Button>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(() => moderateCourse(courseId, "active"), "Published")}>
        {pending ? <Spinner /> : <Check data-icon="inline-start" />}
        Approve
      </Button>
      {status === "pending" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => moderateCourse(courseId, "draft"), "Sent back to draft")}>
          <X data-icon="inline-start" />
          Deny
        </Button>
      )}
    </div>
  );
}

export function ModeratePostButtons({ postId }: { postId: string }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(() => moderatePost(postId, "published"), "Published")}>
        Publish
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => moderatePost(postId, "draft"), "Sent back to draft")}>
        <X data-icon="inline-start" />
      </Button>
    </div>
  );
}

export function UserToggles({
  userId,
  isInstructor,
  disabled,
}: {
  userId: string;
  isInstructor: boolean;
  disabled: boolean;
}) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex gap-1.5">
      <Button
        variant={isInstructor ? "secondary" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() => run(() => setUserInstructor(userId, !isInstructor))}
      >
        {isInstructor ? "Revoke instructor" : "Make instructor"}
      </Button>
      <Button
        variant={disabled ? "destructive" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() => run(() => setUserDisabled(userId, !disabled))}
      >
        {disabled ? "Enable" : "Disable"}
      </Button>
    </div>
  );
}

export function ApplicationButtons({ applicationId }: { applicationId: string }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(() => reviewApplication(applicationId, true), "Approved — instructor unlocked")}>
        Approve
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reviewApplication(applicationId, false), "Rejected")}>
        Reject
      </Button>
    </div>
  );
}

export function OfflineApproveButton({ orderId }: { orderId: string }) {
  const { pending, run } = useAdminAction();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => approveOfflineOrder(orderId), "Order fulfilled")}>
      {pending ? <Spinner /> : <Check data-icon="inline-start" />}
      Confirm payment
    </Button>
  );
}

export function PayoutButtons({ payoutId, status }: { payoutId: string; status: string }) {
  const { pending, run } = useAdminAction();
  if (status !== "requested") return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(() => reviewPayout(payoutId, "paid", `MANUAL-${Date.now()}`), "Marked paid")}>
        Mark paid
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reviewPayout(payoutId, "rejected"), "Rejected")}>
        Reject
      </Button>
    </div>
  );
}

export function CouponForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCoupon({ code, discountPercentage: Number(percent) });
          if (result.ok) {
            toast.success("Coupon created");
            setCode("");
            setPercent("");
            router.refresh();
          } else toast.error("Invalid coupon (3+ chars, 1–100%)");
        });
      }}
    >
      <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-32" required />
      <Input
        placeholder="%"
        type="number"
        min={1}
        max={100}
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        className="w-20"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        Add coupon
      </Button>
    </form>
  );
}

export function DeleteRowButton({
  kind,
  id,
  label = "Delete",
}: {
  kind: "coupon" | "review";
  id: string;
  label?: string;
}) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={pending}
      onClick={() => run(() => (kind === "coupon" ? deleteCoupon(id) : deleteReview(id)), "Deleted")}
    >
      {pending ? <Spinner /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}


export function CustomPageForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createCustomPage({
        title: String(fd.get('title')),
        content: String(fd.get('content')),
      });
      if (result.ok) {
        toast.success('Page created — live at /p/…');
        form.reset();
        router.refresh();
      } else toast.error('Title 2+ chars, content required');
    });
  }

  return (
    <form onSubmit={onSubmit} className='flex flex-col gap-2'>
      <Input name='title' required minLength={2} placeholder='Page title (URL is generated)' aria-label='Page title' />
      <textarea
        name='content'
        required
        rows={3}
        placeholder='<p>Page content (HTML)</p>'
        aria-label='Page content'
        className='min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring'
      />
      <Button type='submit' size='sm' disabled={pending} className='w-fit'>
        {pending && <Spinner data-icon='inline-start' />}
        Create page
      </Button>
    </form>
  );
}

export function CustomPageDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label='Delete page'
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { deleteCustomPage } = await import('@/server/actions/admin');
          const result = await deleteCustomPage(id);
          if (result.ok) {
            toast.success('Page deleted');
            router.refresh();
          } else toast.error('Could not delete');
        })
      }
    >
      {pending ? <Spinner /> : <Trash2 className='size-3.5' />}
    </Button>
  );
}
