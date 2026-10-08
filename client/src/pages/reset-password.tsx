import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthCard from "@/components/auth-card";
import { apiRequest } from "@/lib/queryClient";
import { errorMessage } from "@/hooks/use-auth";

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    setError("");
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { email, token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Set your password" description={email ? `Choose a new password for ${email}.` : undefined}>
      {done ? (
        <p className="text-sm text-green-700">Password updated. You can now sign in.</p>
      ) : !email || !token ? (
        <p className="text-sm text-red-600">This reset link is invalid.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-neutral-500">At least 10 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            Update password
          </Button>
        </form>
      )}
      <div className="text-sm text-center mt-4">
        <Link href="/" className="text-primary-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
