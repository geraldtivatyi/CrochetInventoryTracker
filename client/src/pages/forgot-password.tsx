import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthCard from "@/components/auth-card";
import { apiRequest } from "@/lib/queryClient";
import { errorMessage } from "@/hooks/use-auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      setMessage((await res.json()).message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Forgot password" description="Enter your email and we'll send you a reset link.">
      {message ? (
        <p className="text-sm text-green-700">{message}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            Send reset link
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
