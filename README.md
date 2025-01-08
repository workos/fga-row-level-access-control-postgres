# Row-level access control with WorkOS FGA and Postgres

![FGA row-level access control with Postgres](./public/hero.webp)

This example application demonstrates how to implement row-level security in a Next.js application using [WorkOS FGA (Fine-Grained Authorization)](https://workos.com/fine-grained-authorization) and Postgres. 

It showcases a simple ticket management system where users have different roles (admin, agent, customer) and permissions are enforced at the row level.

## Overview

The application demonstrates two common patterns for implementing row-level security:

1. **Pre-filtering (Recommended)**: Query WorkOS FGA first to get a list of resource IDs the user has access to, then use these IDs in your SQL WHERE clause.
2. **Post-filtering**: Run your SQL query first, then filter the results based on FGA permissions.

### Pre-filtering Example (Used in this demo)

```typescript
// Get list of accessible ticket IDs from FGA
const accessibleTicketIds = await listAccessibleResources(userId, 'ticket', 'viewer');

// Use these IDs in your SQL query
const tickets = await prisma.ticket.findMany({
  where: {
    id: { in: accessibleTicketIds },
    // ... other filters
  }
});
```

### Post-filtering Alternative

While not used in this demo, here's how you could implement post-filtering:

```typescript
// First, get all tickets
const tickets = await prisma.ticket.findMany({
  where: { /* your filters */ }
});

// Then check permissions for each ticket
const accessibleTickets = await Promise.all(
  tickets.map(async (ticket) => {
    const hasAccess = await checkPermission(userId, 'ticket', ticket.id, 'viewer');
    return hasAccess ? ticket : null;
  })
).then(tickets => tickets.filter(Boolean));
```

Pre-filtering is generally more efficient as it reduces the number of database queries and permission checks.

## Features

- Role-based access control (Admin, Agent, Customer)
- Row-level security on tickets
- Permission inheritance (e.g., admins automatically get viewer access)
- REST API endpoints with permission checks
- Integration with Vercel Postgres

## Authorization Model

The FGA model defines the following types and relations:

```
type user

type ticket
    relation assignee [user]
    relation creator [user]
    relation parent [organization]
    relation viewer [user]

    inherit viewer if
        any_of
            relation creator
            relation assignee
            relation admin on parent [organization]
            relation agent on parent [organization]
            relation member on parent [organization]

type organization
    relation admin [user]
    relation agent [user]
    relation member [user]
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fga-row-level-security-postgres.git
   cd fga-row-level-security-postgres
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables in `.env`:
   ```
   # WorkOS credentials
   WORKOS_API_KEY=your_api_key
   WORKOS_CLIENT_ID=your_client_id

   # Database URLs (Vercel Postgres)
   POSTGRES_URL=your_postgres_url
   POSTGRES_PRISMA_URL=your_prisma_url
   POSTGRES_URL_NON_POOLING=your_non_pooling_url
   ```

4. Initialize the database:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. Set up FGA resources and initial permissions:
   ```bash
   npm run setup:fga
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## API Routes

- `GET /api/tickets`: List accessible tickets (pre-filtered)
- `POST /api/tickets`: Create a new ticket
- `GET /api/tickets/[id]`: Get a specific ticket
- `PATCH /api/tickets/[id]`: Update a ticket
- `DELETE /api/tickets/[id]`: Delete a ticket

## Testing

The repository includes API tests that demonstrate the permission system:

```bash
npm run test:api
```

This will:
1. Create a test ticket
2. Test viewing the ticket with different user roles
3. Test updating the ticket
4. Test listing tickets with filters
5. Clean up by deleting the test ticket

## Learn More

- [WorkOS FGA Documentation](https://workos.com/docs/fine-grained-authorization)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

MIT
