const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Create demo organization
  const demoOrg = await prisma.organization.create({
    data: {
      name: 'Demo Company',
    },
  })

  // Create demo users
  const [admin, agent, customer] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@demo.com',
        name: 'Admin User',
        orgId: demoOrg.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'agent@demo.com',
        name: 'Support Agent',
        orgId: demoOrg.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer@demo.com',
        name: 'Customer User',
        orgId: demoOrg.id,
      },
    }),
  ])

  // Create sample tickets
  const tickets = await Promise.all([
    prisma.ticket.create({
      data: {
        title: 'Unable to access dashboard',
        description: 'Getting a 404 error when trying to access the main dashboard.',
        status: 'OPEN',
        priority: 'HIGH',
        orgId: demoOrg.id,
        assigneeId: agent.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Feature request: Dark mode',
        description: 'Would love to see a dark mode option added.',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        orgId: demoOrg.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: 'Billing question',
        description: 'Need clarification on latest invoice.',
        status: 'OPEN',
        priority: 'LOW',
        orgId: demoOrg.id,
      },
    }),
  ])

  console.log({
    demoOrg,
    users: { admin, agent, customer },
    tickets,
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  }) 