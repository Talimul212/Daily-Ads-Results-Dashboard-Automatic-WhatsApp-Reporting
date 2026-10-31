import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { publicUser, requireAdmin } from "@/lib/auth/server";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/auth/password";

const badPassword = (password: unknown) =>
  password !== undefined && password !== "" && String(password).length < MIN_PASSWORD_LENGTH;

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const specialists = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { clients: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      specialists: specialists.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        hasPassword: Boolean(s.passwordHash),
        clientCount: s._count.clients,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch specialists" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { name, email, role, password } = body;

    if (badPassword(password)) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Specialist name and email are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: `A specialist with email ${email} already exists.` },
        { status: 400 }
      );
    }

    const newSpecialist = await prisma.user.create({
      data: {
        name,
        email,
        role: role || "SPECIALIST",
        ...(password ? { passwordHash: hashPassword(String(password)) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      specialist: publicUser(newSpecialist),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create specialist" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, name, email, role, password } = body;

    if (badPassword(password)) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (!id || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id, name, email" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role: role || "SPECIALIST",
        // Blank password = keep the current one
        ...(password ? { passwordHash: hashPassword(String(password)) } : {}),
      },
    });

    // Also update cached specialistName on assigned clients
    await prisma.client.updateMany({
      where: { specialistId: id },
      data: { specialistName: name },
    });

    return NextResponse.json({
      success: true,
      specialist: publicUser(updatedUser),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update specialist" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const reassignToId = searchParams.get("reassignToId");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing specialist ID" },
        { status: 400 }
      );
    }

    // Reassign clients if requested, or set to Unassigned
    let reassignName = "Unassigned";
    if (reassignToId) {
      const targetUser = await prisma.user.findUnique({ where: { id: reassignToId } });
      if (targetUser) {
        reassignName = targetUser.name;
      }
    }

    await prisma.client.updateMany({
      where: { specialistId: id },
      data: {
        specialistId: reassignToId || null,
        specialistName: reassignToId ? reassignName : "Unassigned",
      },
    });

    // Delete the specialist user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Specialist removed and clients reassigned successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete specialist" },
      { status: 500 }
    );
  }
}
