# Setup Notes

## Supabase

1. Create a new Supabase project.
2. Open SQL editor and run `supabase/schema.sql`.
3. Create a user account through Supabase Auth.
4. Confirm RLS is enabled on all app tables.
5. Deploy the Edge Function:

```powershell
supabase functions deploy create-r2-upload-url
```

6. Set secrets:

```powershell
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set R2_ACCOUNT_ID="..."
supabase secrets set R2_ACCESS_KEY_ID="..."
supabase secrets set R2_SECRET_ACCESS_KEY="..."
supabase secrets set R2_BUCKET="meal-ledger-media"
supabase secrets set R2_PUBLIC_BASE_URL="https://media.example.com"
```

## Cloudflare R2

1. Create a bucket, for example `meal-ledger-media`.
2. Create an R2 API token scoped to that bucket.
3. Configure CORS if uploads happen directly from the browser.
4. Use private objects by default.
5. Prefer short-lived signed GET URLs for private viewing, or a custom domain only if the photo library can be public/protected elsewhere.
6. The first upload endpoint creates `media_assets` metadata before the browser PUT completes. A later upload-confirmation function should reconcile missing R2 objects and clean up abandoned rows.

## Frontend Upload Contract

Request:

```json
{
  "contentType": "image/jpeg",
  "capturedAt": "2026-07-05T12:34:00+08:00",
  "kind": "meal_photo"
}
```

Response:

```json
{
  "mediaId": "uuid",
  "putUrl": "https://...",
  "method": "PUT",
  "expiresInSeconds": 900,
  "objectKey": "user-id/originals/media-id.jpg",
  "thumbnailKey": "user-id/thumbs/media-id.webp"
}
```

Then upload:

```powershell
Invoke-WebRequest -Method Put -Uri $putUrl -ContentType "image/jpeg" -InFile ".\meal.jpg"
```

## Export Contract

Daily ledger export should query:

```sql
select * from public.ledger_export
where occurred_at >= '2026-07-01'
  and occurred_at < '2026-08-01'
order by occurred_at;
```

This export intentionally includes only `linked_meal_ids` and `linked_media_ids`, not image bytes.
