import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/fga/auth';
import { WorkOS, WarrantOp } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// Temporary mock auth - replace with real auth later
const getCurrentUser = async (req: NextRequest) => {
  const userId = req.headers.get('x-user-id');
  console.log('Attempting to get user with ID:', userId);
  if (!userId) {
    console.log('No user ID found in headers');
    throw new Error('Unauthorized');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  console.log('Found user:', { id: user.id, email: user.email, orgId: user.orgId });
  return user;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  // Query WorkOS FGA to get tickets the user can view 
  const response = await workos.fga.query({
    q: `select ticket where user:${userId} is viewer`
  });

  // Map the response to an array of ticket IDs the user can view
  const accessibleTicketIds = response.data.map(obj => obj.resourceId);

  // Get tickets user can view
  const tickets = await prisma.ticket.findMany({
    where: {
      id: { in: accessibleTicketIds }
    },
    include: {
      creator: true,
      assignee: true,
    }
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== Starting POST /api/tickets ===');
    const user = await getCurrentUser(req);
    const data = await req.json();
    
    console.log('Creating ticket:', {
      title: data.title,
      status: data.status || 'OPEN',
      priority: data.priority || 'MEDIUM',
      orgId: user.orgId,
      creatorId: user.id,
      assigneeId: data.assigneeId
    });

    // Create the ticket first
    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || 'OPEN',
        priority: data.priority || 'MEDIUM',
        organization: {
          connect: { id: user.orgId }
        },
        creator: {
          connect: { id: user.id }
        },
        ...(data.assigneeId && {
          assignee: {
            connect: { id: data.assigneeId }
          }
        })
      },
    });
    
    console.log('\nCreated ticket:', ticket);

    // Create warrants in FGA
    const warrants = [
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
          resourceId: user.orgId,
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
          resourceId: user.id,
        },
      },
    ];

    // Add assignee warrant if provided
    if (data.assigneeId) {
      warrants.push({
        op: WarrantOp.Create,
        resource: {
          resourceType: 'ticket',
          resourceId: ticket.id,
        },
        relation: 'assignee',
        subject: {
          resourceType: 'user',
          resourceId: data.assigneeId,
        },
      });
    }

    console.log('\nCreating warrants:', warrants);
    await workos.fga.batchWriteWarrants(warrants);

    // Verify warrants were created by checking permissions
    const [isAdmin, isAgent, isMember] = await Promise.all([
      checkPermission(user.id, 'organization', user.orgId, 'admin'),
      checkPermission(user.id, 'organization', user.orgId, 'agent'),
      checkPermission(user.id, 'organization', user.orgId, 'member'),
    ]);

    console.log('\nVerified permissions:', { isAdmin, isAgent, isMember });

    const hasOrgRole = isAdmin || isAgent || isMember;
    if (!hasOrgRole) {
      console.error('Failed to verify organization role:', { isAdmin, isAgent, isMember });
      throw new Error('Failed to set up permissions');
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('\nError in POST /api/tickets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 