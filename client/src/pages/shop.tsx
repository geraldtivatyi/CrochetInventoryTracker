import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface ShopSettings {
  slug: string;
  name: string;
  description: string;
  themeColor: string;
  brandingImageUrl: string;
  isLive: boolean;
  customDomain: string | null;
  collectionEnabled: boolean;
  courierEnabled: boolean;
  lockersEnabled: boolean;
  originAddress: {
    type: "business" | "residential";
    company: string;
    street_address: string;
    local_area: string;
    city: string;
    zone: string;
    country: string;
    code: string;
  };
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  courierCredentialsConfigured: boolean;
  whatsappPhoneNumberId: string;
  whatsappConfigured: boolean;
  whatsappOrderTemplate: string;
  whatsappTrackingTemplate: string;
  whatsappReminderTemplate: string;
  whatsappTemplateLanguage: string;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  parcelLengthCm: number | null;
  parcelWidthCm: number | null;
  parcelHeightCm: number | null;
  parcelWeightKg: number | null;
  imageUrl: string;
  imagePreviewUrl: string;
  isPublished: boolean;
}

interface ShopOrder {
  id: number;
  reference: string;
  status: "pending" | "paid" | "failed";
  amountKobo: number;
  customer: { name: string; email: string; phone: string };
  items: Array<{ productId: number; name: string; unitPrice: number; quantity: number }>;
  delivery: {
    method: "collection" | "courier" | "locker";
    feeKobo: number;
    serviceLevelName?: string;
    address?: { street_address: string; local_area: string; city: string; zone: string; code: string };
    pickupPoint?: { id: string | number; name: string; address?: string };
    shipment?: unknown;
    trackingReference?: string;
    pickupSchedule?: { date: string; after: string; before: string; timezone: string };
    tracking?: { status: string; latestEvent: string; estimatedDelivery: string; lastCheckedAt: string };
  };
  createdAt: string;
}

const emptyShop = (email: string): ShopSettings => ({
  slug: "",
  name: "",
  description: "",
  themeColor: "#6b4f3f",
  brandingImageUrl: "",
  isLive: false,
  customDomain: null,
  collectionEnabled: true,
  courierEnabled: false,
  lockersEnabled: false,
  originAddress: {
    type: "business",
    company: "",
    street_address: "",
    local_area: "",
    city: "",
    zone: "",
    country: "ZA",
    code: "",
  },
  senderName: "",
  senderEmail: email,
  senderPhone: "",
  courierCredentialsConfigured: false,
  whatsappPhoneNumberId: "",
  whatsappConfigured: false,
  whatsappOrderTemplate: "",
  whatsappTrackingTemplate: "",
  whatsappReminderTemplate: "",
  whatsappTemplateLanguage: "en_ZA",
});

function ShopSettingsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<ShopSettings | null>({ queryKey: ["/api/shop"] });
  const [form, setForm] = useState<ShopSettings>(() => emptyShop(user?.email ?? ""));
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [clearCredentials, setClearCredentials] = useState(false);
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [clearWhatsAppCredentials, setClearWhatsAppCredentials] = useState(false);
  const [brandingImage, setBrandingImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [removeBrandingImage, setRemoveBrandingImage] = useState(false);
  const [brandingPreview, setBrandingPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (data) setForm(data ?? emptyShop(user?.email ?? ""));
  }, [data, user?.email]);

  useEffect(() => {
    setBrandingPreview(
      brandingImage ? `data:${brandingImage.mimeType};base64,${brandingImage.data}` : "",
    );
  }, [brandingImage]);

  const update = (key: keyof ShopSettings, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateAddress = (key: keyof ShopSettings["originAddress"], value: string) =>
    setForm((current) => ({ ...current, originAddress: { ...current.originAddress, [key]: value } }));

  const selectBrandingImage = async (file?: File) => {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP or GIF branding image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Branding image must be no larger than 5 MB.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the selected branding image."));
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Could not read the selected branding image."));
        reader.readAsDataURL(file);
      });
      setBrandingImage({ data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: file.type });
      setRemoveBrandingImage(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved("");
    setBusy(true);
    try {
      const payload = {
        ...form,
        customDomain: form.customDomain?.trim() || null,
        courierAccessKey: accessKey || undefined,
        courierSecret: secretKey || undefined,
        clearCourierCredentials: clearCredentials,
        whatsappAccessToken: whatsappAccessToken || undefined,
        clearWhatsAppCredentials,
        brandingImage: brandingImage ?? undefined,
        removeBrandingImage: removeBrandingImage || undefined,
      };
      await apiRequest("PUT", "/api/shop", payload);
      setAccessKey("");
      setSecretKey("");
      setClearCredentials(false);
      setWhatsappAccessToken("");
      setClearWhatsAppCredentials(false);
      setBrandingImage(null);
      setRemoveBrandingImage(false);
      setSaved("Shop settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setOption = (key: "isLive" | "collectionEnabled" | "courierEnabled" | "lockersEnabled", checked: boolean) =>
    update(key, checked);
  const shippingEnabled = form.courierEnabled || form.lockersEnabled;

  if (isLoading) return <p className="text-neutral-600">Loading shop settings…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop setup</CardTitle>
        <CardDescription>
          Each account has its own shop and catalogue. A custom domain will work after its DNS is pointed at this app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop name</Label>
              <Input id="shop-name" value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-slug">Store address</Label>
              <div className="flex items-center gap-2">
                <Input id="shop-slug" value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required minLength={3} maxLength={48} />
                <span className="shrink-0 text-sm text-neutral-500">/store/{form.slug || "your-shop"}</span>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shop-description">Description</Label>
              <Textarea id="shop-description" value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={1000} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="custom-domain">Custom domain (optional)</Label>
              <Input
                id="custom-domain"
                placeholder="freda-shop.crochet.co.za"
                value={form.customDomain ?? ""}
                onChange={(e) => update("customDomain", e.target.value.toLowerCase())}
              />
              <p className="text-xs text-neutral-500">Enter a hostname only, without https:// or a path. DNS and TLS must also be configured for this app.</p>
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-neutral-200 p-4">
            <div>
              <h3 className="font-medium text-lg">Shop branding</h3>
              <p className="text-sm text-neutral-500">Add a logo or brand image and choose the color used across your public shop.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop-brand-image">Brand image (optional)</Label>
                <Input
                  id="shop-brand-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => void selectBrandingImage(event.currentTarget.files?.[0])}
                />
                <p className="text-xs text-neutral-500">JPEG, PNG, WebP or GIF; up to 5 MB.</p>
                {(brandingPreview || (!removeBrandingImage && form.brandingImageUrl)) && (
                  <img
                    src={brandingPreview || form.brandingImageUrl}
                    alt="Shop branding preview"
                    className="h-24 max-w-56 rounded-md border object-contain p-2"
                  />
                )}
                {form.brandingImageUrl && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={removeBrandingImage}
                      onChange={(event) => {
                        setRemoveBrandingImage(event.target.checked);
                        if (event.target.checked) setBrandingImage(null);
                      }}
                    />
                    Remove current brand image
                  </label>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop-theme-color">Theme color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="shop-theme-color"
                    type="color"
                    value={form.themeColor}
                    onChange={(event) => update("themeColor", event.target.value)}
                    className="h-12 w-16 cursor-pointer p-1"
                    aria-label="Choose shop theme color"
                  />
                  <span className="font-mono text-sm uppercase">{form.themeColor}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => update("themeColor", "#6b4f3f")}>
                    Reset
                  </Button>
                </div>
                <div className="mt-4 rounded-md p-4 text-sm font-medium" style={{ backgroundColor: form.themeColor, color: "#ffffff" }}>
                  Theme preview · {form.name || "Your shop"}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 rounded-md border border-neutral-200 p-4 sm:grid-cols-2">
            {([
              ["isLive", "Publish shop", "Let visitors see published products."],
              ["collectionEnabled", "Collection", "Allow customers to collect orders from you."],
              ["courierEnabled", "Courier Guy delivery", "Enable address-to-address delivery quotes."],
              ["lockersEnabled", "Courier Guy lockers", "Enable delivery to a Courier Guy locker or pickup point."],
            ] as const).map(([key, title, description]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor={`option-${key}`}>{title}</Label>
                  <p className="text-xs text-neutral-500">{description}</p>
                </div>
                <Switch id={`option-${key}`} checked={form[key]} onCheckedChange={(checked) => setOption(key, checked)} />
              </div>
            ))}
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">Shipping origin and sender</h3>
              <p className="text-sm text-neutral-500">Courier Guy uses these details as the parcel collection address.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ["senderName", "Contact name"],
                ["senderEmail", "Contact email"],
                ["senderPhone", "Contact phone"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input id={key} type={key === "senderEmail" ? "email" : "text"} value={form[key]} onChange={(e) => update(key, e.target.value)} required={shippingEnabled} />
                </div>
              ))}
              {([
                ["company", "Business / company"],
                ["street_address", "Street address"],
                ["local_area", "Suburb / local area"],
                ["city", "City"],
                ["zone", "Province / zone"],
                ["country", "Country code"],
                ["code", "Postal code"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`origin-${key}`}>{label}</Label>
                  <Input id={`origin-${key}`} value={form.originAddress[key]} onChange={(e) => updateAddress(key, e.target.value)} required={shippingEnabled && key !== "company"} maxLength={180} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-neutral-200 p-4">
            <div>
              <h3 className="font-medium">Courier Guy API credentials</h3>
              <p className="text-sm text-neutral-500">
                Use the API access key and secret from your Courier Guy account. Values are encrypted before storage and never shown again.
              </p>
              <p className="mt-1 text-sm">
                Status: <span className={form.courierCredentialsConfigured ? "font-medium text-green-700" : "text-neutral-500"}>
                  {form.courierCredentialsConfigured && !clearCredentials ? "Credentials saved" : "Not configured"}
                </span>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="courier-access">API access key</Label>
                <Input id="courier-access" autoComplete="off" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder={form.courierCredentialsConfigured ? "Saved; leave blank to keep" : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courier-secret">API secret key</Label>
                <Input id="courier-secret" type="password" autoComplete="new-password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder={form.courierCredentialsConfigured ? "Saved; leave blank to keep" : ""} />
              </div>
            </div>
            {form.courierCredentialsConfigured && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={clearCredentials} onChange={(e) => setClearCredentials(e.target.checked)} />
                Remove saved credentials
              </label>
            )}
            <p className="text-xs text-neutral-500">The server must have COURIERGUY_ENCRYPTION_KEY configured to save credentials.</p>
          </section>

          <section className="space-y-4 rounded-md border border-neutral-200 p-4">
            <div>
              <h3 className="font-medium text-lg">WhatsApp order updates</h3>
              <p className="text-sm text-neutral-500">
                Connect this shop's WhatsApp Business Cloud API number. The access token is encrypted at rest.
                Customer updates are sent only when the buyer opts in at checkout; owner pickup reminders go to the sender phone above.
              </p>
              <p className="mt-1 text-sm">
                Status: <span className={form.whatsappConfigured && !clearWhatsAppCredentials ? "font-medium text-green-700" : "text-neutral-500"}>
                  {form.whatsappConfigured && !clearWhatsAppCredentials ? "Connected" : "Not configured"}
                </span>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-phone-number-id">Meta phone number ID</Label>
                <Input
                  id="whatsapp-phone-number-id"
                  value={clearWhatsAppCredentials ? "" : form.whatsappPhoneNumberId}
                  onChange={(event) => update("whatsappPhoneNumberId", event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-access-token">Permanent/system-user access token</Label>
                <Input
                  id="whatsapp-access-token"
                  type="password"
                  autoComplete="new-password"
                  value={whatsappAccessToken}
                  onChange={(event) => setWhatsappAccessToken(event.target.value)}
                  placeholder={form.whatsappConfigured ? "Saved; leave blank to keep" : ""}
                />
              </div>
              {([
                ["whatsappOrderTemplate", "Order confirmation template"],
                ["whatsappTrackingTemplate", "Tracking update template"],
                ["whatsappReminderTemplate", "Pickup reminder template"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label} name</Label>
                  <Input id={key} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder="approved_template_name" />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="whatsapp-template-language">Template language code</Label>
                <Input id="whatsapp-template-language" value={form.whatsappTemplateLanguage} onChange={(event) => update("whatsappTemplateLanguage", event.target.value)} placeholder="en_ZA" />
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Create and get Meta approval for templates in each connected WhatsApp Business account. Body placeholders, in order:
              order confirmation (shop, order, items, total, delivery); tracking update (order, status, estimated delivery, latest scan);
              pickup reminder (shop, order, pickup window, items, preparation instruction).
            </p>
            {form.whatsappConfigured && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearWhatsAppCredentials}
                  onChange={(event) => setClearWhatsAppCredentials(event.target.checked)}
                />
                Remove saved WhatsApp credentials
              </label>
            )}
          </section>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save shop"}</Button>
            {data && <Link href={`/store/${data.slug}`} className="text-sm text-primary-600 hover:underline">Preview public shop</Link>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductEditor({
  product,
  onSaved,
  onClose,
}: {
  product?: Product;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price.toString() ?? "");
  const [parcelLengthCm, setParcelLengthCm] = useState(product?.parcelLengthCm?.toString() ?? "");
  const [parcelWidthCm, setParcelWidthCm] = useState(product?.parcelWidthCm?.toString() ?? "");
  const [parcelHeightCm, setParcelHeightCm] = useState(product?.parcelHeightCm?.toString() ?? "");
  const [parcelWeightKg, setParcelWeightKg] = useState(product?.parcelWeightKg?.toString() ?? "");
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [isPublished, setPublished] = useState(product?.isPublished ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setLocalPreview("");
      return;
    }
    const preview = `data:${selectedImage.mimeType};base64,${selectedImage.data}`;
    setLocalPreview(preview);
  }, [selectedImage]);

  const selectImage = async (file?: File) => {
    setError("");
    setSelectedImage(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be no larger than 5 MB.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected image."));
        reader.readAsDataURL(file);
      });
      setSelectedImage({ data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: file.type });
      setRemoveImage(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        name,
        description,
        price: Number(price),
        imageUrl: "",
        parcelLengthCm: parcelLengthCm ? Number(parcelLengthCm) : null,
        parcelWidthCm: parcelWidthCm ? Number(parcelWidthCm) : null,
        parcelHeightCm: parcelHeightCm ? Number(parcelHeightCm) : null,
        parcelWeightKg: parcelWeightKg ? Number(parcelWeightKg) : null,
        isPublished,
        ...(selectedImage ? { image: selectedImage } : {}),
        ...(removeImage ? { removeImage: true } : {}),
      };
      await apiRequest(product ? "PATCH" : "POST", product ? `/api/shop/products/${product.id}` : "/api/shop/products", payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`product-name-${product?.id ?? "new"}`}>Product name</Label>
          <Input id={`product-name-${product?.id ?? "new"}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`product-price-${product?.id ?? "new"}`}>Price (ZAR)</Label>
          <Input id={`product-price-${product?.id ?? "new"}`} type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`product-description-${product?.id ?? "new"}`}>Description</Label>
          <Textarea id={`product-description-${product?.id ?? "new"}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`product-image-file-${product?.id ?? "new"}`}>Upload an image (JPEG, PNG, WebP or GIF; up to 5 MB)</Label>
          <Input
            id={`product-image-file-${product?.id ?? "new"}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void selectImage(event.currentTarget.files?.[0])}
          />
          {(localPreview || (!removeImage && product?.imagePreviewUrl)) && (
            <img
              src={localPreview || product?.imagePreviewUrl}
              alt="Product preview"
              className="h-36 w-36 rounded-md border object-cover"
            />
          )}
          {product?.imagePreviewUrl && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(event) => {
                  setRemoveImage(event.target.checked);
                  if (event.target.checked) {
                    setSelectedImage(null);
                  }
                }}
              />
              Remove current image
            </label>
          )}
        </div>
        <div className="space-y-2 md:col-span-2">
          <p className="text-sm font-medium">Parcel size and weight (required for Courier Guy delivery)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["Length (cm)", parcelLengthCm, setParcelLengthCm, 300],
              ["Width (cm)", parcelWidthCm, setParcelWidthCm, 300],
              ["Height (cm)", parcelHeightCm, setParcelHeightCm, 300],
              ["Weight (kg)", parcelWeightKg, setParcelWeightKg, 70],
            ] as const).map(([label, value, setValue, max]) => (
              <div key={label} className="space-y-1">
                <Label htmlFor={`product-${label}-${product?.id ?? "new"}`} className="text-xs">{label}</Label>
                <Input
                  id={`product-${label}-${product?.id ?? "new"}`}
                  type="number"
                  min="0.01"
                  max={max}
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id={`product-published-${product?.id ?? "new"}`} checked={isPublished} onCheckedChange={setPublished} />
        <Label htmlFor={`product-published-${product?.id ?? "new"}`}>Show in live shop</Label>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</Button>
      </div>
    </form>
  );
}

function ProductsPanel() {
  const queryClient = useQueryClient();
  const { data: shop } = useQuery<ShopSettings | null>({ queryKey: ["/api/shop"] });
  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/shop/products"] });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product>();
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/shop/products"] });

  const addProduct = () => {
    setCurrentProduct(undefined);
    setIsEditorOpen(true);
  };

  const editProduct = (product: Product) => {
    setCurrentProduct(product);
    setIsEditorOpen(true);
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    setError("");
    try {
      await apiRequest("DELETE", `/api/shop/products/${product.id}`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Products</CardTitle>
            <CardDescription>Only published products appear in the public shop. This catalogue is separate for each account.</CardDescription>
          </div>
          <Button type="button" onClick={addProduct} disabled={!shop}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product to Shop
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!shop && <p className="text-sm text-neutral-600">Save your shop details before adding products.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading products…</p>
        ) : products.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-neutral-500">
            No products have been added yet. Use “Add Product to Shop” to create your first product.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.imagePreviewUrl ? (
                      <img src={product.imagePreviewUrl} alt="" className="h-12 w-12 rounded-md border object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-400">No image</div>
                    )}
                  </TableCell>
                  <TableCell className="min-w-40">
                    <p className="font-medium text-neutral-900">{product.name}</p>
                    {product.description && <p className="mt-1 max-w-md truncate text-xs text-neutral-500">{product.description}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">R {product.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${product.isPublished ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>
                      {product.isPublished ? "Published" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => editProduct(product)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeProduct(product)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentProduct ? "Edit product" : "Add Product to Shop"}</DialogTitle>
          </DialogHeader>
          {isEditorOpen && (
            <ProductEditor
              key={currentProduct?.id ?? "new"}
              product={currentProduct}
              onSaved={refresh}
              onClose={() => setIsEditorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function defaultPickupDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function OrdersPanel() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery<ShopOrder[]>({
    queryKey: ["/api/shop/orders"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const [error, setError] = useState("");
  const [busyReference, setBusyReference] = useState("");
  const [collectionDate, setCollectionDate] = useState(defaultPickupDate);
  const [collectionAfter, setCollectionAfter] = useState("09:00");
  const [collectionBefore, setCollectionBefore] = useState("11:00");

  const bookShipment = async (order: ShopOrder) => {
    if (!collectionDate || !collectionAfter || !collectionBefore || collectionBefore <= collectionAfter) {
      setError("Choose a valid pickup date and time window.");
      return;
    }
    if (!window.confirm(`Create a Courier Guy shipment for order ${order.reference} with collection ${collectionDate}, ${collectionAfter}–${collectionBefore}?`)) return;
    setBusyReference(order.reference);
    setError("");
    try {
      await apiRequest("POST", `/api/shop/orders/${encodeURIComponent(order.reference)}/ship`, {
        date: collectionDate,
        after: collectionAfter,
        before: collectionBefore,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/shop/orders"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyReference("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Paystack checkout orders for your shop. Payment is verified on the server before an order is marked paid.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No shop orders yet.</p>
        ) : (
          orders.map((order) => {
            const deliveryLabel = order.delivery.method === "collection"
              ? "Collection"
              : order.delivery.method === "locker"
                ? `Courier Guy locker · ${order.delivery.pickupPoint?.name ?? "Pickup point"}`
                : `Courier Guy delivery · ${order.delivery.serviceLevelName ?? "Rate selected"}`;
            const address = order.delivery.address
              ? [
                  order.delivery.address.street_address,
                  order.delivery.address.local_area,
                  order.delivery.address.city,
                  order.delivery.address.zone,
                  order.delivery.address.code,
                ].filter(Boolean).join(", ")
              : order.delivery.pickupPoint?.address;
            return (
              <article key={order.id} className="space-y-3 rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{order.customer.name} · {order.reference}</h3>
                    <p className="text-sm text-neutral-600">{order.customer.email} · {order.customer.phone}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${order.status === "paid" ? "bg-green-100 text-green-800" : order.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-700">
                  {order.items.map((item) => (
                    <li key={item.productId}>{item.quantity} × {item.name} · R {(item.unitPrice * item.quantity).toFixed(2)}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                  <span>{deliveryLabel}{address ? ` — ${address}` : ""}</span>
                  <span className="font-semibold">Total R {(order.amountKobo / 100).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                  {order.status === "paid" && order.delivery.method !== "collection" && (
                    order.delivery.shipment ? (
                      <div className="space-y-1 text-right">
                        <p className="font-medium text-green-700">Courier Guy shipment created</p>
                        {order.delivery.trackingReference && <p>Tracking reference: {order.delivery.trackingReference}</p>}
                        {order.delivery.pickupSchedule && (
                          <p>Pickup: {order.delivery.pickupSchedule.date}, {order.delivery.pickupSchedule.after}–{order.delivery.pickupSchedule.before}</p>
                        )}
                        {order.delivery.tracking?.status && <p>Courier Guy status: {order.delivery.tracking.status}</p>}
                        {order.delivery.tracking?.estimatedDelivery && <p>Estimated delivery: {order.delivery.tracking.estimatedDelivery}</p>}
                      </div>
                    ) : (
                      <div className="w-full space-y-2 rounded-md bg-neutral-50 p-3">
                        <p className="font-medium text-neutral-700">Schedule the Courier Guy collection</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="space-y-1">
                            <span>Pickup date</span>
                            <Input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} />
                          </label>
                          <label className="space-y-1">
                            <span>Pickup from</span>
                            <Input type="time" value={collectionAfter} onChange={(event) => setCollectionAfter(event.target.value)} />
                          </label>
                          <label className="space-y-1">
                            <span>Pickup by</span>
                            <Input type="time" value={collectionBefore} onChange={(event) => setCollectionBefore(event.target.value)} />
                          </label>
                        </div>
                        <p>Owner reminders are scheduled for 24 hours and 2 hours before the pickup window.</p>
                        <Button type="button" size="sm" variant="outline" disabled={!!busyReference} onClick={() => void bookShipment(order)}>
                          {busyReference === order.reference ? "Booking shipment…" : "Create Courier Guy shipment"}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function Shop() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins font-semibold text-2xl text-neutral-900">Shop</h2>
        <p className="text-neutral-600">Manage your independent store, products, collection and shipping.</p>
      </div>
      <ShopSettingsPanel />
      <ProductsPanel />
      <OrdersPanel />
    </div>
  );
}
