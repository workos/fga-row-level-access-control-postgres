import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listAccessibleResources, checkPermission } from '@/lib/fga/auth';
import { WorkOS, WarrantOp } from '@workos-inc/node';
import { PrismaClient } from '@prisma/client';

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

export async function GET(req: NextRequest) {
  try {
    console.log('\n=== Starting GET /api/tickets ===');
    const user = await getCurrentUser(req);
    
    const searchParams = new URL(req.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    
    console.log('Query parameters:', { page, limit, status, priority });

    // Get list of accessible ticket IDs from FGA
    console.log('\nListing accessible resources:', {
      userId: user.id,
      resourceType: 'ticket',
      relation: 'viewer'
    });
    
    const accessibleTicketIds = await listAccessibleResources(user.id, 'ticket', 'viewer');
    console.log('\nFound accessible resources:', {
      userId: user.id,
      resourceType: 'ticket',
      relation: 'viewer',
      resourceIds: accessibleTicketIds
    });

    // Query tickets with pagination and filters
    const where = {
      id: { in: accessibleTicketIds },
      ...(status && { status: status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED' }),
      ...(priority && { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' }),
    };
    
    console.log('\nQuerying tickets with filters:', where);

    // Enable query logging
    process.env.DEBUG = 'prisma:query';

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

    console.log('\nFound tickets:', {
      total,
      pageSize: tickets.length,
      ticketIds: tickets.map((t: { id: string }) => t.id),
      ticketDetails: tickets.map((t: { 
        id: string;
        title: string;
        status: string;
        creatorId: string;
        assigneeId: string | null;
      }) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        creatorId: t.creatorId,
        assigneeId: t.assigneeId
      }))
    });

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
    console.error('\nError in GET /api/tickets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
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