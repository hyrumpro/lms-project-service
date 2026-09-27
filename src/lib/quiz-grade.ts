/**
 * Quiz grading (spec §3.2 and §12.3).
 * Choice questions: sorted arrays must match exactly.
 * Fill-in-the-blank: trimmed, case-insensitive match.
 */
export function enrollmentState(enrollment: { expiresAt: Date | null } | null, now = new Date()) {
  if (!enrollment) return "none" as const;
  if (enrollment.expiresAt && enrollment.expiresAt < now) return "expired" as const;
  return "valid" as const;
}

export function answersMatch(
  type: string,
  submitted: string[],
  correct: string[],
): boolean {
  const normalize = (values: string[]) =>
    type === "fill_in_the_blank"
      ? values.map((value) => value.trim().toLowerCase()).sort()
      : [...values].sort();
  const left = normalize(submitted);
  const right = normalize(correct);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
