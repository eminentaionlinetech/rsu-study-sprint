import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
  Loader2,
  PenLine,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  clearExamSession,
  EXAM_MINUTES,
  formatClock,
  readExamSession,
  remainingSeconds,
  type ExamOption,
} from "@/lib/exam";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workspace")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exam workspace · EHRM CBT Portal" },
      { name: "description", content: "Your timed practice exam and reading plan." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Exam workspace · EHRM CBT Portal" },
      { property: "og:description", content: "Your timed practice exam and reading plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

type ExamQuestion = { id: string; position: number; question: string; a: string; b: string; c: string };
type ReadingPlan = {
  overview?: string;
  modules?: { title: string; topics: string[]; tasks: string[] }[];
  key_terms?: { term: string; definition: string }[];
  exam_tips?: string[];
};
type ExamResult = {
  score: number;
  correct_count: number;
  total_questions: number;
  max_score: number;
  auto_submitted: boolean;
};
type ActivePayload = {
  status: "in_progress";
  server_now: string;
  started_at: string;
  expires_at: string;
  answers: Record<string, ExamOption>;
  student: { full_name: string; matric_number: string | null };
  course: { code: string; slug: string; title: string; description: string; reading_plan: ReadingPlan };
  questions: ExamQuestion[];
};
type EndedPayload = { status: "submitted" | "timed_out" | "not_found"; result?: ExamResult };
type ExamPayload = ActivePayload | EndedPayload;

function Workspace() {
  const navigate = useNavigate();
  const [session] = useState(() => readExamSession());

  useEffect(() => {
    if (!session) navigate({ to: "/", replace: true });
  }, [session, navigate]);

  if (!session) return <FullScreenMessage label="Returning to the home page…" />;
  return <ExamLoader token={session.token} />;
}

function ExamLoader({ token }: { token: string }) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["exam", token],
    queryFn: async () => {
      const sentAt = Date.now();
      const { data, error } = await supabase.rpc("get_exam", { _token: token });
      if (error) throw error;
      return { payload: data as unknown as ExamPayload, receivedAt: (sentAt + Date.now()) / 2 };
    },
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const payload = query.data?.payload;
  useEffect(() => {
    if (!payload || payload.status === "in_progress") return;
    clearExamSession();
    if (payload.status === "timed_out" && payload.result) {
      toast.warning("Your time ran out", {
        description: `Score saved: ${payload.result.score}/${payload.result.max_score}. Get a new PIN to try again.`,
      });
    } else {
      toast.info("This exam session has ended", {
        description: "Get a new PIN from the admin to start another attempt.",
      });
    }
    navigate({ to: "/", replace: true });
  }, [payload, navigate]);

  if (query.isPending) return <FullScreenMessage label="Opening your workspace…" spinner />;
  if (query.isError)
    return (
      <FullScreenMessage label="We couldn't load your exam. Check your connection and try again.">
        <Button className="mt-4" onClick={() => query.refetch()}>
          Try again
        </Button>
      </FullScreenMessage>
    );
  if (!payload || payload.status !== "in_progress")
    return <FullScreenMessage label="Closing session…" spinner />;

  return (
    <ActiveExam
      token={token}
      exam={payload}
      clockOffset={Date.parse(payload.server_now) - query.data.receivedAt}
    />
  );
}

function ActiveExam({
  token,
  exam,
  clockOffset,
}: {
  token: string;
  exam: ActivePayload;
  clockOffset: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, ExamOption>>(exam.answers ?? {});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const expiresAt = useMemo(() => Date.parse(exam.expires_at), [exam.expires_at]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const remaining = remainingSeconds(expiresAt, now, clockOffset);

  const [tab, setTab] = useState("exam");
  const [current, setCurrent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const finishing = useRef(false);

  const finish = useCallback(
    async (auto: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      setSubmitting(true);
      setConfirmOpen(false);
      let res: ExamResult | null = null;
      try {
        const { data, error } = await supabase.rpc("submit_exam", {
          _token: token,
          _answers: answersRef.current,
          _auto: auto,
        });
        if (error) throw error;
        res = data as unknown as ExamResult;
      } catch (e) {
        if (!auto) {
          finishing.current = false;
          setSubmitting(false);
          toast.error("Couldn't submit your exam", {
            description: e instanceof Error ? e.message : "Please try again.",
          });
          return;
        }
      }
      clearExamSession();
      if (auto) {
        queryClient.removeQueries({ queryKey: ["exam"] });
        toast.warning("Time's up — your exam was submitted", {
          description: res
            ? `Score saved: ${res.score}/${res.max_score}. You've been logged out. Get a new PIN to try again.`
            : "You've been logged out. Get a new PIN to try again.",
          duration: 12000,
        });
        navigate({ to: "/", replace: true });
      } else {
        setResult(res);
        setSubmitting(false);
      }
    },
    [token, navigate, queryClient],
  );

  useEffect(() => {
    if (remaining <= 0) void finish(true);
  }, [remaining, finish]);

  const questions = exam.questions;
  const q = questions[current];
  const answeredCount = questions.filter((x) => answers[x.id]).length;

  const choose = useCallback(
    (questionId: string, option: ExamOption) => {
      if (finishing.current) return;
      setAnswers((prev) => ({ ...prev, [questionId]: option }));
      void supabase
        .rpc("save_answer", { _token: token, _question_id: questionId, _option: option })
        .then(({ error }) => {
          if (error && !finishing.current)
            toast.error("Answer not saved yet", { description: "It will be sent when you submit." });
        });
    },
    [token],
  );

  useEffect(() => {
    if (tab !== "exam" || result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (q && (key === "A" || key === "B" || key === "C")) choose(q.id, key);
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(questions.length - 1, c + 1));
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, result, q, choose, questions.length]);

  if (result) {
    return (
      <ResultScreen
        result={result}
        name={exam.student.full_name}
        courseCode={exam.course.code}
        onDone={() => {
          queryClient.removeQueries({ queryKey: ["exam"] });
          navigate({ to: "/", replace: true });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-semibold tracking-wide text-primary">
              {exam.course.code}
            </p>
            <p className="truncate font-display text-lg font-semibold leading-tight">
              {exam.course.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {exam.student.full_name}
              {exam.student.matric_number ? ` · ${exam.student.matric_number}` : ""}
            </p>
          </div>
          <Timer remaining={remaining} />
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit exam
          </Button>
        </div>
        <TimeBar remaining={remaining} />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-11">
            <TabsTrigger value="reading" className="gap-2 px-4">
              <BookOpen className="h-4 w-4" /> Reading plan
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-2 px-4">
              <PenLine className="h-4 w-4" /> Practice exam
              <span className="font-mono text-xs text-muted-foreground">
                {answeredCount}/{questions.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reading" className="mt-6">
            <ReadingPlanView plan={exam.course.reading_plan} description={exam.course.description} />
          </TabsContent>

          <TabsContent value="exam" className="mt-6">
            {q ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <section className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Question {current + 1} of {questions.length}
                  </p>
                  <h2 className="mt-3 font-display text-xl font-medium leading-snug sm:text-2xl">
                    {q.question}
                  </h2>
                  <div className="mt-6 space-y-3" role="radiogroup" aria-label="Answer options">
                    {(["A", "B", "C"] as const).map((opt) => {
                      const text = q[opt.toLowerCase() as "a" | "b" | "c"];
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => choose(q.id, opt)}
                          disabled={submitting}
                          className={cn(
                            "flex w-full items-start gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50 hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-md border font-mono text-sm font-semibold",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground",
                            )}
                          >
                            {opt}
                          </span>
                          <span className="pt-1">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                      disabled={current === 0}
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      Keys: A / B / C to answer · ← → to move
                    </span>
                    {current < questions.length - 1 ? (
                      <Button onClick={() => setCurrent((c) => c + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                        Finish <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </section>

                <aside className="h-fit rounded-lg border border-border bg-card p-5 shadow-card lg:sticky lg:top-32">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Questions
                    </h3>
                    <span className="font-mono text-xs">
                      {answeredCount}/{questions.length} answered
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-2">
                    {questions.map((item, i) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrent(i)}
                        aria-label={`Question ${i + 1}${answers[item.id] ? ", answered" : ""}`}
                        className={cn(
                          "aspect-square rounded-md border font-mono text-xs font-medium transition-colors",
                          i === current && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                          answers[item.id]
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-primary" /> Answered
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm border border-border bg-background" />{" "}
                      Not yet
                    </span>
                  </div>
                </aside>
              </div>
            ) : (
              <p className="text-muted-foreground">No questions have been added for this course yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam now?</AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {answeredCount} of {questions.length} questions
              {answeredCount < questions.length
                ? ` — ${questions.length - answeredCount} unanswered will score zero`
                : ""}
              . This uses up your PIN; you'll need a new one to try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finish(false)}>Submit exam</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Timer({ remaining }: { remaining: number }) {
  const danger = remaining <= 60;
  const warn = remaining <= 300;
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Time remaining ${formatClock(remaining)}`}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5",
        danger
          ? "animate-pulse border-destructive bg-destructive text-destructive-foreground"
          : warn
            ? "border-warning bg-warning text-warning-foreground"
            : "border-border bg-ink text-ink-foreground",
      )}
    >
      <Clock className="h-4 w-4" />
      <span className="font-mono text-2xl font-semibold tabular-nums">{formatClock(remaining)}</span>
    </div>
  );
}

function TimeBar({ remaining }: { remaining: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / (EXAM_MINUTES * 60)) * 100));
  return (
    <div className="h-1 w-full bg-muted">
      <div
        className={cn(
          "h-full transition-[width] duration-300",
          remaining <= 60 ? "bg-destructive" : remaining <= 300 ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ReadingPlanView({ plan, description }: { plan: ReadingPlan; description: string }) {
  const modules = plan.modules ?? [];
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-ink bg-ruled p-6 text-ink-foreground sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Course overview</p>
        <p className="mt-3 max-w-3xl font-display text-xl leading-relaxed">
          {plan.overview || description || "The reading plan for this course is coming soon."}
        </p>
      </section>

      {modules.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Study schedule</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-2">
            {modules.map((m, i) => (
              <li key={m.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-semibold leading-snug">{m.title}</h3>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {m.topics.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
                {m.tasks.length > 0 && (
                  <div className="mt-4 rounded-md bg-muted p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Do this
                    </p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {m.tasks.map((t) => (
                        <li key={t}>→ {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {plan.key_terms && plan.key_terms.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold">Key terms</h2>
            <dl className="mt-4 divide-y divide-border">
              {plan.key_terms.map((k) => (
                <div key={k.term} className="py-3">
                  <dt className="font-semibold text-primary">{k.term}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{k.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {plan.exam_tips && plan.exam_tips.length > 0 && (
          <section className="h-fit rounded-lg border border-accent/60 bg-accent/15 p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Lightbulb className="h-5 w-5" /> Exam tips
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {plan.exam_tips.map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  name,
  courseCode,
  onDone,
}: {
  result: ExamResult;
  name: string;
  courseCode: string;
  onDone: () => void;
}) {
  const pct = result.max_score ? Math.round((result.score / result.max_score) * 100) : 0;
  return (
    <div className="grid min-h-screen place-items-center bg-ink bg-ruled px-4 text-ink-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center text-card-foreground shadow-lift">
        <Trophy className="mx-auto h-10 w-10 text-accent" />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {courseCode} · Exam submitted
        </p>
        <p className="mt-6 font-display text-7xl font-semibold tabular-nums">
          {result.score}
          <span className="text-3xl text-muted-foreground">/{result.max_score}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.correct_count} of {result.total_questions} correct · {pct}%
        </p>
        <p className="mt-6 text-sm">
          Well done, {name}. Your score has been saved and you have been logged out of this exam.
        </p>
        <Button className="mt-8 w-full" size="lg" onClick={onDone}>
          Back to courses
        </Button>
      </div>
    </div>
  );
}

function FullScreenMessage({
  label,
  spinner,
  children,
}: {
  label: string;
  spinner?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        {spinner && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
        <p className="mt-3 text-sm text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}
