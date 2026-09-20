-- report_products extensions
ALTER TABLE public.report_products
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.report_products SET slug = id WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS report_products_slug_key ON public.report_products (slug);

-- purchases
CREATE TABLE public.report_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id text NOT NULL REFERENCES public.report_products(id) ON DELETE RESTRICT,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  stripe_customer_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  customer_email text,
  email_sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_purchases TO authenticated;
GRANT ALL ON public.report_purchases TO service_role;
ALTER TABLE public.report_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.report_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all purchases" ON public.report_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX report_purchases_user_idx ON public.report_purchases (user_id);
CREATE INDEX report_purchases_report_idx ON public.report_purchases (report_id);
CREATE TRIGGER update_report_purchases_updated_at BEFORE UPDATE ON public.report_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- entitlements
CREATE TABLE public.report_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id text NOT NULL REFERENCES public.report_products(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'purchase',
  purchase_id uuid REFERENCES public.report_purchases(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  granted_by uuid,
  note text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_id)
);
GRANT SELECT ON public.report_entitlements TO authenticated;
GRANT ALL ON public.report_entitlements TO service_role;
ALTER TABLE public.report_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own entitlements" ON public.report_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all entitlements" ON public.report_entitlements
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX report_entitlements_user_idx ON public.report_entitlements (user_id);
CREATE TRIGGER update_report_entitlements_updated_at BEFORE UPDATE ON public.report_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- stripe webhook idempotency
CREATE TABLE public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view webhook events" ON public.stripe_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.stripe_webhook_events TO authenticated;

-- admin audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  target_report_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- admin invites (email -> auto admin on signup)
CREATE TABLE public.admin_invites (
  email text PRIMARY KEY,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_invites TO authenticated;
GRANT ALL ON public.admin_invites TO service_role;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view invites" ON public.admin_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_invites (email) VALUES ('oracle@mycosmicblueprint.online')
  ON CONFLICT (email) DO NOTHING;

-- grant admin on signup when the email is invited
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- backfill: if the invited account already exists, grant it now
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
JOIN public.admin_invites i ON lower(i.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;