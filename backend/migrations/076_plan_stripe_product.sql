-- Plan authoring from the platform console: create plans, and push them to Stripe.
--
-- Until now a plan could only be made sellable by pasting a Stripe Price id copied from
-- the Stripe dashboard by hand. Two columns close that loop:
--
--   stripe_product_id  the Product a plan's Prices belong to. Stripe Prices are IMMUTABLE,
--                      so changing an amount means creating a NEW Price; keeping the
--                      Product lets successive prices stay grouped under one product
--                      rather than littering the dashboard with a product per price change.
--   currency           per plan, because the plan's `price` column carries no currency and
--                      Stripe requires one. Lower-case ISO-4217, as Stripe expects.
--
-- Idempotent.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_product_id varchar(255),
  ADD COLUMN IF NOT EXISTS currency          varchar(3) NOT NULL DEFAULT 'usd';

-- Stripe rejects an upper-case currency; normalise anything already present.
UPDATE public.subscription_plans SET currency = lower(currency) WHERE currency <> lower(currency);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product
  ON public.subscription_plans(stripe_product_id) WHERE stripe_product_id IS NOT NULL;
