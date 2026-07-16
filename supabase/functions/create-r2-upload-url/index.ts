import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const R2_ACCOUNT_ID = requireEnv("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET = requireEnv("R2_BUCKET");
const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "";

const corsHeaders = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const allowedKinds = ["meal-photo", "receipt-scan", "invoice-scan", "attachment"] as const;
type MediaKind = (typeof allowedKinds)[number];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && allowedKinds.includes(value as MediaKind);
}

function cleanImageContentType(type?: string): string {
  return type?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function getExtensionFromContentType(type: string): string {
  const subtype = type.split("/")[1];
  if (subtype === "jpeg" || subtype === "jpg") return "jpg";
  if (subtype === "png") return "png";
  if (subtype === "gif") return "gif";
  if (subtype === "webp") return "webp";
  if (subtype === "svg+xml" || subtype === "svg") return "svg";
  if (subtype === "avif") return "avif";
  if (subtype === "heic" || subtype === "heif") return subtype;
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ""),
  );
  if (userError || !userData.user) return json({ error: "invalid_user" }, 401);

  const body = await req.json().catch(() => null);
  const contentType = cleanImageContentType(body?.contentType);
  const kind = body?.kind ?? "attachment";
  const capturedAt = body?.capturedAt ?? null;
  const extension = getExtensionFromContentType(contentType);

  if (!contentType.startsWith("image/")) {
    return json({ error: "only_image_uploads_are_allowed" }, 400);
  }
  if (!isMediaKind(kind)) return json({ error: "invalid_media_kind", allowedKinds }, 400);

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
    media_kind: kind,
    storage_provider: "r2",
    bucket: R2_BUCKET,
    object_key: objectKey,
    thumbnail_object_key: thumbnailKey,
    content_type: contentType,
    captured_at: capturedAt,
  });

  if (insertError) return json({ error: "failed_to_create_media_asset" }, 500);

  return json({
    mediaId,
    putUrl,
    method: "PUT",
    expiresInSeconds: 900,
    objectKey,
    thumbnailKey,
  });
});
