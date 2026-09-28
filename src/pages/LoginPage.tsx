import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { DEMO_EMAIL, DEMO_PASSWORD, STAFF_PASSWORD } from "@/data/catalog";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

export function LoginPage() {
  const { session, login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: DEMO_EMAIL, password: "", remember: true },
  });

  if (session) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <Logo className="h-auto w-full max-w-[400px] object-left" />
        <div className="max-w-md">
          <p className="text-3xl leading-tight font-semibold tracking-tight">Perumbavoor clinic and IAA Kochi, on one desk.</p>
          <p className="mt-4 text-sm leading-6 text-slate-400">Dr. K's Aesthetic Clinic, Vengola. Meta leads come in fresh. The admin assigns them. Clinic WhatsApp can run automatically. Institute stays on a direct call.</p>
        </div>
        <p className="text-xs text-slate-500">Demo environment · WhatsApp API not connected</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo mark className="mb-5 h-32 w-32" />
          <p className="text-xs font-semibold tracking-[0.16em] text-muted">BITVION CRM</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Assign clinic and institute leads, then see who spoke to whom and for how long.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              setLoading(true);
              setError("");
              await new Promise((resolve) => window.setTimeout(resolve, 400));
              const message = login(values.email, values.password, values.remember);
              setLoading(false);
              if (message) setError(message);
            })}
          >
            <label className="block text-[13px] font-medium">
              Email
              <Input className="mt-1.5" type="email" autoComplete="username" {...form.register("email")} />
              {form.formState.errors.email ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.email.message}</span> : null}
            </label>
            <label className="block text-[13px] font-medium">
              Password
              <Input className="mt-1.5" type="password" autoComplete="current-password" {...form.register("password")} />
              {form.formState.errors.password ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.password.message}</span> : null}
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-3.5 accent-navy" {...form.register("remember")} />
                Remember me
              </label>
              <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => setForgot(true)}>
                Forgot password
              </button>
            </div>
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</Button>
          </form>
          <div className="mt-6 rounded-lg border border-line bg-white px-3 py-3 text-xs leading-5 text-muted">
            Admin · {DEMO_EMAIL} · {DEMO_PASSWORD}<br />
            Clinic counsellor · anu.thomas@bitvion.demo · {STAFF_PASSWORD}<br />
            Institute · rahul.mathew@bitvion.demo · {STAFF_PASSWORD}
          </div>
        </div>
      </section>
      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot password</DialogTitle>
            <DialogDescription>Demo Mode — password reset emails are not sent. Use {DEMO_EMAIL} and {DEMO_PASSWORD}.</DialogDescription>
          </DialogHeader>
          <Button type="button" onClick={() => setForgot(false)}>Back to sign in</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
