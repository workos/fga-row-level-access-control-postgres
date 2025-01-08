const { PrismaClient } = require('@prisma/client');
const { WorkOS, WarrantOp } = require('@workos-inc/node');

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function main() {
  // Create test organization
  const org = await prisma.organization.upsert({
    where: { id: 'org_01' },
    update: {},
    create: {
      id: 'org_01',
      name: 'Demo Organization',
    },
  });

  // Create test users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'Admin User',
      orgId: org.id,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@demo.com' },
    update: {},
    create: {
      email: 'agent@demo.com',
      name: 'Support Agent',
      orgId: org.id,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: {},
    create: {
      email: 'customer@demo.com',
      name: 'Customer User',
      orgId: org.id,
    },
  });

  // Create test tickets
  const tickets = await Promise.all([
    // Ticket assigned to agent
    prisma.ticket.create({
      data: {
        title: 'Need help with login',
        description: 'I cannot log in to my account. It says invalid credentials.',
        status: 'OPEN',
        priority: 'HIGH',
        orgId: org.id,
        assigneeId: agent.id,
      },
    }),
    // Ticket created by customer
    prisma.ticket.create({
      data: {
        title: 'Feature request: Dark mode',
        description: 'Would love to have a dark mode option in the dashboard.',
        status: 'OPEN',
        priority: 'LOW',
        orgId: org.id,
      },
    }),
    // Ticket in progress
    prisma.ticket.create({
      data: {
        title: 'API integration issue',
        description: 'The API is returning 500 errors intermittently.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        orgId: org.id,
        assigneeId: agent.id,
      },
    }),
  ]);

  // Set up FGA warrants for each ticket
  for (const ticket of tickets) {
    const warrants = [
      // Set organization relationship
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'parent',
        subject: {
          resourceType: 'organization',
          resourceId: org.id,
        },
      },
      // Set creator (using customer for all test tickets)
      {
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'creator',
        subject: {
          resourceType: 'user',
          resourceId: customer.id,
        },
      },
    ];

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

    await workos.fga.batchWriteWarrants(warrants);
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 