import { PrismaClient } from '@prisma/client';

// single shared instance across the app
export const prisma = new PrismaClient();
