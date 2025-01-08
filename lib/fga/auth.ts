import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

type ResourceType = 'user' | 'organization' | 'ticket';
type Relation = 'member' | 'admin' | 'agent' | 'creator' | 'assignee' | 'viewer';

interface Resource {
  resourceType: string;
  resourceId: string;
}

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

export async function listAccessibleResources(
  userId: string,
  resourceType: ResourceType,
  role: 'admin' | 'agent' | 'creator'
): Promise<string[]> {
  try {
    console.log('Listing accessible resources based on role:', { userId, resourceType, role });
    
    // For all roles, we use the viewer relation as defined in the model
    const query = `select ticket where user:${userId} is viewer`;

    console.log('Executing query:', query);

    const queryResponse = await workos.fga.query({
      q: query,
    });

    // The response is an array of objects with resourceId
    const resources = queryResponse.data as Resource[];
    const resourceIds = resources.map(resource => resource.resourceId);
    console.log('Found accessible resources:', { userId, resourceType, role, resourceIds });
    return resourceIds;
  } catch (error) {
    console.error('Error listing accessible resources:', error);
    return [];
  }
} 