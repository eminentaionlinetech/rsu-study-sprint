import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Plus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { COURSES } from "@/lib/courses";
import { formatPin } from "@/lib/exam";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard · EHRM CBT Portal" },
      { name: "description", content: "Generate exam PINs, share course links and review scores." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin dashboard · EHRM CBT Portal" },
      {
        property: "og:description",
        content: "Generate exam PINs, share course links and review scores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const dateFmt = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const fmt = (d: string | null) => (d ? dateFmt.format(new Date(d)) : "—");

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-ink text-ink-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-semibold">Admin dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-foreground/70 sm:inline">{user.email}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {role.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : !role.data ? (
          <div className="rounded-lg border border-border bg-card p-8 shadow-card">
            <h1 className="font-display text-2xl font-semibold">Not authorised</h1>
            <p className="mt-2 text-muted-foreground">
              This account doesn't have admin access to the portal.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="pins">
            <TabsList className="h-11">
              <TabsTrigger value="pins" className="gap-2 px-4">
                <KeyRound className="h-4 w-4" /> PINs
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-2 px-4">
                <Link2 className="h-4 w-4" /> Course links
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-2 px-4">
                <Users className="h-4 w-4" /> Students &amp; scores
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pins" className="mt-6">
              <PinsPanel />
            </TabsContent>
            <TabsContent value="links" className="mt-6">
              <LinksPanel />
            </TabsContent>
            <TabsContent value="students" className="mt-6">
              <StudentsPanel />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`${label} ${value}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "muted" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-3xl font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PinsPanel() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState("1");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [fresh, setFresh] = useState<string[]>([]);

  const pins = useQuery({
    queryKey: ["admin", "pins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("id, code, status, created_at, used_at, students(full_name, matric_number), courses(code)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: async (n: number) => {
      const { data, error } = await supabase.rpc("generate_pins", { _count: n });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setFresh(data.map((p) => p.code));
      toast.success(data.length === 1 ? "New PIN generated" : `${data.length} new PINs generated`);
      queryClient.invalidateQueries({ queryKey: ["admin", "pins"] });
    },
    onError: (e) => toast.error("Couldn't generate PINs", { description: e.message }),
  });

  const rows = pins.data ?? [];
  const active = rows.filter((p) => p.status === "active").length;
  const shown = filter === "all" ? rows : rows.filter((p) => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total PINs" value={rows.length} />
        <Stat label="Active" value={active} tone="success" />
        <Stat label="Expired" value={rows.length - active} tone="muted" />
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Generate PINs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each PIN is a unique random 11-digit number that works for one exam attempt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="w-28" aria-label="How many PINs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "5", "10", "25", "50"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n} {n === "1" ? "PIN" : "PINs"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="lg" onClick={() => generate.mutate(Number(count))} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate PIN
            </Button>
          </div>
        </div>

        {fresh.length > 0 && (
          <div className="mt-5 rounded-md border border-accent/60 bg-accent/15 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Just generated</p>
              <CopyButton value={fresh.join("\n")} label="Copy all" />
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {fresh.map((code) => (
                <li
                  key={code}
                  className="flex items-center gap-1 rounded-md border border-border bg-card pl-3 font-mono text-lg tracking-wider"
                >
                  {formatPin(code)}
                  <CopyButton value={code} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">All PINs</h2>
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(["all", "active", "expired"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded px-3 py-1 text-sm capitalize transition-colors",
                  filter === f ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {pins.isPending ? (
          <Loader2 className="m-6 h-5 w-5 animate-spin text-primary" />
        ) : shown.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No PINs here yet. Generate one above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Used at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap font-mono">
                    {formatPin(p.code)}
                    {p.status === "active" && <CopyButton value={p.code} />}
                  </TableCell>
                  <TableCell>
                    {p.status === "active" ? (
                      <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Expired</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(p.created_at)}</TableCell>
                  <TableCell>{p.students?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.courses?.code ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(p.used_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function LinksPanel() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold">Course links</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a direct link so students land on the right course. They'll still need a PIN.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {COURSES.map((c) => {
          const url = `${origin}/course/${c.slug}`;
          return (
            <li key={c.slug} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-primary">{c.code}</p>
                <p className="font-medium">{c.title}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
              </div>
              <CopyButton value={url} label="Copy link" />
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StudentsPanel() {
  const [course, setCourse] = useState("all");
  const scores = useQuery({
    queryKey: ["admin", "scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scores")
        .select(
          "id, student_id, score, correct_count, total_questions, auto_submitted, submitted_at, students(full_name, matric_number), courses(code, title)",
        )
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const students = useQuery({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, matric_number, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const allScores = scores.data ?? [];
  const shownScores = course === "all" ? allScores : allScores.filter((s) => s.courses?.code === course);
  const perStudent = useMemo(() => {
    const map = new Map<string, { attempts: number; best: number }>();
    for (const s of allScores) {
      const cur = map.get(s.student_id) ?? { attempts: 0, best: 0 };
      map.set(s.student_id, { attempts: cur.attempts + 1, best: Math.max(cur.best, s.score) });
    }
    return map;
  }, [allScores]);
  const avg = shownScores.length
    ? Math.round(shownScores.reduce((a, s) => a + s.score, 0) / shownScores.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Students" value={students.data?.length ?? 0} />
        <Stat label="Attempts" value={shownScores.length} />
        <Stat label="Average score /60" value={avg} />
      </div>

      <section className="rounded-lg border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Quiz scores</h2>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="w-56" aria-label="Filter by course">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {COURSES.map((c) => (
                <SelectItem key={c.slug} value={c.code}>
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {scores.isPending ? (
          <Loader2 className="m-6 h-5 w-5 animate-spin text-primary" />
        ) : shownScores.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No scores recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Matric no.</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Correct</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownScores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.students?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.students?.matric_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.courses?.code}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {s.score}/{s.total_questions * 2}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.correct_count}/{s.total_questions}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fmt(s.submitted_at)}
                    {s.auto_submitted && (
                      <Badge variant="outline" className="ml-2">
                        Time up
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-card">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Student accounts</h2>
        </div>
        {students.isPending ? (
          <Loader2 className="m-6 h-5 w-5 animate-spin text-primary" />
        ) : (students.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No students have signed up yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Matric no.</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Best score</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students.data ?? []).map((st) => {
                const stats = perStudent.get(st.id);
                return (
                  <TableRow key={st.id}>
                    <TableCell className="font-medium">{st.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">{st.matric_number ?? "—"}</TableCell>
                    <TableCell>{stats?.attempts ?? 0}</TableCell>
                    <TableCell className="font-mono">{stats ? `${stats.best}/60` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(st.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
