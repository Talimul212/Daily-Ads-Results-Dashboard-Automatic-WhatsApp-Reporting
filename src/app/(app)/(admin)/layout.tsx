import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

// Settings and the raw Campaign Reports tool are admin-only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/");
  return <>{children}</>;
}
