ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'paystack_test';
