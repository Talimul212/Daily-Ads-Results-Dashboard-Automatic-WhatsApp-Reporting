import "dotenv/config";
import prisma from "../src/lib/prisma";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../src/lib/auth/password";

// Set (or reset) a user's login password.
// Usage: npm run user:password -- admin@digitalresolution.com "a-strong-password"
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Usage: npm run user:password -- <email> "<password>"');
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.log(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    console.log(`No user with email ${email}. Existing users:`);
    for (const u of await prisma.user.findMany()) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
    process.exit(1);
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
  console.log(`Password set for ${user.name} (${user.role}).`);
}

main().finally(() => prisma.$disconnect());
