import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { findCourse } from "@/lib/courses";
import {
  EXAM_MINUTES,
  MAX_SCORE,
  PIN_LENGTH,
  POINTS_PER_CORRECT,
  QUESTIONS_PER_EXAM,
  saveExamSession,
} from "@/lib/exam";

export const Route = createFileRoute("/course/$slug")({
  loader: ({ params }) => {
    const course = findCourse(params.slug);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.course.code} · ${loaderData.course.title} · CBT Practice`
      : "Course not found · EHRM CBT Portal";
    const description = loaderData
      ? `Enter your PIN to start a ${EXAM_MINUTES}-minute, ${QUESTIONS_PER_EXAM}-question practice exam for ${loaderData.course.code}.`
      : "This course could not be found.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CourseEntry,
});

function CourseEntry() {
  const { course } = Route.useLoaderData();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("Please enter your full name.");
    if (pin.length !== PIN_LENGTH) return setError(`Your PIN must be exactly ${PIN_LENGTH} digits.`);

    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("redeem_pin", {
      _pin: pin,
      _full_name: fullName.trim(),
      _matric: "",
      _course_slug: course.slug,
    });
    if (rpcError || !data) {
      setLoading(false);
      setError(rpcError?.message ?? "Could not verify your PIN. Please try again.");
      return;
    }
    const { token } = data as { token: string };
    saveExamSession({ token, slug: course.slug });
    navigate({ to: "/workspace", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_440px] lg:py-16">
        <section>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All courses
          </Link>
          <p className="mt-8 font-mono text-sm font-semibold tracking-wide text-primary">
            {course.code}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {course.title}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Sign in with your name and a fresh PIN to open your workspace: a reading plan for this
            course and a timed practice exam.
          </p>

          <div className="mt-8 max-w-xl rounded-lg border border-border bg-card p-6 shadow-card">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Exam rules
            </h2>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                `${QUESTIONS_PER_EXAM} multiple-choice questions, each with options A, B and C.`,
                `${POINTS_PER_CORRECT} points per correct answer — maximum score ${MAX_SCORE}.`,
                `The ${EXAM_MINUTES}-minute timer starts the moment you enter. It cannot be paused.`,
                "At 00:00 your exam is submitted automatically and you are logged out.",
                "Each PIN works once. To try again you need a new PIN from the admin.",
              ].map((rule, i) => (
                <li key={rule} className="flex gap-3">
                  <span className="font-mono text-xs leading-5 text-primary">{i + 1}.</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lg:pt-14">
          <form
            onSubmit={onSubmit}
            className="rounded-lg border border-border bg-card p-6 shadow-lift sm:p-8"
          >
            <h2 className="font-display text-2xl font-semibold tracking-tight">Enter the exam</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your score is saved under your name.</p>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="e.g. Chinedu Okafor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pin">11-digit PIN</Label>
                  <span className="font-mono text-xs text-muted-foreground">
                    {pin.length}/{PIN_LENGTH}
                  </span>
                </div>
                <Input
                  id="pin"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="00000000000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
                  className="h-12 text-center font-mono text-xl tracking-[0.3em]"
                  required
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Verifying PIN…" : "Verify PIN & start"}
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Your PIN expires as soon as it is accepted.
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
