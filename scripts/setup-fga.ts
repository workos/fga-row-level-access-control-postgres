import { PrismaClient } from '@prisma/client';
import { WorkOS, WarrantOp, ResourceOp } from '@workos-inc/node';

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function main() {
  try {
    // First create the resource types with their relations
    await workos.fga.batchWriteResources({
      op: ResourceOp.Create,
      resources: [
        {
          resource: {
            resourceType: 'user',
          }
        },
        {
          resource: {
            resourceType: 'organization',
          },
          meta: {
            relations: ['admin', 'agent', 'member']
          }
        },
        {
          resource: {
            resourceType: 'ticket',
          },
          meta: {
            relations: ['parent', 'creator', 'assignee', 'viewer']
          }
        }
      ]
    });

    console.log('Created resource types with relations');

    // Get our test users from the database
    const [admin, agent, customer] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'agent@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'customer@demo.com' } }),
    ]);

    // Set up initial warrants
    const warrants = [
      // Admin user
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'organization',
          resourceId: admin.orgId,
        },
        relation: 'admin',
        subject: {
          resourceType: 'user',
          resourceId: admin.id,
        },
      },
      // Agent user
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'organization',
          resourceId: agent.orgId,
        },
        relation: 'agent',
        subject: {
          resourceType: 'user',
          resourceId: agent.id,
        },
      },
      // Customer user
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'organization',
          resourceId: customer.orgId,
        },
        relation: 'member',
        subject: {
          resourceType: 'user',
          resourceId: customer.id,
        },
      },
    ];

    // Create warrants
    await workos.fga.batchWriteWarrants(warrants);
    console.log('Created warrants:', warrants);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 