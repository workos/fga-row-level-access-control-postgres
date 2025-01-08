import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function main() {
  try {
    // Create resource types
    await workos.fga.createResource({
      resource: {
        resourceType: 'ticket',
      },
    });

    await workos.fga.createResource({
      resource: {
        resourceType: 'organization',
      },
    });

    await workos.fga.createResource({
      resource: {
        resourceType: 'user',
      },
    });

    await workos.fga.createResource({
      resource: {
        resourceType: 'role',
      },
    });

    console.log('✅ Resource types created successfully');

  } catch (error) {
    console.error('Failed to create resource types:', error);
    process.exit(1);
  }
}

main(); 