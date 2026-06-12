/**
 * S3-compatible storage (MinIO / AWS S3 / CloudFlare R2)
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'siscloud-backups';

export async function uploadFile(schoolId, userId, filePath, buffer, metadata = {}) {
  const key = `${schoolId}/${userId}/${filePath}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    Metadata: {
      ...metadata,
      'uploaded-at': new Date().toISOString(),
    },
  }));
  return key;
}

export async function downloadFile(schoolId, userId, filePath) {
  const key = `${schoolId}/${userId}/${filePath}`;
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return response.Body;
}

export async function deleteFile(schoolId, userId, filePath) {
  const key = `${schoolId}/${userId}/${filePath}`;
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

export async function fileExists(schoolId, userId, filePath) {
  const key = `${schoolId}/${userId}/${filePath}`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function generateDownloadUrl(schoolId, userId, filePath, expiresIn = 3600) {
  const key = `${schoolId}/${userId}/${filePath}`;
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET, Key: key,
  }), { expiresIn });
}

export async function getStorageStats(schoolId) {
  // List objects for a school and calculate total size
  let totalSize = 0;
  let totalObjects = 0;
  try {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: `${schoolId}/`,
    });
    const data = await s3.send(command);
    if (data.Contents) {
      totalSize = data.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      totalObjects = data.Contents.length;
    }
  } catch {
    // Bucket may not exist or no objects
  }
  return { totalSize, totalObjects };
}
