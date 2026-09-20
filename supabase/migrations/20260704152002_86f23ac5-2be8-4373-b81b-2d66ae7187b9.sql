
CREATE TABLE public.email_send_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id text,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  resend_id text,
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all email logs"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_email_send_log_created_at ON public.email_send_log (created_at DESC);
CREATE INDEX idx_email_send_log_status ON public.email_send_log (status);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log (recipient_email);
