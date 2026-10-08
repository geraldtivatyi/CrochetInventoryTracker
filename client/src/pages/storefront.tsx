import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface PublicShopResponse {
  shop: {
    slug: string;
    name: string;
    description: string;
    themeColor: string;
    brandingImageUrl: string;
    checkoutEnabled: boolean;
    collectionEnabled: boolean;
    courierEnabled: boolean;
    lockersEnabled: boolean;
  } | null;
  products: Array<{
    id: number;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
  }>;
}

interface CheckoutRate {
  code: string;
  name: string;
  amountKobo: number;
}

interface CheckoutQuote {
  quoteToken: string;
  expiresAt: number;
  subtotalKobo: number;
  rates: CheckoutRate[];
}

interface PickupPoint {
  id: string | number;
  name: string;
  address?: string;
}

const zar = (kobo: number) => `R ${(kobo / 100).toFixed(2)}`;

function readableTextColor(hexColor: string) {
  const channels = hexColor.slice(1).match(/.{2}/g)?.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  if (!channels || channels.length !== 3) return "#ffffff";
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#1f2937" : "#ffffff";
}

function normalizePickupPoints(response: unknown): PickupPoint[] {
  const found: PickupPoint[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const point = value as Record<string, unknown>;
    const id = point.pickup_point_id ?? point.id ?? point.reference;
    const name = point.name ?? point.label ?? point.description;
    if ((typeof id === "string" || typeof id === "number") && typeof name === "string") {
      const address = [
        point.street_address,
        point.local_area,
        point.city,
        point.zone,
        point.code,
      ].filter((part): part is string => typeof part === "string" && !!part).join(", ");
      found.push({ id, name, ...(address ? { address } : {}) });
    }
    Object.values(point).forEach((nested) => {
      if (nested && typeof nested === "object") visit(nested);
    });
  };
  visit(response);
  return [...new Map(found.map((point) => [String(point.id), point])).values()];
}

function CheckoutDialog({
  shop,
  items,
  open,
  onOpenChange,
}: {
  shop: NonNullable<PublicShopResponse["shop"]>;
  items: Array<{ productId: number; quantity: number }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappUpdates, setWhatsappUpdates] = useState(false);
  const [method, setMethod] = useState<"collection" | "courier" | "locker">(
    shop.collectionEnabled ? "collection" : shop.courierEnabled ? "courier" : "locker",
  );
  const [address, setAddress] = useState({
    type: "residential" as const,
    company: "",
    street_address: "",
    local_area: "",
    city: "",
    zone: "",
    country: "ZA",
    code: "",
  });
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [pickupPointId, setPickupPointId] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote>();
  const [serviceLevelCode, setServiceLevelCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const invalidateQuote = () => {
    setQuote(undefined);
    setServiceLevelCode("");
  };

  const selectedPickupPoint = pickupPoints.find((point) => String(point.id) === pickupPointId);
  const deliveryContact = { name, email, phone };

  const findPickupPoints = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (!navigator.geolocation) throw new Error("Location search is not supported by this browser.");
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000 }),
      );
      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
        type: "locker",
      });
      const response = await fetch(`/api/storefront/${encodeURIComponent(shop.slug)}/pickup-points?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not find nearby Courier Guy lockers.");
      const points = normalizePickupPoints(body);
      if (!points.length) throw new Error("Courier Guy did not return any nearby lockers. Try again from another location.");
      setPickupPoints(points);
      setPickupPointId("");
      invalidateQuote();
      setInfo(`Found ${points.length} nearby locker locations.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find nearby lockers.");
    } finally {
      setBusy(false);
    }
  };

  const getQuote = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const response = await apiRequest("POST", `/api/storefront/${encodeURIComponent(shop.slug)}/checkout/quote`, {
        items,
        method,
        deliveryContact,
        ...(method === "courier" ? { address } : {}),
        ...(method === "locker" && selectedPickupPoint ? { pickupPoint: selectedPickupPoint } : {}),
      });
      const result = await response.json() as CheckoutQuote;
      setQuote(result);
      setServiceLevelCode(result.rates[0]?.code ?? "");
      setInfo("Delivery options are ready. Review the total, then continue to Paystack.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate checkout options.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!quote || !serviceLevelCode) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", `/api/storefront/${encodeURIComponent(shop.slug)}/checkout/initialize`, {
        quoteToken: quote.quoteToken,
        customer: { ...deliveryContact, whatsappUpdates },
        serviceLevelCode,
      });
      const { authorizationUrl } = await response.json() as { authorizationUrl: string };
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Paystack checkout.");
      setBusy(false);
    }
  };

  const quoteIsValid = !!quote && quote.expiresAt > Date.now();
  const selectedRate = quote?.rates.find((rate) => rate.code === serviceLevelCode);
  const totalKobo = quote ? quote.subtotalKobo + (selectedRate?.amountKobo ?? 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Checkout · {shop.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={getQuote} className="space-y-5">
          <section className="space-y-3">
            <h3 className="font-medium">Your contact details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="checkout-name">Full name</Label>
                <Input id="checkout-name" autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); invalidateQuote(); }} required maxLength={120} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="checkout-phone">Phone</Label>
                <Input id="checkout-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); invalidateQuote(); }} required maxLength={30} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="checkout-email">Email</Label>
                <Input id="checkout-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); invalidateQuote(); }} required maxLength={254} />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={whatsappUpdates}
                onChange={(event) => setWhatsappUpdates(event.target.checked)}
                className="mt-1"
              />
              <span>I consent to receive WhatsApp updates about this order and its delivery on this number.</span>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="font-medium">Delivery method</h3>
            <div className="space-y-2">
              {([
                ["collection", shop.collectionEnabled, "Collection"],
                ["courier", shop.courierEnabled, "Courier Guy delivery to an address"],
                ["locker", shop.lockersEnabled, "Courier Guy locker"],
              ] as const).filter(([, enabled]) => enabled).map(([value, , label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
                  <input type="radio" name="delivery-method" value={value} checked={method === value} onChange={() => { setMethod(value); invalidateQuote(); }} />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {method === "courier" && (
            <section className="grid gap-3 sm:grid-cols-2">
              {([
                ["street_address", "Street address"],
                ["local_area", "Suburb / local area"],
                ["city", "City"],
                ["zone", "Province"],
                ["code", "Postal code"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`checkout-address-${key}`}>{label}</Label>
                  <Input
                    id={`checkout-address-${key}`}
                    autoComplete={key === "street_address" ? "street-address" : undefined}
                    value={address[key]}
                    onChange={(event) => { setAddress((current) => ({ ...current, [key]: event.target.value })); invalidateQuote(); }}
                    required
                    maxLength={key === "street_address" ? 180 : 100}
                  />
                </div>
              ))}
            </section>
          )}

          {method === "locker" && (
            <section className="space-y-2">
              <p className="text-sm text-neutral-600">Use your location to find nearby Courier Guy lockers.</p>
              <Button type="button" variant="outline" onClick={findPickupPoints} disabled={busy}>
                {busy ? "Searching…" : "Find nearby lockers"}
              </Button>
              {pickupPoints.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="checkout-locker">Choose a locker</Label>
                  <select
                    id="checkout-locker"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={pickupPointId}
                    onChange={(event) => { setPickupPointId(event.target.value); invalidateQuote(); }}
                    required
                  >
                    <option value="">Select a locker</option>
                    {pickupPoints.map((point) => (
                      <option key={String(point.id)} value={String(point.id)}>
                        {point.name}{point.address ? ` — ${point.address}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}

          {quoteIsValid && quote && (
            <section className="space-y-3 rounded-md bg-neutral-50 p-4">
              <h3 className="font-medium">Choose a delivery rate</h3>
              {quote.rates.map((rate) => (
                <label key={`${rate.code}-${rate.amountKobo}`} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-white p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="service-level" checked={serviceLevelCode === rate.code} onChange={() => setServiceLevelCode(rate.code)} />
                    {rate.name}
                  </span>
                  <span className="font-medium">{zar(rate.amountKobo)}</span>
                </label>
              ))}
              <div className="flex justify-between border-t pt-3 text-sm">
                <span>Products</span><span>{zar(quote.subtotalKobo)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span><span>{zar(totalKobo)}</span>
              </div>
            </section>
          )}

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {info && <p role="status" className="text-sm text-green-700">{info}</p>}
          {quoteIsValid ? (
            <Button type="button" className="w-full" onClick={pay} disabled={busy || !selectedRate}>
              {busy ? "Connecting to Paystack…" : `Pay ${zar(totalKobo)} with Paystack test mode`}
            </Button>
          ) : (
            <Button type="submit" className="w-full" disabled={busy || !items.length || (method === "locker" && !selectedPickupPoint)}>
              {busy ? "Preparing checkout…" : "Calculate delivery and total"}
            </Button>
          )}
          <p className="text-xs text-neutral-500">Payments are currently processed in Paystack test mode. No real payment will be collected.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Storefront({ slug, customDomain = false }: { slug?: string; customDomain?: boolean }) {
  const queryKey = customDomain ? ["/api/storefront/domain"] : [`/api/storefront/${slug}`];
  const { data, isLoading, isError } = useQuery<PublicShopResponse>({ queryKey });
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const reference = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("reference") ?? "";
  const orderQuery = useQuery<{ reference: string; status: string; amountKobo: number; currency: string }>({
    queryKey: [`/api/storefront/${slug}/checkout/verify/${reference}`],
    enabled: !!slug && !!reference,
    staleTime: 0,
    retry: false,
  });

  if (isLoading) return <div className="min-h-screen bg-neutral-50 p-8 text-center text-neutral-600">Loading shop…</div>;
  if (isError || !data?.shop) {
    return <div className="min-h-screen bg-neutral-50 p-8 text-center text-neutral-600">This shop is not available.</div>;
  }

  const { shop, products } = data;
  const themeText = readableTextColor(shop.themeColor);
  const cartItems = Object.entries(cart)
    .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
    .filter(({ productId, quantity }) => quantity > 0 && products.some((product) => product.id === productId));
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);
  const updateQuantity = (productId: number, delta: number) => {
    setCart((current) => {
      const quantity = Math.max(0, Math.min(20, (current[productId] ?? 0) + delta));
      return { ...current, [productId]: quantity };
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b" style={{ backgroundColor: shop.themeColor, color: themeText }}>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-center gap-5">
            {shop.brandingImageUrl && (
              <img src={shop.brandingImageUrl} alt={`${shop.name} brand`} className="max-h-24 max-w-48 rounded-md bg-white/90 object-contain p-2" />
            )}
            <div>
              <h1 className="font-poppins text-3xl font-bold">{shop.name}</h1>
              {shop.description && <p className="mt-2 max-w-2xl opacity-80">{shop.description}</p>}
            </div>
          </div>
          <p className="mt-4 text-sm opacity-80">
            Fulfilment: {[
              shop.collectionEnabled && "Collection",
              shop.courierEnabled && "Courier Guy delivery",
              shop.lockersEnabled && "Courier Guy lockers",
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {reference && (
          <div className="mb-6 rounded-md border bg-white p-4" role="status">
            {orderQuery.isLoading && <p>Checking your Paystack payment…</p>}
            {orderQuery.isError && <p className="text-red-700">We could not confirm this payment yet. Keep your reference {reference} and contact the shop owner if needed.</p>}
            {orderQuery.data?.status === "paid" && <p className="font-medium text-green-700">Payment confirmed. Your order {reference} has been sent to {shop.name}.</p>}
            {orderQuery.data?.status === "pending" && <p>Payment is still being confirmed. Reference: {reference}</p>}
            {orderQuery.data?.status === "failed" && <p className="text-red-700">The payment was not completed. Reference: {reference}</p>}
            {orderQuery.data?.status === "pending" && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void orderQuery.refetch()}>
                Check payment again
              </Button>
            )}
          </div>
        )}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-poppins text-xl font-semibold" style={{ color: shop.themeColor }}>Available products</h2>
          {itemCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setCheckoutOpen(true)} disabled={!shop.checkoutEnabled} style={{ backgroundColor: shop.themeColor, color: themeText }}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Basket ({itemCount}) · R {cartTotal.toFixed(2)}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("basket-summary")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              >
                Go to checkout
              </Button>
            </div>
          )}
        </div>
        {products.length === 0 ? (
          <p className="text-neutral-600">This shop has no products available right now.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                {product.imageUrl && (
                  <img src={product.imageUrl} alt="" className="h-52 w-full object-cover" loading="lazy" />
                )}
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-semibold text-lg" style={{ color: shop.themeColor }}>{product.name}</h3>
                  {product.description && <p className="whitespace-pre-wrap text-sm text-neutral-600">{product.description}</p>}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <p className="font-semibold" style={{ color: shop.themeColor }}>R {product.price.toFixed(2)}</p>
                    {(cart[product.id] ?? 0) > 0 ? (
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" aria-label={`Remove one ${product.name}`} onClick={() => updateQuantity(product.id, -1)}><Minus className="h-4 w-4" /></Button>
                        <span className="min-w-6 text-center font-medium">{cart[product.id]}</span>
                        <Button type="button" variant="outline" size="icon" aria-label={`Add one ${product.name}`} onClick={() => updateQuantity(product.id, 1)} disabled={itemCount >= 20}><Plus className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button type="button" size="sm" onClick={() => updateQuantity(product.id, 1)} disabled={itemCount >= 20} style={{ backgroundColor: shop.themeColor, color: themeText }}>
                        Add to basket
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {itemCount > 0 && (
          <div id="basket-summary">
            <Card className="mt-8">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">Your basket</h3>
                  <p className="text-sm text-neutral-600">{itemCount} item{itemCount === 1 ? "" : "s"} · R {cartTotal.toFixed(2)} before delivery</p>
                </div>
                <div className="space-y-2 text-right">
                  {!shop.checkoutEnabled && <p className="text-sm text-amber-700">Online checkout is not configured yet. Please contact the shop owner.</p>}
                  <Button type="button" onClick={() => setCheckoutOpen(true)} disabled={!shop.checkoutEnabled} style={{ backgroundColor: shop.themeColor, color: themeText }}>
                    Continue to checkout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {itemCount > 0 && shop.checkoutEnabled && (
          <CheckoutDialog
            shop={shop}
            items={cartItems}
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
          />
        )}
        <p className="mt-8 border-t pt-4 text-sm text-neutral-500">
          Payments are processed securely by Paystack. Shipping rates are quoted by Courier Guy at checkout.
        </p>
      </main>
    </div>
  );
}
