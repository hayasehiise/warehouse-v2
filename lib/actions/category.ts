"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Nama kategori harus diisi"),
  description: z.string().optional(),
});

export type FormData = z.infer<typeof formSchema>;

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetCategoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: "active" | "deleted" | "all";
}

export interface GetCategoriesResult {
  data: CategoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const SORTABLE = ["name", "createdAt", "updatedAt"] as const;

export async function getCategories(
  params: GetCategoriesParams,
): Promise<GetCategoriesResult> {
  const {
    page = 1,
    pageSize = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    filter = "active",
  } = params;

  const where: Record<string, unknown> = {};

  if (filter === "active") {
    where.deletedAt = null;
  } else if (filter === "deleted") {
    where.deletedAt = { not: null };
  }

  if (search) {
    where.name = { contains: search };
  }

  const validSortBy = SORTABLE.includes(sortBy as (typeof SORTABLE)[number])
    ? sortBy
    : "createdAt";
  const validSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { [validSortBy]: validSortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    data: data.map(serialize),
    total,
    page,
    pageSize,
  };
}

export async function createCategory(data: FormData) {
  const { name, description } = formSchema.parse(data);
  const category = await prisma.category.create({
    data: { name, description: description || null },
  });
  revalidatePath("/category");
  return serialize(category);
}

export async function updateCategory(id: string, data: FormData) {
  const { name, description } = formSchema.parse(data);
  const category = await prisma.category.update({
    where: { id },
    data: { name, description: description || null },
  });
  revalidatePath("/category");
  return serialize(category);
}

export async function softDeleteCategory(id: string) {
  const category = await prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/category");
  return serialize(category);
}

export async function forceDeleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/category");
  return { success: true as const };
}

export async function restoreCategory(id: string) {
  const category = await prisma.category.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/category");
  return serialize(category);
}

function serialize(
  cat: {
    id: string;
    name: string;
    description: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
): CategoryRow {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description,
    deletedAt: cat.deletedAt?.toISOString() ?? null,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  };
}
