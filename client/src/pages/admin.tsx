import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { errorMessage, type AuthUser } from "@/hooks/use-auth";

interface IntegrationSettings {
  whatsappPhoneNumberId: string;
  whatsappConfigured: boolean;
  whatsappOrderRequestTemplate: string;
  whatsappOrderPaidTemplate: string;
  whatsappOrderReceiptTemplate: string;
  whatsappTrackingTemplate: string;
  whatsappPickupTemplate: string;
  whatsappTemplateLanguage: string;
  courierConfigured: boolean;
  webhookUrl: string;
}

interface PlatformUser extends AuthUser {}

const emptyIntegrations: IntegrationSettings = {
  whatsappPhoneNumberId: "",
  whatsappConfigured: false,
  whatsappOrderRequestTemplate: "",
  whatsappOrderPaidTemplate: "",
  whatsappOrderReceiptTemplate: "",
  whatsappTrackingTemplate: "",
  whatsappPickupTemplate: "",
  whatsappTemplateLanguage: "en_ZA",
  courierConfigured: false,
  webhookUrl: "",
};

export default function Admin() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<IntegrationSettings>({
    queryKey: ["/api/admin/integrations"],
  });
  const { data: users = [], isLoading: usersLoading } = useQuery<PlatformUser[]>({
    queryKey: ["/api/auth/users"],
  });
  const [form, setForm] = useState(emptyIntegrations);
  const [whatsappAccessToken, setWhatsAppAccessToken] = useState("");
  const [whatsappAppSecret, setWhatsAppAppSecret] = useState("");
  const [whatsappVerifyToken, setWhatsAppVerifyToken] = useState("");
  const [courierAccessKey, setCourierAccessKey] = useState("");
  const [courierSecret, setCourierSecret] = useState("");
  const [clearWhatsAppCredentials, setClearWhatsAppCredentials] = useState(false);
  const [clearCourierCredentials, setClearCourierCredentials] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    setPhoneNumbers(Object.fromEntries(users.map((user) => [user.id, user.whatsappPhone ?? ""])));
  }, [users]);

  const update = (key: keyof IntegrationSettings, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const saveIntegrations = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved("");
    setBusy(true);
    try {
      const response = await apiRequest("PUT", "/api/admin/integrations", {
        ...form,
        whatsappAccessToken: whatsappAccessToken || undefined,
        whatsappAppSecret: whatsappAppSecret || undefined,
        whatsappVerifyToken: whatsappVerifyToken || undefined,
        courierAccessKey: courierAccessKey || undefined,
        courierSecret: courierSecret || undefined,
        clearWhatsAppCredentials,
        clearCourierCredentials,
      });
      const nextSettings = await response.json() as IntegrationSettings;
      setForm(nextSettings);
      setWhatsAppAccessToken("");
      setWhatsAppAppSecret("");
      setWhatsAppVerifyToken("");
      setCourierAccessKey("");
      setCourierSecret("");
      setClearWhatsAppCredentials(false);
      setClearCourierCredentials(false);
      queryClient.setQueryData(["/api/admin/integrations"], nextSettings);
      setSaved("Shared integration settings saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveOwnerPhone = async (user: PlatformUser) => {
    setError("");
    setSaved("");
    setSavingUserId(user.id);
    try {
      await apiRequest("PATCH", `/api/admin/users/${user.id}/whatsapp-phone`, {
        whatsappPhone: phoneNumbers[user.id] ?? "",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setSaved(`WhatsApp number saved for ${user.email}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-semibold text-neutral-900">Platform admin</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Manage the shared WhatsApp Cloud API number, platform Courier Guy credentials, and owner WhatsApp identities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared integrations</CardTitle>
          <CardDescription>
            Credentials are encrypted before they are stored and are never returned to this page. A blank secret field keeps the saved value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-neutral-500">Loading integration settings…</p> : (
            <form onSubmit={saveIntegrations} className="space-y-7">
              <section className="space-y-4">
                <div>
                  <h3 className="font-medium">WhatsApp Cloud API</h3>
                  <p className="text-sm text-neutral-600">
                    One platform number serves shop owners and customers. Incoming messages use separate owner and customer menus.
                  </p>
                  <p className={`mt-1 text-sm ${form.whatsappConfigured ? "text-green-700" : "text-amber-700"}`}>
                    {form.whatsappConfigured ? "WhatsApp credentials configured" : "WhatsApp not configured"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wa-phone-id">Meta phone number ID</Label>
                    <Input id="wa-phone-id" autoComplete="off" value={form.whatsappPhoneNumberId} onChange={(event) => update("whatsappPhoneNumberId", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-access-token">Permanent/system-user access token</Label>
                    <Input id="wa-access-token" type="password" autoComplete="new-password" value={whatsappAccessToken} onChange={(event) => setWhatsAppAccessToken(event.target.value)} placeholder={form.whatsappConfigured ? "Saved; leave blank to keep" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-app-secret">Meta app secret</Label>
                    <Input id="wa-app-secret" type="password" autoComplete="new-password" value={whatsappAppSecret} onChange={(event) => setWhatsAppAppSecret(event.target.value)} placeholder={form.whatsappConfigured ? "Saved; leave blank to keep" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-verify-token">Webhook verify token</Label>
                    <Input id="wa-verify-token" type="password" autoComplete="new-password" value={whatsappVerifyToken} onChange={(event) => setWhatsAppVerifyToken(event.target.value)} placeholder={form.whatsappConfigured ? "Saved; leave blank to keep" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-language">Approved template language</Label>
                    <Input id="wa-language" value={form.whatsappTemplateLanguage} onChange={(event) => update("whatsappTemplateLanguage", event.target.value)} placeholder="en_ZA" />
                  </div>
                </div>
                <div className="rounded-md bg-neutral-50 p-3 text-sm">
                  <p className="font-medium">Configure this callback in Meta</p>
                  <p>Callback URL: <code className="break-all">{form.webhookUrl || "Save settings to view the URL"}</code></p>
                  <p>Subscribe to the <code>messages</code> webhook field and use the verify token entered above.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ["whatsappOrderRequestTemplate", "Manual order request"],
                    ["whatsappOrderPaidTemplate", "Order status update"],
                    ["whatsappOrderReceiptTemplate", "Paystack test receipt"],
                    ["whatsappTrackingTemplate", "Courier tracking update"],
                    ["whatsappPickupTemplate", "Courier pickup reminder"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{label} template name</Label>
                      <Input id={key} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder="approved_template_name" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  Templates must be approved by Meta in this WhatsApp Business Account and language. Manual requests use placeholders: shop, reference, items, product subtotal, fulfilment. Status updates use shop, reference, status. Receipts use shop, reference, items, total, delivery. Tracking and pickup use the existing provider-specific formats.
                </p>
                {form.whatsappConfigured && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={clearWhatsAppCredentials} onChange={(event) => setClearWhatsAppCredentials(event.target.checked)} />
                    Remove shared WhatsApp credentials
                  </label>
                )}
              </section>

              <section className="space-y-4 border-t pt-6">
                <div>
                  <h3 className="font-medium">Courier Guy account</h3>
                  <p className="text-sm text-neutral-600">These shared credentials are used for Courier Guy API requests across the platform.</p>
                  <p className={`mt-1 text-sm ${form.courierConfigured ? "text-green-700" : "text-amber-700"}`}>
                    {form.courierConfigured ? "Courier Guy credentials configured" : "Courier Guy not configured"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="courier-access-key">API access key</Label>
                    <Input id="courier-access-key" autoComplete="off" value={courierAccessKey} onChange={(event) => setCourierAccessKey(event.target.value)} placeholder={form.courierConfigured ? "Saved; leave blank to keep" : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="courier-secret">API secret</Label>
                    <Input id="courier-secret" type="password" autoComplete="new-password" value={courierSecret} onChange={(event) => setCourierSecret(event.target.value)} placeholder={form.courierConfigured ? "Saved; leave blank to keep" : ""} />
                  </div>
                </div>
                {form.courierConfigured && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={clearCourierCredentials} onChange={(event) => setClearCourierCredentials(event.target.checked)} />
                    Remove Courier Guy credentials
                  </label>
                )}
              </section>

              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save integrations"}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner WhatsApp numbers</CardTitle>
          <CardDescription>
            Assign each shop account a unique WhatsApp number in international format. Only assigned numbers receive the owner menu; other numbers receive the customer menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersLoading ? <p className="text-sm text-neutral-500">Loading accounts…</p> : users.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor={`owner-phone-${user.id}`}>{user.email}{user.isOwner ? " · platform admin" : ""}</Label>
                <Input
                  id={`owner-phone-${user.id}`}
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +27821234567"
                  value={phoneNumbers[user.id] ?? ""}
                  onChange={(event) => setPhoneNumbers((current) => ({ ...current, [user.id]: event.target.value }))}
                />
              </div>
              <Button type="button" variant="outline" disabled={savingUserId !== null} onClick={() => void saveOwnerPhone(user)}>
                {savingUserId === user.id ? "Saving…" : "Save number"}
              </Button>
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
