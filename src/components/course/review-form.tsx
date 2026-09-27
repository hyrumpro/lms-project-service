"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/server/actions/reviews";

export function ReviewForm({
  courseId,
  existingReview,
}: {
  courseId: string;
  existingReview?: { rating: number; review: string | null } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState(existingReview?.review ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitReview({
        courseId,
        rating,
        review: reviewText,
      });
      if (res.ok) {
        toast.success("Review submitted!");
        router.refresh();
      } else {
        toast.error(res.error === "not_enrolled" ? "You must be enrolled to review this course." : "Could not submit review.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="font-heading text-sm font-semibold">
        {existingReview ? "Edit your review" : "Leave a review"}
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-0.5 text-amber-500 hover:scale-110 transition-transform"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            onClick={() => setRating(star)}
            aria-label={`${star} stars`}
          >
            <Star
              className="size-5"
              fill={(hoverRating ?? rating) >= star ? "currentColor" : "none"}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground font-medium">
          {hoverRating ?? rating} of 5 stars
        </span>
      </div>

      <Textarea
        placeholder="Share your experience with this course..."
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        rows={3}
        className="text-sm resize-none"
      />

      <Button type="submit" size="sm" className="self-end" disabled={pending}>
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
        {existingReview ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
