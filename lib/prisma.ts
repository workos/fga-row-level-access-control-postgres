import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
      { level: 'info', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Log all SQL queries
prisma.$on('query', async (event: any) => {
  console.log('\n=== SQL Query ===');
  console.log('Query:', event.query);
  console.log('Params:', event.params);
  console.log('Duration:', `${event.duration}ms`);
  console.log('================\n');
}); 