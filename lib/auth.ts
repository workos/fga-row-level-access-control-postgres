import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Temporary mock auth - replace with real auth later
export async function getCurrentUser(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  console.log('Attempting to get user with ID:', userId);
  if (!userId) {
    console.log('No user ID found in headers');
    throw new Error('Unauthorized');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  console.log('Found user:', { id: user.id, email: user.email, orgId: user.orgId });
  return user;
} 