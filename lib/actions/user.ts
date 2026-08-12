"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMPLOYEE_GROUPS, EMPLOYEE_RANKS } from "@/lib/user-options";

const employeeCode = z
  .string()
  .regex(/^\d{8} \d{6} \d \d{3}$/, "NIP harus berformat 11111111 222222 3 444");

const profileSchema = z.object({
  employee_code: employeeCode,
  employee_rank: z.enum(EMPLOYEE_RANKS),
  employee_position: z.string().min(1, "Jabatan harus diisi"),
  employee_group: z.enum(EMPLOYEE_GROUPS),
});

const baseUserSchema = z.object({
  name: z.string().min(1, "Nama harus diisi"),
  email: z.email("Email tidak valid"),
  username: z.string().min(3, "Username minimal 3 karakter"),
  role: z.enum(["admin", "supervisor", "staff"]),
  ...profileSchema.shape,
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8, "Password minimal 8 karakter"),
});

const updateUserSchema = baseUserSchema.extend({
  password: z.string().min(8, "Password minimal 8 karakter").optional().or(z.literal("")),
});

const banSchema = z.object({
  banReason: z.string().min(1, "Alasan ban harus diisi"),
  banExpiresIn: z.number().int().positive().optional(),
});

export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type BanUserData = z.infer<typeof banSchema>;

export interface UserRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  role: "admin" | "supervisor" | "staff";
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  employee_code: string | null;
  employee_rank: string | null;
  employee_position: string | null;
  employee_group: string | null;
  createdAt: string;
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: "active" | "banned" | "all";
}

export interface GetUsersResult {
  data: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Anda tidak memiliki akses untuk mengelola pengguna");
  }
}

export async function getUsers(params: GetUsersParams): Promise<GetUsersResult> {
  await requireAdmin();
  const { page = 1, pageSize = 10, search, filter = "active" } = params;
  const where: Record<string, unknown> = {};

  if (filter === "active") where.banned = false;
  if (filter === "banned") where.banned = true;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { username: { contains: search } },
      { profile: { employee_code: { contains: search } } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users.map(serializeUser), total, page, pageSize };
}

export async function createUser(data: CreateUserData) {
  const values = createUserSchema.parse(data);
  await requireAdmin();
  const { user } = await callAuth<{ user: { id: string } }>(auth.api.createUser, {
    name: values.name,
    email: values.email,
    password: values.password,
    role: values.role,
    data: { username: values.username, displayUsername: values.name },
  });

  await prisma.profile.create({ data: { userId: user.id, ...profileData(values) } });
  revalidatePath("/users");
}

export async function updateUser(id: string, data: UpdateUserData) {
  const values = updateUserSchema.parse(data);
  await requireAdmin();
  await callAuth(auth.api.adminUpdateUser, {
    userId: id,
    data: {
      name: values.name,
      email: values.email,
      username: values.username,
      displayUsername: values.name,
    },
  });
  await callAuth(auth.api.setRole, { userId: id, role: values.role });
  if (values.password) {
    await callAuth(auth.api.setUserPassword, { userId: id, newPassword: values.password });
  }
  await prisma.profile.upsert({
    where: { userId: id },
    create: { userId: id, ...profileData(values) },
    update: profileData(values),
  });
  revalidatePath("/users");
}

export async function banUser(id: string, data: BanUserData) {
  const values = banSchema.parse(data);
  await requireAdmin();
  await callAuth(auth.api.banUser, { userId: id, ...values });
  revalidatePath("/users");
}

export async function unbanUser(id: string) {
  await requireAdmin();
  await callAuth(auth.api.unbanUser, { userId: id });
  revalidatePath("/users");
}

async function callAuth<T>(endpoint: unknown, body: unknown): Promise<T> {
  return (endpoint as (context: { body: unknown; headers: Headers }) => Promise<T>)({
    body,
    headers: await headers(),
  });
}

function profileData(data: z.infer<typeof profileSchema>) {
  return {
    employee_code: data.employee_code,
    employee_rank: data.employee_rank,
    employee_position: data.employee_position,
    employee_group: data.employee_group,
  };
}

function serializeUser(user: {
  id: string; name: string; email: string; username: string | null; displayUsername: string | null;
  role: string | null; banned: boolean | null; banReason: string | null; banExpires: Date | null; createdAt: Date;
  profile: { employee_code: string | null; employee_rank: string | null; employee_position: string | null; employee_group: string | null } | null;
}): UserRow {
  const role = user.role === "admin" || user.role === "supervisor" || user.role === "staff" ? user.role : "staff";
  return { id: user.id, name: user.name, email: user.email, username: user.username, displayUsername: user.displayUsername, role, banned: user.banned ?? false, banReason: user.banReason, banExpires: user.banExpires?.toISOString() ?? null, employee_code: user.profile?.employee_code ?? null, employee_rank: user.profile?.employee_rank ?? null, employee_position: user.profile?.employee_position ?? null, employee_group: user.profile?.employee_group ?? null, createdAt: user.createdAt.toISOString() };
}
