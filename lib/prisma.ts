import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Log all SQL queries
prisma.$on('query' as never, async (event: any) => {
  console.log('\n=== SQL Query ===');
  console.log('Query:', event.query);
  console.log('Params:', event.params);
  console.log('Duration:', event.duration + 'ms');
  console.log('================\n');
});

export default prisma; 