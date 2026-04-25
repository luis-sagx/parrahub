import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
};

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin1234!';

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" ya existe, saltando seed.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({
    data: { username, password: hashedPassword },
  });

  console.log(`Admin creado: ${admin.username} (id: ${admin.id})`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());