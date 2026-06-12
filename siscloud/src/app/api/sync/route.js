/**
 * Siscloud Sync API
 *
 * Entry point for App Server → Siscloud synchronization
 * App Server authenticates via API Key in X-Siscloud-Key header
 */
import { NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit } from '@/lib/auth';
import { uploadFile, deleteFile, fileExists, getStorageStats } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

// ─── POST /api/sync — Receive sync data from App Server ──

export async function POST(request) {
  // Auth via API Key
  const apiKey = request.headers.get('x-siscloud-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const keyRecord = await validateApiKey(apiKey);
  if (!keyRecord) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
  }

  const school = keyRecord.school;
  if (!school.isActive) {
    return NextResponse.json({ error: 'School account inactive' }, { status: 403 });
  }

  // Rate limit
  if (!checkRateLimit(`sync:${school.id}`, 1000, 60000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { operation, userId, filePath, data, metadata } = body;

    switch (operation) {
      case 'upload': {
        // File upload to cloud storage
        const buffer = Buffer.from(data, 'base64');
        const key = await uploadFile(school.id, userId, filePath, buffer, metadata);

        // Record in sync journal
        await prisma.syncJournal.create({
          data: {
            schoolId: school.id,
            userId,
            filePath,
            operation: 'CREATE',
            fileSize: buffer.length,
            fileHash: metadata?.hash,
          },
        });

        // Update storage used
        await prisma.school.update({
          where: { id: school.id },
          data: { storageUsedGb: { increment: buffer.length / (1024 * 1024 * 1024) } },
        });

        // Update user used bytes
        await prisma.schoolUser.updateMany({
          where: { schoolId: school.id, id: userId },
          data: { usedBytes: { increment: buffer.length } },
        });

        return NextResponse.json({ success: true, storageKey: key });
      }

      case 'delete': {
        await deleteFile(school.id, userId, filePath);
        await prisma.syncJournal.create({
          data: {
            schoolId: school.id, userId, filePath, operation: 'DELETE',
          },
        });
        return NextResponse.json({ success: true });
      }

      case 'batch': {
        // Batch operations for efficiency
        const results = { uploaded: 0, deleted: 0, errors: 0 };
        const { operations } = body;

        for (const op of operations) {
          try {
            if (op.operation === 'upload') {
              const buffer = Buffer.from(op.data, 'base64');
              await uploadFile(school.id, op.userId, op.filePath, buffer, op.metadata);
              results.uploaded++;
            } else if (op.operation === 'delete') {
              await deleteFile(school.id, op.userId, op.filePath);
              results.deleted++;
            }
          } catch {
            results.errors++;
          }
        }

        // Batch journal
        await prisma.syncJournal.createMany({
          data: operations.map(op => ({
            schoolId: school.id,
            userId: op.userId,
            filePath: op.filePath,
            operation: op.operation === 'delete' ? 'DELETE' : 'CREATE',
            fileSize: op.operation === 'upload' ? Math.ceil((op.data?.length || 0) * 0.75) : null,
            fileHash: op.metadata?.hash,
          })),
        });

        return NextResponse.json({ success: true, results });
      }

      default:
        return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    }
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: 'Sync failed', detail: err.message }, { status: 500 });
  }
}

// ─── GET /api/sync/status — Check sync status ─────────────

export async function GET(request) {
  const apiKey = request.headers.get('x-siscloud-key');
  if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 401 });

  const keyRecord = await validateApiKey(apiKey);
  if (!keyRecord) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });

  const school = keyRecord.school;
  const stats = await getStorageStats(school.id);

  const recentSyncs = await prisma.syncJournal.findMany({
    where: { schoolId: school.id },
    orderBy: { syncedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    school: {
      name: school.schoolName,
      plan: school.plan,
      storageLimitGb: school.storageLimitGb,
      storageUsedGb: school.storageUsedGb,
    },
    storage: stats,
    recentSyncs,
  });
}
