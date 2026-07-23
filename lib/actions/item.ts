"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Nama barang harus diisi"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Kategori harus dipilih"),
  unit: z.string().min(1, "Unit harus diisi"),
});

export type FormData = z.infer<typeof formSchema>;

export interface ItemRow {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stocks: { id: string; unit: string; quantity: number }[];
}

export interface GetItemsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: "active" | "deleted" | "all";
  categoryId?: string;
  unit?: string;
}

export interface GetItemsResult {
  data: ItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryOption {
  id: string;
  name: string;
}

const SORTABLE = ["name", "createdAt", "updatedAt"] as const;

export async function getItems(
  params: GetItemsParams,
): Promise<GetItemsResult> {
  const {
    page = 1,
    pageSize = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    filter = "active",
    categoryId,
    unit,
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

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (unit) {
    where.stocks = { some: { unit } };
  }

  const validSortBy = SORTABLE.includes(sortBy as (typeof SORTABLE)[number])
    ? sortBy
    : "createdAt";
  const validSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const [data, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { [validSortBy]: validSortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { name: true } },
        stocks: { select: { id: true, unit: true, quantity: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  return {
    data: data.map(serialize),
    total,
    page,
    pageSize,
  };
}

export async function getCategoriesOptions(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return categories;
}

export async function getItemUnits(): Promise<string[]> {
  const result = await prisma.itemStock.findMany({
    where: { item: { deletedAt: null } },
    select: { unit: true },
    distinct: ["unit"],
    orderBy: { unit: "asc" },
  });
  return result.map((r) => r.unit);
}

export async function createItem(data: FormData) {
  const { name, description, categoryId, unit } = formSchema.parse(data);
  const item = await prisma.item.create({
    data: {
      name,
      description: description || null,
      categoryId,
      stocks: {
        create: { unit, quantity: 0 },
      },
    },
    include: {
      category: { select: { name: true } },
      stocks: { select: { id: true, unit: true, quantity: true } },
    },
  });
  revalidatePath("/item");
  return serialize(item);
}

export async function updateItem(id: string, data: FormData) {
  const { name, description, categoryId, unit } = formSchema.parse(data);
  const item = await prisma.item.update({
    where: { id },
    data: {
      name,
      description: description || null,
      categoryId,
      stocks: {
        deleteMany: {},
        create: { unit, quantity: 0 },
      },
    },
    include: {
      category: { select: { name: true } },
      stocks: { select: { id: true, unit: true, quantity: true } },
    },
  });
  revalidatePath("/item");
  return serialize(item);
}

export async function softDeleteItem(id: string) {
  const item = await prisma.item.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: {
      category: { select: { name: true } },
      stocks: { select: { id: true, unit: true, quantity: true } },
    },
  });
  revalidatePath("/item");
  return serialize(item);
}

export async function forceDeleteItem(id: string) {
  await prisma.item.delete({ where: { id } });
  revalidatePath("/item");
  return { success: true as const };
}

export async function restoreItem(id: string) {
  const item = await prisma.item.update({
    where: { id },
    data: { deletedAt: null },
    include: {
      category: { select: { name: true } },
      stocks: { select: { id: true, unit: true, quantity: true } },
    },
  });
  revalidatePath("/item");
  return serialize(item);
}

function serialize(
  item: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category: { name: string };
    stocks: { id: string; unit: string; quantity: number }[];
  },
): ItemRow {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    deletedAt: item.deletedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    stocks: item.stocks,
  };
}
