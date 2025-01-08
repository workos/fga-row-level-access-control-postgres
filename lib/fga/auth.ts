import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

type ResourceType = 'user' | 'organization' | 'ticket';
type Relation = 'member' | 'admin' | 'agent' | 'creator' | 'assignee' | 'viewer';

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