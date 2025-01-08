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

## Testing the Application

The repository includes API tests that demonstrate how the permission system works in practice. The tests verify that:

1. Admins can create, view, and delete tickets
2. Agents can view and update tickets
3. Customers can view tickets in their organization
4. Permission checks are enforced correctly

Run the tests with:
```bash
npm run test:api
```

The test output uses ✅ and ❌ indicators to clearly show which tests pass or fail:
```
✅ Loaded test users
✅ Created test ticket as admin
✅ Viewing ticket as Admin User
✅ Viewing ticket as Support Agent
✅ Viewing ticket as Alice (Customer)
✅ Updating ticket status as agent
✅ Listing filtered tickets as admin
✅ Deleting test ticket as admin

All tests completed!
```

For detailed response data and debugging, run the tests in debug mode:
```bash
DEBUG=true npm run test:api
```

## Features

- Role-based access control (Admin, Agent, Customer)
- Row-level security on tickets
- Permission inheritance (e.g., admins automatically get viewer access)
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

This model establishes a hierarchical permission system where:
1. Users can be admins, agents, or members of an organization
2. Tickets belong to organizations (via the parent relation)
3. Users can view tickets if they:
   - Created the ticket
   - Are assigned to the ticket
   - Are an admin of the organization the ticket belongs to
   - Are an agent of the organization the ticket belongs to
   - Are a member of the organization the ticket belongs to

The FGA setup script (`npm run setup:fga`) creates this authorization model in your WorkOS account and establishes the initial relationships between users, organizations, and tickets. This is a crucial step as it defines the "rules" that WorkOS FGA will use to determine who can access what.

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
   # WorkOS credentials (get these from https://dashboard.workos.com/get-started)
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

## Learn More

- [WorkOS FGA Documentation](https://workos.com/docs/fine-grained-authorization)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

MIT
