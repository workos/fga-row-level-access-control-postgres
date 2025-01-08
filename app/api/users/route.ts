import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['admin@demo.com', 'agent@demo.com', 'customer@demo.com']
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        orgId: true,
      }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 