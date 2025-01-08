import { PrismaClient } from '@prisma/client';
import { WorkOS } from '@workos-inc/node';

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const API_BASE = 'http://localhost:3001';

async function main() {
  try {
    // 1. Get our test users from the database
    const [admin, agent, customer] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'agent@demo.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'customer@demo.com' } }),
    ]);

    console.log('Test users loaded:', { admin, agent, customer });

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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ticket: ${response.statusText}\n${error}`);
    }

    const ticket = await response.json();
    console.log('Created test ticket:', ticket);

    // 3. Test viewing the ticket with different users
    for (const user of [admin, agent, customer]) {
      const viewResponse = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
        headers: {
          'X-User-Id': user.id,
        },
      });

      const viewResult = viewResponse.ok ? await viewResponse.json() : await viewResponse.text();
      console.log(`View ticket as ${user.email}:`, {
        status: viewResponse.status,
        ok: viewResponse.ok,
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
    console.log('Update ticket as agent:', {
      status: updateResponse.status,
      ok: updateResponse.ok,
      result: updateResult,
    });

    // 5. Test listing tickets with filters
    const listResponse = await fetch(`${API_BASE}/api/tickets?status=IN_PROGRESS`, {
      headers: {
        'X-User-Id': admin.id,
      },
    });

    const tickets = await listResponse.json();
    console.log('List filtered tickets:', tickets);

    // 6. Clean up - delete the test ticket
    const deleteResponse = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': admin.id,
      },
    });

    const deleteResult = deleteResponse.ok ? null : await deleteResponse.text();
    console.log('Delete ticket:', {
      status: deleteResponse.status,
      ok: deleteResponse.ok,
      ...(deleteResult && { error: deleteResult }),
    });

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 