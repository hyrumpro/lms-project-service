"use client";

import { useRouter } from "next/navigation";
import { QuizTimeLimitInput } from "@/components/studio/quiz-time-limit";
import { UploadField } from "@/components/studio/upload-field";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  addLesson,
  addQuizQuestion,
  addSection,
  deleteLesson,
  deleteQuizQuestion,
  deleteSection,
  moveLesson,
} from "@/server/actions/studio";

type Question = {
  id: string;
  title: string;
  type: string;
  options: string[];
  correctAnswers: string[];
};
type Lesson = {
  id: string;
  title: string;
  type: string;
  isFreePreview: boolean;
  durationSeconds: number;
  questions: Question[];
  timeLimitMinutes?: number | null;
};
type Section = { id: string; title: string; lessons: Lesson[] };

export function CurriculumManager({
  courseId,
  sections,
}: {
  courseId: string;
  sections: Section[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        if (done) toast.success(done);
        router.refresh();
      } else {
        toast.error(result.error ?? "Action failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {pending && <Spinner />}
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className="rounded-xl border bg-card">
          <header className="flex items-center gap-3 border-b p-4">
            <span className="kicker">{String(sectionIndex + 1).padStart(2, "0")}</span>
            <h2 className="font-heading font-semibold">{section.title}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-destructive"
              aria-label={`Delete section ${section.title}`}
              onClick={() => act(() => deleteSection(courseId, section.id), "Section deleted.")}
            >
              <Trash2 className="size-4" />
            </Button>
          </header>

          <ul className="flex flex-col">
            {section.lessons.map((lesson, lessonIndex) => (
              <li key={lesson.id} className="border-b last:border-b-0">
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0 text-xs uppercase">
                    {lesson.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{lesson.title}</span>
                  {lesson.isFreePreview && (
                    <span className="text-muted-foreground text-xs">preview</span>
                  )}
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move up"
                      disabled={lessonIndex === 0}
                      onClick={() => act(() => moveLesson(courseId, lesson.id, "up"))}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move down"
                      disabled={lessonIndex === section.lessons.length - 1}
                      onClick={() => act(() => moveLesson(courseId, lesson.id, "down"))}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    {lesson.type === "quiz" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Toggle quiz builder"
                        onClick={() =>
                          setOpenLesson(openLesson === lesson.id ? null : lesson.id)
                        }
                      >
                        {openLesson === lesson.id ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive"
                      aria-label={`Delete lesson ${lesson.title}`}
                      onClick={() => act(() => deleteLesson(courseId, lesson.id), "Lesson deleted.")}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {lesson.type === "quiz" && openLesson === lesson.id && (
                  <QuizBuilder
                    courseId={courseId}
                    lesson={lesson}
                    onAdd={(q) =>
                      act(
                        () => addQuizQuestion({ courseId, lessonId: lesson.id, ...q }),
                        "Question added.",
                      )
                    }
                    onDelete={(questionId) =>
                      act(() => deleteQuizQuestion(courseId, questionId), "Question deleted.")
                    }
                  />
                )}
              </li>
            ))}
          </ul>

          <AddLessonForm
            key={section.id + section.lessons.length}
            onSubmit={(values) =>
              act(
                () => addLesson({ courseId, sectionId: section.id, ...values }),
                "Lesson added.",
              )
            }
          />
        </section>
      ))}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newSectionTitle.trim().length < 2) return;
          act(() => addSection(courseId, newSectionTitle), "Section added.");
          setNewSectionTitle("");
        }}
      >
        <Input
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          placeholder="New section title…"
          aria-label="New section title"
        />
        <Button type="submit">
          <Plus data-icon="inline-start" />
          Add section
        </Button>
      </form>
    </div>
  );
}

function AddLessonForm({
  onSubmit,
}: {
  onSubmit: (values: {
    title: string;
    type: "video" | "audio" | "document" | "text" | "quiz" | "image";
    provider?: "youtube" | "vimeo" | "html5" | "iframe" | "external" | "s3" | "wasabi" | "google_drive" | "stream";
    url?: string;
    body?: string;
    caption?: string;
    durationMinutes?: number;
    isFreePreview?: boolean;
  }) => void;
}) {
  const [type, setType] = useState<"video" | "audio" | "document" | "text" | "quiz" | "image">("video");
  const [provider, setProvider] = useState("youtube");
  const [isFree, setIsFree] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t bg-secondary/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          title: String(fd.get("title") ?? ""),
          type,
          provider: uploadedUrl ? (type === "video" ? "html5" : undefined) : type === "video" ? (provider as "youtube") : undefined,
          url: uploadedUrl ?? (String(fd.get("url") ?? "") || undefined),
          body: String(fd.get("body") ?? "") || undefined,
          caption: String(fd.get("caption") ?? "") || undefined,
          durationMinutes: Number(fd.get("durationMinutes") ?? 0) || undefined,
          isFreePreview: isFree,
        });
        e.currentTarget.reset();
        setUploadedUrl(null);
      }}
    >
      <Input name="title" required placeholder="Lesson title" className="min-w-48 flex-1" />
      <Select name="type" value={type} onValueChange={(v) => setType(v as "video")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["video", "audio", "document", "text", "quiz", "image"].map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {type === "video" && (
        <>
          <Select name="provider" value={provider} onValueChange={(v) => setProvider(v ?? "youtube")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["youtube", "vimeo", "html5", "iframe", "external", "s3", "wasabi", "google_drive", "stream"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UploadField
            bucket="lesson_files"
            accept="video/mp4,video/webm,video/quicktime"
            label="Upload video file (MP4/WebM — auto-tracks progress)"
            value={uploadedUrl}
            onChange={(url) => {
              setUploadedUrl(url);
              if (url) setProvider("html5");
            }}
            hint="Up to 512 MB. Or paste a YouTube/Vimeo/iframe URL below."
          />
          <Input name="url" placeholder="…or video URL" className="min-w-48 flex-1" />
          <Input name="caption" placeholder="Caption .vtt URL" className="min-w-40" />
        </>
      )}
      {type === "audio" && <Input name="url" placeholder="Audio URL" className="min-w-48 flex-1" />}
      {type === "document" && (
        <UploadField
          bucket="lesson_files"
          accept="application/pdf,image/*,text/plain"
          label="Upload document"
          value={uploadedUrl}
          onChange={setUploadedUrl}
          hint="PDF, image or text — up to 100 MB."
        />
      )}
      {type === "image" && (
        <UploadField
          bucket="lesson_files"
          accept="image/jpeg,image/png,image/webp,image/gif"
          label="Upload image"
          value={uploadedUrl}
          onChange={setUploadedUrl}
        />
      )}
      {type === "text" && (
        <Textarea name="body" placeholder="Lesson body (HTML)" className="min-w-48 flex-1" rows={2} />
      )}
      {type !== "text" && (
        <Input
          name="durationMinutes"
          type="number"
          min="0"
          placeholder="min"
          aria-label="Duration in minutes"
          className="w-20"
        />
      )}
      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        <Switch checked={isFree} onCheckedChange={setIsFree} />
        Preview
      </label>
      <Button type="submit" size="sm">
        <Plus data-icon="inline-start" />
        Lesson
      </Button>
    </form>
  );
}

function QuizBuilder({
  courseId,
  lesson,
  onAdd,
  onDelete,
}: {
  courseId: string;
  lesson: Lesson;
  onAdd: (q: {
    title: string;
    type: "single_choice" | "multiple_choice" | "fill_in_the_blank";
    options: string[];
    correct: string[];
  }) => void;
  onDelete: (questionId: string) => void;
}) {
  const [type, setType] = useState<"single_choice" | "multiple_choice" | "fill_in_the_blank">(
    "single_choice",
  );
  const [correct, setCorrect] = useState("");

  return (
    <div className={cn("flex flex-col gap-4 bg-accent/40 p-4 text-sm")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="kicker">Quiz builder · {lesson.questions.length} questions</p>
        <QuizTimeLimitInput lessonId={lesson.id} initialMinutes={lesson.timeLimitMinutes ?? null} />
      </div>
      <ul className="flex flex-col gap-2">
        {lesson.questions.map((question, i) => (
          <li key={question.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <span className="kicker mt-0.5">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{question.title}</p>
              <p className="text-muted-foreground text-xs">
                {question.type} · options: {question.options.join(", ") || "—"} · correct:{" "}
                {question.correctAnswers.join(", ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive"
              aria-label="Delete question"
              onClick={() => onDelete(question.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const options =
            type === "fill_in_the_blank"
              ? []
              : String(fd.get("options") ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
          const correctList =
            type === "fill_in_the_blank"
              ? [String(fd.get("correct") ?? "").trim()]
              : String(correct ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
          onAdd({
            title: String(fd.get("title") ?? ""),
            type,
            options,
            correct: correctList,
          });
          form.reset();
          setCorrect("");
        }}
      >
        <Field>
          <FieldLabel htmlFor={`q-title-${lesson.id}`}>Question</FieldLabel>
          <Input id={`q-title-${lesson.id}`} name="title" required placeholder="What is…?" />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Select name="type" value={type} onValueChange={(v) => setType(v as "single_choice")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single_choice">single choice / true-false</SelectItem>
              <SelectItem value="multiple_choice">multiple choice</SelectItem>
              <SelectItem value="fill_in_the_blank">fill in the blank</SelectItem>
            </SelectContent>
          </Select>
          {type !== "fill_in_the_blank" && (
            <>
              <Textarea
                name="options"
                rows={2}
                required
                placeholder="Options — one per line"
                className="min-w-48 flex-1"
              />
              <Input
                value={correct}
                onChange={(e) => setCorrect(e.target.value)}
                placeholder="Correct option(s), comma-separated"
                className="min-w-48 flex-1"
                required
              />
            </>
          )}
          {type === "fill_in_the_blank" && (
            <Input
              name="correct"
              placeholder="Accepted answer"
              className="min-w-48 flex-1"
              required
            />
          )}
          <Button type="submit" size="sm">
            <Plus data-icon="inline-start" />
            Question
          </Button>
        </div>
      </form>
    </div>
  );
}
