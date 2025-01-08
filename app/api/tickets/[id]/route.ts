import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/fga/auth';
import { getCurrentUser } from '@/lib/fga/auth';
import { WorkOS, WarrantOp } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    const ticketId = params.id;

    // Check if user has permission to view this ticket
    const [isCreator, isAssignee, isAdmin, isAgent, isMember] = await Promise.all([
      checkPermission(user.id, 'ticket', ticketId, 'creator'),
      checkPermission(user.id, 'ticket', ticketId, 'assignee'),
      checkPermission(user.id, 'organization', user.orgId, 'admin'),
      checkPermission(user.id, 'organization', user.orgId, 'agent'),
      checkPermission(user.id, 'organization', user.orgId, 'member'),
    ]);

    const canView = isCreator || isAssignee || isAdmin || isAgent || isMember;
    if (!canView) {
      return NextResponse.json(
        { error: 'Not authorized to view this ticket' },
        { status: 403 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error in GET /api/tickets/[id]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    const ticketId = params.id;
    const data = await req.json();

    // Check if user is admin, agent, creator, or assignee
    const [isAdmin, isAgent, isCreator, isAssignee] = await Promise.all([
      checkPermission(user.id, 'organization', user.orgId, 'admin'),
      checkPermission(user.id, 'organization', user.orgId, 'agent'),
      checkPermission(user.id, 'ticket', ticketId, 'creator'),
      checkPermission(user.id, 'ticket', ticketId, 'assignee'),
    ]);

    if (!isAdmin && !isAgent && !isCreator && !isAssignee) {
      return NextResponse.json(
        { error: 'Not authorized to update this ticket' },
        { status: 403 }
      );
    }

    // Only admins and agents can reassign tickets
    if (data.assigneeId !== undefined && !isAdmin && !isAgent) {
      return NextResponse.json(
        { error: 'Not authorized to assign this ticket' },
        { status: 403 }
      );
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If assignee changed, update FGA warrants
    if (data.assigneeId !== undefined && data.assigneeId !== ticket.assigneeId) {
      const warrants = [];

      // Remove old assignee if exists
      if (ticket.assigneeId) {
        warrants.push({
          op: WarrantOp.Delete,
          resource: {
            resourceType: 'ticket',
            resourceId: ticketId,
          },
          relation: 'assignee',
          subject: {
            resourceType: 'user',
            resourceId: ticket.assigneeId,
          },
        });
      }

      // Add new assignee if exists
      if (data.assigneeId) {
        warrants.push({
          op: WarrantOp.Create,
          resource: {
            resourceType: 'ticket',
            resourceId: ticketId,
          },
          relation: 'assignee',
          subject: {
            resourceType: 'user',
            resourceId: data.assigneeId,
          },
        });
      }

      await workos.fga.batchWriteWarrants(warrants);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error in PATCH /api/tickets/[id]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    const ticketId = params.id;

    // Only admins and creators can delete tickets
    const [isAdmin, isCreator] = await Promise.all([
      checkPermission(user.id, 'organization', user.orgId, 'admin'),
      checkPermission(user.id, 'ticket', ticketId, 'creator'),
    ]);

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Not authorized to delete this ticket' },
        { status: 403 }
      );
    }

    // Delete the ticket
    await prisma.ticket.delete({
      where: { id: ticketId },
    });

    // Remove all warrants for this ticket
    await workos.fga.batchWriteWarrants([
      {
        op: WarrantOp.Delete,
        resource: {
          resourceType: 'ticket',
          resourceId: ticketId,
        },
        relation: 'organization',
        subject: {
          resourceType: 'organization',
          resourceId: user.orgId,
        },
      },
      {
        op: WarrantOp.Delete,
        resource: {
          resourceType: 'ticket',
          resourceId: ticketId,
        },
        relation: 'creator',
        subject: {
          resourceType: 'user',
          resourceId: user.id,
        },
      },
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/tickets/[id]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 