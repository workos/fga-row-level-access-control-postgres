import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listAccessibleResources, checkPermission } from '@/lib/fga/auth';
import { WorkOS, WarrantOp } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// Temporary mock auth - replace with real auth later
const getCurrentUser = async (req: NextRequest) => {
  // For testing, we'll use the user ID from the X-User-Id header
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return await prisma.user.findUniqueOrThrow({ where: { id: userId } });
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const searchParams = new URL(req.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    // Get list of accessible ticket IDs from FGA
    const accessibleTicketIds = await listAccessibleResources(user.id, 'ticket', 'viewer');
    console.log('Accessible ticket IDs:', { userId: user.id, accessibleTicketIds });

    // Query tickets with pagination and filters
    const where = {
      id: { in: accessibleTicketIds },
      ...(status && { status }),
      ...(priority && { priority }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);

    console.log('Found tickets:', tickets.length);

    return NextResponse.json({
      tickets: tickets.map((ticket: any) => ({
        ...ticket,
        creatorId: ticket.creator?.id,
        creator: undefined, // Remove full creator object from response
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/tickets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const data = await req.json();

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

    // Create warrants
    await workos.fga.batchWriteWarrants(warrants);

    // Verify warrants were created by checking permissions
    const [isAdmin, isAgent, isMember] = await Promise.all([
      checkPermission(user.id, 'organization', user.orgId, 'admin'),
      checkPermission(user.id, 'organization', user.orgId, 'agent'),
      checkPermission(user.id, 'organization', user.orgId, 'member'),
    ]);

    const hasOrgRole = isAdmin || isAgent || isMember;
    if (!hasOrgRole) {
      console.error('Failed to verify organization role:', { isAdmin, isAgent, isMember });
      throw new Error('Failed to set up permissions');
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/tickets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 