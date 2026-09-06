"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { submitQuiz } from "@/server/actions/learning";

type QuizQuestion = {
  id: string;
  title: string;
  type: "multiple_choice" | "single_choice" | "fill_in_the_blank";
  options: string[];
};

type GradedAnswer = { questionId: string; submitted: string[]; correct: string[]; status: number };

/**
 * Quiz runner (spec §7.7). Submits to the legacy-parity grader
 * (sorted-array exact match) and renders the answer sheet.
 */
export function QuizRunner({
  courseId,
  lessonId,
  questions,
  attemptsLeft,
  previousResult,
  timeLimitMinutes,
}: {
  courseId: string;
  lessonId: string;
  questions: QuizQuestion[];
  attemptsLeft: number;
  timeLimitMinutes?: number | null;
  previousResult: { obtainedMarks: number; totalMarks: number; answers: GradedAnswer[] } | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    obtainedMarks: number;
    totalMarks: number;
    attemptsLeft: number;
    answers: GradedAnswer[];
  } | null>(
    previousResult
      ? { ...previousResult, attemptsLeft }
      : null,
  );

  // strict countdown (legacy flipclock parity): auto-submits when time runs out
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    timeLimitMinutes ? timeLimitMinutes * 60 : null,
  );
  const submittedRef = useRef(false);

  useEffect(() => {
    if (secondsLeft === null || result || submittedRef.current) return;
    if (secondsLeft <= 0) {
      submittedRef.current = true;
      void doSubmit();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((v) => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;
  const finished = result !== null && result.attemptsLeft <= 0;
  const lastAttempt = attemptsLeft <= 0 && result === null;

  function toggleOption(questionId: string, option: string, multi: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (multi) {
        return {
          ...prev,
          [questionId]: current.includes(option)
            ? current.filter((v) => v !== option)
            : [...current, option],
        };
      }
      return { ...prev, [questionId]: [option] };
    });
  }

  async function doSubmit() {
    if (pending) return;
    setPending(true);
    const response = await submitQuiz({ courseId, lessonId, answers });
    setPending(false);
    if (!response.ok) {
      toast.error(
        response.error === "no_attempts_left"
          ? "No attempts left for this quiz."
          : "Could not submit the quiz.",
      );
      return;
    }
    setResult(response);
    const scorePct = Math.round((response.obtainedMarks / response.totalMarks) * 100);
    scorePct >= 60
      ? toast.success(`Scored ${response.obtainedMarks}/${response.totalMarks} — nice!`)
      : toast(`Scored ${response.obtainedMarks}/${response.totalMarks}. Review below.`);
    router.refresh();
  }

  if (lastAttempt && !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No attempts left</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          You have used every attempt for this quiz. Your latest score is kept in your course
          progress.
        </CardContent>
      </Card>
    );
  }

  const mm = secondsLeft === null ? null : String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = secondsLeft === null ? null : String(secondsLeft % 60).padStart(2, "0");

  return (
    <form onSubmit={(e) => { e.preventDefault(); void doSubmit(); }} className="flex flex-col gap-5">
      {secondsLeft !== null && !result && (
        <div
          role="timer"
          aria-live="polite"
          className={`flex items-center justify-between rounded-lg border-2 px-4 py-2.5 text-sm font-semibold ${
            secondsLeft < 60
              ? "border-destructive text-destructive"
              : "border-sun bg-sun/10 text-sun-foreground"
          }`}
        >
          <span>Time left</span>
          <span className="font-mono text-lg tabular-nums">
            {mm}:{ss}
          </span>
        </div>
      )}
      {!result && (
        <div className="bg-secondary/50 flex items-center gap-3 rounded-lg px-4 py-2.5">
          <Progress
            value={(answeredCount / questions.length) * 100}
            className="flex-1"
            aria-label={`answered ${answeredCount} of ${questions.length}`}
          />
          <span className="text-muted-foreground shrink-0 text-xs font-medium">
            {answeredCount} / {questions.length} answered
          </span>
        </div>
      )}

      {result && (
        <div
          className={`relative flex items-center gap-5 overflow-hidden rounded-2xl border-2 p-6 ${
            result.obtainedMarks / result.totalMarks >= 0.6
              ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <div
            className={`font-heading flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${
              result.obtainedMarks / result.totalMarks >= 0.6
                ? "border-teal-600 text-teal-700 dark:text-teal-400"
                : "border-destructive text-destructive"
            }`}
            aria-hidden
          >
            <span className="text-xl font-bold">
              {Math.round((result.obtainedMarks / result.totalMarks) * 100)}%
            </span>
          </div>
          <div>
            <p className="font-heading text-xl font-semibold">
              You scored {result.obtainedMarks} / {result.totalMarks}
            </p>
            <p className="text-muted-foreground text-sm">
              {result.obtainedMarks === result.totalMarks
                ? "Flawless — every answer correct!"
                : result.obtainedMarks / result.totalMarks >= 0.6
                  ? "Passed — review the sheet below and continue."
                  : "Below the pass line — review and use your remaining attempts."}
            </p>
          </div>
        </div>
      )}

      {questions.map((question, index) => {
        const graded = result?.answers.find((a) => a.questionId === question.id);
        const multi = question.type === "multiple_choice";
        return (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base leading-snug">
                  <span className="text-muted-foreground mr-2 font-mono text-xs">
                    Q{index + 1}
                  </span>
                  {question.title}
                </CardTitle>
                {graded && (
                  <Badge variant={graded.status === 1 ? "secondary" : "destructive"}>
                    {graded.status === 1 ? "✓ Correct" : "✗ Incorrect"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {question.type === "fill_in_the_blank" ? (
                <Field>
                  <FieldLabel className="sr-only" htmlFor={`q-${question.id}`}>
                    Your answer
                  </FieldLabel>
                  <Input
                    id={`q-${question.id}`}
                    placeholder="Type your answer…"
                    autoComplete="off"
                    disabled={Boolean(result)}
                    value={answers[question.id]?.[0] ?? ""}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [question.id]: [event.target.value] }))
                    }
                  />
                  {graded && (
                    <p className="text-muted-foreground text-xs">
                      Correct answer: <strong>{graded.correct.join(", ")}</strong>
                    </p>
                  )}
                </Field>
              ) : (
                <div className="flex flex-col gap-2" role="group" aria-label={question.title}>
                  {question.options.map((option) => {
                    const checked = (answers[question.id] ?? []).includes(option);
                    const isCorrectChoice = graded?.correct.includes(option);
                    const isWrongPick = graded?.submitted.includes(option) && !isCorrectChoice;
                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                          isCorrectChoice
                            ? "border-teal-600 bg-teal-50 dark:bg-teal-950/40"
                            : isWrongPick
                              ? "border-destructive/50 bg-destructive/5"
                              : "hover:bg-secondary/60"
                        } ${result ? "cursor-default" : ""}`}
                      >
                        <Checkbox
                          checked={checked || Boolean(isCorrectChoice)}
                          disabled={Boolean(result)}
                          onCheckedChange={() => toggleOption(question.id, option, multi)}
                          aria-label={option}
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {result ? (
        <Card className="border-coral">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="font-heading text-2xl font-semibold">
                {result.obtainedMarks} / {result.totalMarks}
              </p>
              <p className="text-muted-foreground text-sm">
                {result.attemptsLeft > 0
                  ? `${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left`
                  : "That was your final attempt"}
              </p>
            </div>
            <Badge variant="outline" className="text-base">
              {Math.round((result.obtainedMarks / result.totalMarks) * 100)}%
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            Submit quiz
          </Button>
          <p className="text-muted-foreground text-xs">
            {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} remaining
          </p>
        </div>
      )}
    </form>
  );
}
