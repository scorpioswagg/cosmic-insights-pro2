
-- Admins can read every PDF; users can read files under their own user_id/ prefix.
CREATE POLICY "Admins read all report pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'report-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read their own report pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
