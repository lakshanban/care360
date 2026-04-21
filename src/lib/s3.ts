import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

export function getS3BucketAndRegion(): { bucket: string; region: string } {
  const bucket =
    process.env.S3_BUCKET_NAME ?? process.env.AWS_S3_BUCKET ?? "";
  const region = process.env.AWS_REGION ?? "us-east-1";
  if (!bucket) {
    throw new Error(
      "S3 is not configured. Set S3_BUCKET_NAME (or AWS_S3_BUCKET) and AWS_REGION.",
    );
  }
  return { bucket, region };
}

export function getS3Client(): S3Client {
  if (!client) {
    const { region } = getS3BucketAndRegion();
    client = new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return client;
}

const PRESIGN_PUT_EXPIRES = Number(process.env.S3_PRESIGN_PUT_EXPIRES ?? 900);
const PRESIGN_GET_EXPIRES = Number(process.env.S3_PRESIGN_GET_EXPIRES ?? 3600);

export async function createPresignedPutUrl(input: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; expiresIn: number }> {
  const { bucket } = getS3BucketAndRegion();
  const s3 = getS3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const expiresIn = PRESIGN_PUT_EXPIRES;
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });
  return { uploadUrl, expiresIn };
}

export async function createPresignedGetUrl(key: string): Promise<string> {
  const { bucket } = getS3BucketAndRegion();
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: PRESIGN_GET_EXPIRES });
}

export function registrationObjectPrefix(userId: string): string {
  return `caregiver-registration/${userId}`;
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "") || "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
}
