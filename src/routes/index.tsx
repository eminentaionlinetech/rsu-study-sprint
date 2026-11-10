import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, KeyRound, ListChecks } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { COURSES } from "@/lib/courses";
import { EXAM_MINUTES, MAX_SCORE, QUESTIONS_PER_EXAM } from "@/lib/exam";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "100 Level CBT Practice · EHRM, Rivers State University" },
      {
        name: "description",
        content:
          "Pick one of nine 100 Level courses, enter your PIN, and take a timed 30-question practice exam with a reading plan.",
      },
      { property: "og:title", content: "100 Level CBT Practice · EHRM, Rivers State University" },
      {
        property: "og:description",
        content: "Nine courses. 30 questions. 20 minutes. Practise like the real CBT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <section className="bg-ink bg-ruled text-ink-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
            100 Level · Employment Relations &amp; HRM
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Practise every course like it's exam day.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-ink-foreground/75 sm:text-lg">
            Choose a course, enter your 11-digit PIN from the admin, and get a reading plan plus a
            timed practice exam.
          </p>
          <dl className="mt-10 grid max-w-3xl gap-px overflow-hidden rounded-lg border border-ink-foreground/15 bg-ink-foreground/15 sm:grid-cols-3">
            {[
              { icon: ListChecks, label: "Questions", value: `${QUESTIONS_PER_EXAM} · A/B/C` },
              { icon: Clock, label: "Time limit", value: `${EXAM_MINUTES} minutes` },
              { icon: KeyRound, label: "Access", value: "One PIN, one attempt" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-ink px-5 py-4">
                <Icon className="h-5 w-5 shrink-0 text-accent" />
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-foreground/60">
                    {label}
                  </dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Choose your course
          </h2>
          <p className="text-sm text-muted-foreground">
            Scored out of {MAX_SCORE} · 2 points per correct answer
          </p>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES.map((course, i) => (
            <li key={course.slug}>
              <Link
                to="/course/$slug"
                params={{ slug: course.slug }}
                className="group flex h-full min-h-44 flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <div className="mt-6">
                  <p className="font-mono text-sm font-semibold tracking-wide text-primary">
                    {course.code}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold leading-snug tracking-tight">
                    {course.title}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
