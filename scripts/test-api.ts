import { PrismaClient } from '@prisma/client';
import { WorkOS } from '@workos-inc/node';

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const API_BASE = 'http://localhost:3000';
const DEBUG = process.env.DEBUG === 'true';

const CHECK = '✅';
const CROSS = '❌';

function log(message: string, success: boolean, details?: any) {
  console.log(`${success ? CHECK : CROSS} ${message}`);
  if (DEBUG && details) {
    console.log(JSON.stringify(details, null, 2));
  }
}

async function main() {
  try {
    // 1. Get our test users from the database
    const [admin, agent, customer1] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'agent@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'customer1@demo.com' } }),
    ]);

    log('Loaded test users', true, { admin, agent, customer1 });

    // 2. Create a test ticket
    const response = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': admin.id,
      },
      body: JSON.stringify({
        title: 'Test Ticket',
        description: 'This is a test ticket',
        priority: 'HIGH',
        orgId: admin.orgId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ticket: ${response.statusText}\n${error}`);
    }

    const ticket = await response.json();
    log('Created test ticket as admin', true, ticket);

    // 3. Test viewing the ticket with different users
    for (const user of [admin, agent, customer1]) {
      const viewResponse = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
        headers: {
          'X-User-Id': user.id,
        },
      });

      const viewResult = viewResponse.ok ? await viewResponse.json() : await viewResponse.text();
      log(`Viewing ticket as ${user.name}`, viewResponse.ok, {
        status: viewResponse.status,
        result: viewResult,
      });
    }

    // 4. Test updating the ticket
    const updateResponse = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': agent.id,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
      }),
    });

    const updateResult = updateResponse.ok ? await updateResponse.json() : await updateResponse.text();
    log('Updating ticket status as agent', updateResponse.ok, {
      status: updateResponse.status,
      result: updateResult,
    });

    // 5. Test listing tickets with filters
    const listResponse = await fetch(`${API_BASE}/api/tickets?userId=${admin.id}&status=IN_PROGRESS`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const tickets = await listResponse.json();
    log('Listing filtered tickets as admin', listResponse.ok, tickets);

    // 6. Clean up - delete the test ticket
    const deleteResponse = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': admin.id,
      },
    });

    const deleteResult = deleteResponse.ok ? null : await deleteResponse.text();
    log('Deleting test ticket as admin', deleteResponse.ok, deleteResult);

    console.log('\nAll tests completed!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 