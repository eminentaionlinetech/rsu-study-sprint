import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin sign in · EHRM CBT Portal" },
      { name: "description", content: "Sign in to manage PINs, course links and student scores." },
      { property: "og:title", content: "Admin sign in · EHRM CBT Portal" },
      {
        property: "og:description",
        content: "Sign in to manage PINs, course links and student scores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const adminExists = useQuery({
    queryKey: ["admin-exists"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) throw error;
      return data;
    },
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const setupMode = adminExists.data === false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (setupMode) {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setLoading(false);
      if (err) return setError(err.message);
      if (!data.session) return setCheckEmail(true);
      navigate({ to: "/admin", replace: true });
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (err) return setError(err.message);
      navigate({ to: "/admin", replace: true });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lift">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-ink text-accent">
            <LockKeyhole className="h-5 w-5" />
          </span>
          {checkEmail ? (
            <div className="mt-6">
              <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <MailCheck className="h-6 w-6 text-primary" /> Check your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Open it to activate the
                admin account, then come back here to sign in.
              </p>
            </div>
          ) : adminExists.isPending ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" />
          ) : (
            <form onSubmit={onSubmit} className="mt-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {setupMode ? "Create the admin account" : "Admin sign in"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {setupMode
                  ? "No admin exists yet. The first account created here becomes the portal admin."
                  : "For portal administrators only. Students enter through a course page."}
              </p>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={setupMode ? "new-password" : "current-password"}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {setupMode ? "Create admin account" : "Sign in"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
