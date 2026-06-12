import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}

  return NextResponse.json({
    status: dbOk ? 'ok' : 'degraded',
    version: '1.0.0',
    uptime: process.uptime(),
    platform: process.platform,
    database: dbOk ? 'connected' : 'disconnected',
  });
}
