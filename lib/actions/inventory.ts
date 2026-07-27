"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const createInventorySchema = z.object({
  itemId: z.string().min(1, "Barang harus dipilih"),
  transactionDate: z.string().min(1, "Tanggal transaksi harus diisi"),
  quantity: z.number().positive("Quantity harus lebih dari 0"),
  type: z.enum(["MASUK", "KELUAR"]),
  status: z.enum(["BAIK", "RUSAK", "HILANG", "KADALUARSA"]),
}).refine((data) => {
  if (data.type === "MASUK" && data.status !== "BAIK") return false;
  if (data.type === "KELUAR" && data.status === "BAIK") return false;
  return true;
}, {
  message: "Type Masuk hanya boleh status Baik; Type Keluar tidak boleh status Baik",
  path: ["status"],
});

export type CreateInventoryFormData = z.infer<typeof createInventorySchema>;

export interface InventoryRow {
  id: string;
  itemId: string;
  itemName: string;
  itemUnit: string;
  transactionDate: string;
  quantity: number;
  type: "MASUK" | "KELUAR";
  status: "BAIK" | "RUSAK" | "HILANG" | "KADALUARSA";
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetInventoriesParams {
  page?: number;
  pageSize?: number;
  itemId: string;
  sortBy?: "transactionDate" | "quantity";
  sortOrder?: "asc" | "desc";
  filterType?: "MASUK" | "KELUAR";
  filterStatus?: "BAIK" | "RUSAK" | "HILANG" | "KADALUARSA";
  dateFrom?: string;
  dateTo?: string;
}

export interface GetInventoriesResult {
  data: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetItemsForInventoryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
}

export interface GetItemsForInventoryResult {
  data: ItemForInventoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ItemForInventoryRow {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  unit: string;
  totalStock: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ItemOption {
  id: string;
  name: string;
  unit: string;
}

const SORTABLE = ["transactionDate", "quantity", "createdAt", "updatedAt"] as const;

export async function getInventories(
  params: GetInventoriesParams,
): Promise<GetInventoriesResult> {
  const {
    page = 1,
    pageSize = 10,
    itemId,
    sortBy = "transactionDate",
    sortOrder = "desc",
    filterType,
    filterStatus,
    dateFrom,
    dateTo,
  } = params;

  const where: Record<string, unknown> = {
    itemId,
  };

  if (filterType) {
    where.type = filterType;
  }

  if (filterStatus) {
    where.status = filterStatus;
  }

  if (dateFrom || dateTo) {
    where.transactionDate = {};
    if (dateFrom) {
      (where.transactionDate as Record<string, Date>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.transactionDate as Record<string, Date>).lte = new Date(dateTo);
    }
  }

  const validSortBy = SORTABLE.includes(sortBy as (typeof SORTABLE)[number])
    ? sortBy
    : "transactionDate";
  const validSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      orderBy: { [validSortBy]: validSortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        item: { select: { id: true, name: true, stocks: { select: { unit: true }, take: 1 } } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    data: data.map(serialize),
    total,
    page,
    pageSize,
  };
}

export async function getItemsForInventory(
  params: GetItemsForInventoryParams,
): Promise<GetItemsForInventoryResult> {
  const {
    page = 1,
    pageSize = 10,
    search,
    categoryId,
  } = params;

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (search) {
    where.name = { contains: search };
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  const [data, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { name: "asc" },
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
    data: data.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      unit: item.stocks[0]?.unit || "pcs",
      totalStock: item.stocks.reduce((sum, s) => sum + s.quantity, 0),
      deletedAt: null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
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

export async function getItemOptions(): Promise<ItemOption[]> {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    include: {
      stocks: { select: { unit: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.stocks[0]?.unit || "pcs",
  }));
}

export async function getItemById(itemId: string): Promise<{ id: string; name: string; unit: string } | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      stocks: { select: { unit: true }, take: 1 },
    },
  });

  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    unit: item.stocks[0]?.unit || "pcs",
  };
}

export async function createInventory(data: CreateInventoryFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { itemId, transactionDate, quantity, type, status } = createInventorySchema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.create({
      data: {
        itemId,
        transactionDate: new Date(transactionDate),
        quantity,
        type,
        status,
        createdById: session.user.id,
      },
      include: {
        item: { select: { id: true, name: true, stocks: { select: { unit: true }, take: 1 } } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    let itemStock = await tx.itemStock.findFirst({
      where: { itemId },
    });

    if (!itemStock) {
      itemStock = await tx.itemStock.create({
        data: { itemId, unit: "pcs", quantity: 0 },
      });
    }

    const change = type === "MASUK" ? quantity : -quantity;
    await tx.itemStock.update({
      where: { id: itemStock.id },
      data: { quantity: { increment: change } },
    });

    return inventory;
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return serialize(result);
}

export async function forceDeleteInventory(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { id },
      include: { item: { include: { stocks: true } } },
    });

    if (!inventory) {
      throw new Error("Inventory not found");
    }

    const itemStock = inventory.item.stocks[0];
    if (itemStock) {
      const change = inventory.type === "MASUK" ? -inventory.quantity : inventory.quantity;
      await tx.itemStock.update({
        where: { id: itemStock.id },
        data: { quantity: { increment: change } },
      });
    }

    await tx.inventory.delete({ where: { id } });

    return { success: true as const };
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${result}`);
  return result;
}

function serialize(
  inventory: {
    id: string;
    itemId: string;
    transactionDate: Date;
    quantity: number;
    type: "MASUK" | "KELUAR";
    status: "BAIK" | "RUSAK" | "HILANG" | "KADALUARSA";
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    item: { id: string; name: string; stocks: { unit: string }[] };
    createdBy: { id: string; name: string };
  },
): InventoryRow {
  return {
    id: inventory.id,
    itemId: inventory.itemId,
    itemName: inventory.item.name,
    itemUnit: inventory.item.stocks[0]?.unit || "pcs",
    transactionDate: inventory.transactionDate.toISOString(),
    quantity: inventory.quantity,
    type: inventory.type,
    status: inventory.status,
    createdById: inventory.createdById,
    createdByName: inventory.createdBy.name,
    createdAt: inventory.createdAt.toISOString(),
    updatedAt: inventory.updatedAt.toISOString(),
  };
}