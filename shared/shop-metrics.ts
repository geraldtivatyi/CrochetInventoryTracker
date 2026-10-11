import type { ShopOrder } from "./schema";

export type ShopMetrics = {
  revenue: number;
  grossProfit: number | null;
  paidOrderCount: number;
  ordersWithCostData: number;
  successfulDeliveryCount: number;
  clientCount: number;
  averageOrderValue: number | null;
};

export type ShopMetricsOrder = Pick<ShopOrder, "status"> & {
  items: Array<Pick<ShopOrder["items"][number], "unitPrice" | "unitCost" | "quantity">>;
  customer: Pick<ShopOrder["customer"], "email">;
  delivery: Pick<ShopOrder["delivery"], "method" | "tracking">;
};

export function calculateShopMetrics(orders: ShopMetricsOrder[]): ShopMetrics {
  const paidOrders = orders.filter((order) => order.status === "paid");
  let revenueCents = 0;
  let profitCents = 0;
  let ordersWithCostData = 0;
  const clients = new Set<string>();
  let successfulDeliveryCount = 0;

  for (const order of paidOrders) {
    const itemRevenueCents = order.items.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
      0,
    );
    revenueCents += itemRevenueCents;
    clients.add(order.customer.email.trim().toLowerCase());

    if (
      order.items.length > 0 &&
      order.items.every((item) => item.unitCost !== null && item.unitCost !== undefined)
    ) {
      const itemCostCents = order.items.reduce(
        (sum, item) => sum + Math.round((item.unitCost ?? 0) * 100) * item.quantity,
        0,
      );
      profitCents += itemRevenueCents - itemCostCents;
      ordersWithCostData += 1;
    }

    const trackingText = `${order.delivery.tracking?.status ?? ""} ${order.delivery.tracking?.latestEvent ?? ""}`;
    if (
      order.delivery.method !== "collection" &&
      /\b(delivered|complete(?:d)?)\b/i.test(trackingText)
    ) {
      successfulDeliveryCount += 1;
    }
  }

  return {
    revenue: revenueCents / 100,
    grossProfit: ordersWithCostData > 0 ? profitCents / 100 : null,
    paidOrderCount: paidOrders.length,
    ordersWithCostData,
    successfulDeliveryCount,
    clientCount: clients.size,
    averageOrderValue: paidOrders.length > 0 ? revenueCents / 100 / paidOrders.length : null,
  };
}
