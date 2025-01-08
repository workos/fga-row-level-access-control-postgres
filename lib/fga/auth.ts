import { WorkOS } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

type ResourceType = 'user' | 'organization' | 'ticket';
type Relation = 'member' | 'admin' | 'agent' | 'creator' | 'assignee' | 'viewer';

// User Authentication
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

// Fine-Grained Authorization
export async function checkPermission(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  relation: Relation
): Promise<boolean> {
  try {
    console.log('Checking permission:', { userId, resourceType, resourceId, relation });
    const checkResult = await workos.fga.check({
      checks: [
        {
          resource: {
            resourceType,
            resourceId,
          },
          relation,
          subject: {
            resourceType: 'user',
            resourceId: userId,
          },
        },
      ],
    });

    const isAuthorized = checkResult.isAuthorized();
    console.log('Permission check result:', { userId, resourceType, resourceId, relation, isAuthorized });
    return isAuthorized;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
} 