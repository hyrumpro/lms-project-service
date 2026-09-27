"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { markLessonComplete, saveProgressSeconds } from "@/server/actions/learning";

function youtubeId(url: string): string | null {
  const patterns = [/[?&]v=([\w-]{6,})/, /youtu\.be\/([\w-]{6,})/, /embed\/([\w-]{6,})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const HEARTBEAT_MS = 5000;

/**
 * Video lesson pane. Native <video> for direct files (resume + heartbeat +
 * auto-complete at 90%), iframe embeds for youtube/vimeo/iframe with manual
 * completion (spec §7.6).
 */
export function VideoLesson({
  courseId,
  lessonId,
  provider,
  videoUrl,
  resumeSeconds,
  isCompleted,
  previewMode = false,
  captionUrl,
  nextHref,
  watermark,
}: {
  courseId: string;
  lessonId: string;
  provider: string;
  videoUrl: string;
  resumeSeconds: number;
  isCompleted: boolean;
  previewMode?: boolean;
  captionUrl?: string | null;
  nextHref?: string | null;
  watermark?: string | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);

  const isNative = ["html5", "s3", "wasabi", "external", "stream"].includes(provider);
  const yt = provider === "youtube" ? youtubeId(videoUrl) : null;
  const isEmbed = !isNative;

  // heartbeat: persist resume position every 5s while playing
  useEffect(() => {
    if (!isNative || previewMode) return;
    const video = videoRef.current;
    if (!video) return;

    let lastSent = 0;
    const interval = setInterval(() => {
      if (video.paused || video.currentTime === 0) return;
      if (Date.now() - lastSent < HEARTBEAT_MS) return;
      lastSent = Date.now();
      void saveProgressSeconds(courseId, lessonId, video.currentTime, video.duration || 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [courseId, lessonId, isNative]);

  async function onTimeUpdate() {
    if (previewMode) return;
    const video = videoRef.current;
    if (!video || !video.duration) return;
    if (video.currentTime / video.duration >= 0.9 && !completed) {
      setCompleted(true);
      await saveProgressSeconds(courseId, lessonId, video.currentTime, video.duration);
      if (nextHref) router.push(nextHref);
      else router.refresh();
    }
  }

  async function complete() {
    setSaving(true);
    const result = await markLessonComplete(courseId, lessonId);
    setSaving(false);
    if (result.ok) {
      setCompleted(true);
      toast.success("Lesson complete");
      if (nextHref) router.push(nextHref);
      else router.refresh();
    } else {
      toast.error("Could not save progress.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
        {provider === "stream" && watermark ? (
          <span className="pointer-events-none absolute right-3 bottom-3 z-10 text-xs text-white/80">{watermark}</span>
        ) : null}
        {isNative ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            className="size-full"
            onLoadedMetadata={(event) => {
              if (resumeSeconds > 5 && resumeSeconds < event.currentTarget.duration - 10) {
                event.currentTarget.currentTime = resumeSeconds;
              }
            }}
            onTimeUpdate={onTimeUpdate}
          >
            <track kind="captions" src={captionUrl ?? undefined} srcLang="en" label="English" default={Boolean(captionUrl)} />
          </video>
        ) : yt ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}?modestbranding=1&rel=0`}
            title="Lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        ) : provider === "vimeo" ? (
          <iframe
            src={`https://player.vimeo.com/video/${videoUrl.replace(/\D/g, "")}`}
            title="Lesson video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        ) : (
          <iframe src={videoUrl} title="Lesson video" allowFullScreen className="size-full" />
        )}
      </div>

      {previewMode ? (
        <p className="text-muted-foreground text-xs">Course preview — enroll for the full lesson.</p>
      ) : (
        <div className="flex items-center gap-3">
          {completed ? (
            <span className="text-sm font-medium text-teal-700 dark:text-teal-400">
              <CheckCircle2 className="mr-1 inline size-4" />
              Completed
            </span>
          ) : (
            <Button onClick={complete} disabled={saving}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {isEmbed ? "Mark as complete" : "Mark as watched"}
            </Button>
          )}
          {!isNative && (
            <p className="text-muted-foreground text-xs">
              Watch the video, then mark it complete. Auto-tracking applies to uploaded files.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
