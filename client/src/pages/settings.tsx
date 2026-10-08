import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { errorMessage, useAuth, type AuthUser } from "@/hooks/use-auth";

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      setCurrent("");
      setNew("");
      toast({ title: "Password updated" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input id="new" type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(e) => setNew(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoStepCard() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await apiRequest("POST", "/api/auth/otp/enable/request");
      setCodeSent(true);
    });

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await apiRequest("POST", "/api/auth/otp/enable/confirm", { code });
      setUser((await res.json()).user);
      setCodeSent(false);
      setCode("");
      toast({ title: "Two-step verification enabled" });
    });
  };

  const disable = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await apiRequest("POST", "/api/auth/otp/disable", { password });
      setUser((await res.json()).user);
      setDisabling(false);
      setPassword("");
      toast({ title: "Two-step verification disabled" });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-step verification</CardTitle>
        <CardDescription>
          When enabled, a one-time code is emailed to {user?.email} each time you sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-sm">
        <p className="text-sm">
          Status:{" "}
          <span className={user?.otpEnabled ? "font-semibold text-green-700" : "font-semibold text-neutral-600"}>
            {user?.otpEnabled ? "Enabled" : "Disabled"}
          </span>
        </p>

        {!user?.otpEnabled && !codeSent && <Button onClick={sendCode} disabled={busy}>Enable</Button>}

        {!user?.otpEnabled && codeSent && (
          <form onSubmit={confirm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter the 6-digit code we emailed you</Label>
              <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.length !== 6}>Confirm</Button>
              <Button type="button" variant="outline" onClick={sendCode} disabled={busy}>Resend</Button>
            </div>
          </form>
        )}

        {user?.otpEnabled && !disabling && (
          <Button variant="outline" onClick={() => setDisabling(true)}>Disable</Button>
        )}

        {user?.otpEnabled && disabling && (
          <form onSubmit={disable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp-password">Confirm your password</Label>
              <Input id="otp-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={busy}>Disable</Button>
              <Button type="button" variant="outline" onClick={() => setDisabling(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function UsersCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery<AuthUser[]>({ queryKey: ["/api/auth/users"] });
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/users/invite", { email });
      toast({ title: "Invitation sent", description: email });
      setEmail("");
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: AuthUser) => {
    if (!window.confirm(`Remove ${u.email}?`)) return;
    try {
      await apiRequest("DELETE", `/api/auth/users/${u.id}`);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Invite people by email. They set their own password from the link we send.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {u.email} {u.isOwner && <span className="text-xs text-neutral-500">(owner)</span>}
              </span>
              {u.id !== user?.id && (
                <Button variant="outline" size="sm" onClick={() => remove(u)}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={invite} className="flex gap-2">
          <Input type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" disabled={busy}>Invite</Button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h2 className="font-poppins font-semibold text-2xl text-neutral-900">Settings</h2>
      <ChangePasswordCard />
      <TwoStepCard />
      {user?.isOwner && <UsersCard />}
    </div>
  );
}
