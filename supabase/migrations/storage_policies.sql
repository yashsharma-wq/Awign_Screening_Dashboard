-- Storage bucket policies for User_File_Uploads
-- Run this SQL in your Supabase SQL Editor to set up storage policies

-- First, ensure the bucket exists (create it in Supabase Dashboard > Storage if it doesn't)
-- Then run these policies:

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'User_File_Uploads' AND
  ((storage.foldername(name))[1] = 'Job_Data' OR (storage.foldername(name))[1] = 'Candidate_Data')
);

-- Policy to allow authenticated users to read their own files
CREATE POLICY "Allow authenticated users to read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'User_File_Uploads'
);

-- Policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'User_File_Uploads'
)
WITH CHECK (
  bucket_id = 'User_File_Uploads'
);

-- Policy to allow authenticated users to delete their own files (optional)
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'User_File_Uploads'
);

-- If you want public read access (for public URLs), add this:
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'User_File_Uploads'
);

