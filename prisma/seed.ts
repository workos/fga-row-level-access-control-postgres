import { PrismaClient } from '@prisma/client';
import { WorkOS, WarrantOp } from '@workos-inc/node';

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function main() {
  // First, clean up any existing data
  console.log('Cleaning up existing data...');
  await prisma.ticket.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  // Create two test organizations
  console.log('Creating organizations...');
  const [org1, org2] = await Promise.all([
    prisma.organization.upsert({
      where: { id: 'org_01' },
      update: {},
      create: {
        id: 'org_01',
        name: 'Acme Corp',
      },
    }),
    prisma.organization.upsert({
      where: { id: 'org_02' },
      update: {},
      create: {
        id: 'org_02',
        name: 'Globex Corp',
      },
    }),
  ]);

  // Create test users
  const [admin, agent, customer1, customer2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@demo.com' },
      update: {},
      create: {
        id: 'user_admin',
        email: 'admin@demo.com',
        name: 'Admin User',
        orgId: org1.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent@demo.com' },
      update: {},
      create: {
        id: 'user_agent',
        email: 'agent@demo.com',
        name: 'Support Agent',
        orgId: org1.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'customer1@demo.com' },
      update: {},
      create: {
        id: 'user_customer1',
        email: 'customer1@demo.com',
        name: 'Alice (Customer)',
        orgId: org1.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'customer2@demo.com' },
      update: {},
      create: {
        id: 'user_customer2',
        email: 'customer2@demo.com',
        name: 'Bob (Customer)',
        orgId: org2.id,
      },
    }),
  ]);

  // Create test tickets
  const tickets = await Promise.all([
    // Tickets for Customer 1 (Alice)
    prisma.ticket.create({
      data: {
        title: 'Need help with login',
        description: 'I cannot log in to my account',
        status: 'OPEN',
        priority: 'HIGH',
        orgId: org1.id,
        assigneeId: agent.id, // Assigned to support agent
        creatorId: customer1.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Feature request from Alice',
        description: 'Would love to have dark mode',
        status: 'OPEN',
        priority: 'LOW',
        orgId: org1.id,
        creatorId: customer1.id, // Unassigned ticket
      },
    }),
    // Tickets for Customer 2 (Bob)
    prisma.ticket.create({
      data: {
        title: 'API Integration Issue',
        description: 'Getting 500 errors',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        orgId: org2.id,
        assigneeId: agent.id, // Assigned to support agent
        creatorId: customer2.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Billing Question from Bob',
        description: 'Need help with invoice',
        status: 'OPEN',
        priority: 'MEDIUM',
        orgId: org2.id,
        creatorId: customer2.id, // Unassigned ticket
      },
    }),
  ]);

  // Set up FGA warrants
  const warrants = [
    // Organization role warrants for org1
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org1.id,
      },
      relation: 'admin',
      subject: {
        resourceType: 'user',
        resourceId: admin.id,
      },
    },
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org2.id,
      },
      relation: 'admin',
      subject: {
        resourceType: 'user',
        resourceId: admin.id,
      },
    },
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org1.id,
      },
      relation: 'agent',
      subject: {
        resourceType: 'user',
        resourceId: agent.id,
      },
    },
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org2.id,
      },
      relation: 'agent',
      subject: {
        resourceType: 'user',
        resourceId: agent.id,
      },
    },
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org1.id,
      },
      relation: 'member',
      subject: {
        resourceType: 'user',
        resourceId: customer1.id,
      },
    },
    {
      op: WarrantOp.Create,
      resource: {
        resourceType: 'organization',
        resourceId: org2.id,
      },
      relation: 'member',
      subject: {
        resourceType: 'user',
        resourceId: customer2.id,
      },
    },
  ];

  // Add ticket-specific warrants
  for (const ticket of tickets) {
    warrants.push(
      // Set parent organization
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'parent',
        subject: {
          resourceType: 'organization',
          resourceId: ticket.orgId,
        },
      },
      // Set creator
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'creator',
        subject: {
          resourceType: 'user',
          resourceId: ticket.creatorId,
        },
      }
    );

    // Add assignee warrant if ticket is assigned
    if (ticket.assigneeId) {
      warrants.push({
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'assignee',
        subject: {
          resourceType: 'user',
          resourceId: ticket.assigneeId,
        },
      });
    }
  }

  // Create all warrants in a single batch
  await workos.fga.batchWriteWarrants(warrants);

  console.log('Seed completed successfully');
  console.log('Created organizations:', { org1: org1.id, org2: org2.id });
  console.log('Created users:', {
    admin: admin.id,
    agent: agent.id,
    customer1: customer1.id,
    customer2: customer2.id,
  });
  console.log('Created tickets:', tickets.map(t => ({ id: t.id, creator: t.creatorId, assignee: t.assigneeId })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 