import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET = Deno.env.get("R2_BUCKET")!;
const R2_PUBLIC_BASE_URL = Deno.env.get("R2_PUBLIC_BASE_URL") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ""),
  );
  if (userError || !userData.user) return json({ error: "invalid_user" }, 401);

  const body = await req.json().catch(() => null);
  const contentType = body?.contentType as string | undefined;
  const kind = body?.kind ?? "meal_photo";
  const capturedAt = body?.capturedAt ?? null;
  const extension = contentType?.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";

  if (!contentType?.startsWith("image/")) {
    return json({ error: "only_image_uploads_are_allowed" }, 400);
  }

  const mediaId = crypto.randomUUID();
  const objectKey = `${userData.user.id}/originals/${mediaId}.${extension}`;
  const thumbnailKey = `${userData.user.id}/thumbs/${mediaId}.webp`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  const putUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  const { error: insertError } = await supabase.from("media_assets").insert({
    id: mediaId,
    user_id: userData.user.id,
    kind,
    storage_provider: "r2",
    bucket: R2_BUCKET,
    object_key: objectKey,
    thumbnail_key: thumbnailKey,
    content_type: contentType,
    captured_at: capturedAt,
  });

  if (insertError) return json({ error: insertError.message }, 500);

  return json({
    mediaId,
    putUrl,
    method: "PUT",
    expiresInSeconds: 900,
    objectKey,
    thumbnailKey,
    publicUrl: R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL}/${objectKey}` : null,
  });
});

