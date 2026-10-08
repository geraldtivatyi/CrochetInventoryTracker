import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthCard from "@/components/auth-card";
import { apiRequest } from "@/lib/queryClient";
import { errorMessage, useAuth } from "@/hooks/use-auth";

export default function Login() {
  const { needsSetup, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCredentials = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await apiRequest("POST", needsSetup ? "/api/auth/setup" : "/api/auth/login", { email, password });
      const data = await res.json();
      if (data.otpRequired) {
        setOtpStep(true);
        setInfo("We emailed you a 6-digit code.");
      } else {
        setUser(data.user);
      }
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await apiRequest("POST", "/api/auth/login/otp", { code });
      setUser((await res.json()).user);
    });
  };

  const resend = () =>
    run(async () => {
      await apiRequest("POST", "/api/auth/login/otp/resend");
      setInfo("A new code has been sent.");
    });

  if (otpStep) {
    return (
      <AuthCard title="Two-step verification" description="Enter the code we sent to your email.">
        <form onSubmit={submitCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </div>
          {info && <p className="text-sm text-green-700">{info}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            Verify
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-primary-600 hover:underline" onClick={resend} disabled={busy}>
              Resend code
            </button>
            <button
              type="button"
              className="text-neutral-600 hover:underline"
              onClick={() => {
                setOtpStep(false);
                setCode("");
                setError("");
                setInfo("");
              }}
            >
              Back
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={needsSetup ? "Create your account" : "Sign in"}
      description={needsSetup ? "First-time setup: create the owner account." : "Welcome back to CrochetNook."}
    >
      <form onSubmit={submitCredentials} className="space-y-4">
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
            autoComplete={needsSetup ? "new-password" : "current-password"}
            minLength={needsSetup ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {needsSetup && <p className="text-xs text-neutral-500">At least 10 characters.</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {needsSetup ? "Create account" : "Sign in"}
        </Button>
        {!needsSetup && (
          <div className="text-sm text-center space-y-2">
            <div>
              <Link href="/forgot-password" className="text-primary-600 hover:underline">
                Forgot your password?
              </Link>
            </div>
            <p className="text-neutral-600">
              Need an account? Ask the owner to invite you; you'll get an email with a link to set your password.
            </p>
          </div>
        )}
      </form>
    </AuthCard>
  );
}
