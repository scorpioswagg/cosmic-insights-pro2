CREATE TABLE public.report_products (
  id text PRIMARY KEY,
  title text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  category text NOT NULL,
  icon text NOT NULL DEFAULT '',
  adult boolean NOT NULL DEFAULT false,
  price_cents integer NOT NULL DEFAULT 1900,
  is_free boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_products_price_nonneg CHECK (price_cents >= 0)
);

GRANT SELECT ON public.report_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_products TO authenticated;
GRANT ALL ON public.report_products TO service_role;

ALTER TABLE public.report_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published reports"
  ON public.report_products FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins can view all reports"
  ON public.report_products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert reports"
  ON public.report_products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
  ON public.report_products FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports"
  ON public.report_products FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

CREATE TRIGGER update_report_products_updated_at
  BEFORE UPDATE ON public.report_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();