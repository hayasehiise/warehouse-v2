"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const createDistributionSchema = z.object({
  transactionDate: z.string().min(1, "Tanggal transaksi harus diisi"),
  recipientName: z.string().min(1, "Nama penerima harus diisi"),
  note: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().min(1, "Barang harus dipilih"),
      quantity: z.number().positive("Quantity harus lebih dari 0"),
    })
  ).min(1, "Minimal 1 item harus ditambahkan"),
}).refine((data) => {
  const itemIds = data.items.map((item) => item.itemId);
  return new Set(itemIds).size === itemIds.length;
}, {
  message: "Item tidak boleh sama",
  path: ["items"],
});

export type CreateDistributionFormData = z.infer<typeof createDistributionSchema>;

const updateDistributionSchema = z.object({
  transactionDate: z.string().min(1, "Tanggal transaksi harus diisi"),
  recipientName: z.string().min(1, "Nama penerima harus diisi"),
  note: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().min(1, "Barang harus dipilih"),
      quantity: z.number().positive("Quantity harus lebih dari 0"),
    })
  ).min(1, "Minimal 1 item harus ditambahkan"),
}).refine((data) => {
  const itemIds = data.items.map((item) => item.itemId);
  return new Set(itemIds).size === itemIds.length;
}, {
  message: "Item tidak boleh sama",
  path: ["items"],
});

export type UpdateDistributionFormData = z.infer<typeof updateDistributionSchema>;

export interface DistributionRow {
  id: string;
  transactionCode: string;
  transactionDate: string;
  recipientName: string;
  note: string | null;
  approvedStatus: "PENDING" | "APPROVED" | "REJECTED";
  createdById: string;
  createdByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DistributionItemRow {
  id: string;
  itemId: string;
  itemName: string;
  itemUnit: string;
  quantity: number;
  currentStock: number;
}

export interface DistributionDetailRow extends DistributionRow {
  items: DistributionItemRow[];
}

export interface GetDistributionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "transactionDate" | "createdAt" | "approvedStatus";
  sortOrder?: "asc" | "desc";
  filterStatus?: "PENDING" | "APPROVED" | "REJECTED";
  filter?: "active" | "deleted" | "all";
  dateFrom?: string;
  dateTo?: string;
}

export interface GetDistributionsResult {
  data: DistributionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetItemsForDistributionParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
}

export interface GetItemsForDistributionResult {
  data: ItemForDistributionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ItemForDistributionRow {
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

const SORTABLE = ["transactionDate", "createdAt", "approvedStatus"] as const;

export async function getDistributions(
  params: GetDistributionsParams,
): Promise<GetDistributionsResult> {
  const {
    page = 1,
    pageSize = 10,
    search,
    sortBy = "transactionDate",
    sortOrder = "desc",
    filterStatus,
    filter = "active",
    dateFrom,
    dateTo,
  } = params;

  const where: Record<string, unknown> = {};

  if (filter === "active") {
    where.deletedAt = null;
  } else if (filter === "deleted") {
    where.deletedAt = { not: null };
  }

  if (search) {
    where.OR = [
      { transactionCode: { contains: search } },
      { recipientName: { contains: search } },
    ];
  }

  if (filterStatus) {
    where.approvedStatus = filterStatus;
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
    prisma.distribution.findMany({
      where,
      orderBy: { [validSortBy]: validSortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.distribution.count({ where }),
  ]);

  return {
    data: data.map(serialize),
    total,
    page,
    pageSize,
  };
}

export async function getDistributionById(id: string): Promise<DistributionDetailRow | null> {
  const distribution = await prisma.distribution.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: {
        include: {
          item: {
            include: {
              stocks: { select: { id: true, unit: true, quantity: true } },
            },
          },
        },
      },
    },
  });

  if (!distribution) return null;

  return serializeDetail(distribution);
}

export async function getItemsForDistribution(
  params: GetItemsForDistributionParams,
): Promise<GetItemsForDistributionResult> {
  const {
    page = 1,
    pageSize = 10,
    search,
    categoryId,
  } = params;

  const where: Record<string, unknown> = {
    deletedAt: null,
    stocks: { some: { quantity: { gt: 0 } } },
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

export interface ItemOptionWithStock {
  id: string;
  name: string;
  unit: string;
  totalStock: number;
}

export async function getItemOptionsForDistribution(): Promise<ItemOptionWithStock[]> {
  const items = await prisma.item.findMany({
    where: { deletedAt: null, stocks: { some: { quantity: { gt: 0 } } } },
    include: { stocks: { select: { unit: true, quantity: true } } },
    orderBy: { name: "asc" },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.stocks[0]?.unit || "pcs",
    totalStock: item.stocks.reduce((sum, s) => sum + s.quantity, 0),
  }));
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTransactionCode(tx: any) {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
  const prefix = `DIST-${dateStr}-`;

  const lastDistribution = await tx.distribution.findFirst({
    where: {
      transactionCode: { startsWith: prefix },
    },
    orderBy: { transactionCode: "desc" },
    select: { transactionCode: true },
  });

  let sequence = 1;
  if (lastDistribution) {
    const lastSequence = parseInt(lastDistribution.transactionCode.split("-")[2], 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

export async function createDistribution(data: CreateDistributionFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { transactionDate, recipientName, note, items } = createDistributionSchema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    const transactionCode = await generateTransactionCode(tx);

    for (const item of items) {
      const itemStock = await tx.itemStock.findFirst({
        where: { itemId: item.itemId },
        include: { item: { select: { name: true } } },
      });

      if (!itemStock) {
        throw new Error(`Stok untuk item tidak ditemukan`);
      }

      if (itemStock.quantity < item.quantity) {
        throw new Error(`Stok tidak mencukupi untuk ${itemStock.item.name}. Stok tersedia: ${itemStock.quantity}, dibutuhkan: ${item.quantity}`);
      }
    }

    const distribution = await tx.distribution.create({
      data: {
        transactionCode,
        transactionDate: new Date(transactionDate),
        recipientName,
        note: note || null,
        createdById: session.user.id,
        items: {
          create: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              include: {
                stocks: { select: { id: true, unit: true, quantity: true } },
              },
            },
          },
        },
      },
    });

    return distribution;
  });

  revalidatePath("/distribution");
  revalidatePath("/item");
  revalidatePath("/inventory");
  return serializeDetail(result);
}

export async function updateDistribution(id: string, data: UpdateDistributionFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { transactionDate, recipientName, note, items } = updateDistributionSchema.parse(data);

  const existingDistribution = await prisma.distribution.findUnique({
    where: { id },
    include: {
      items: { include: { item: { include: { stocks: true } } } },
    },
  });

  if (!existingDistribution) {
    throw new Error("Distribution not found");
  }

  if (existingDistribution.approvedStatus !== "PENDING") {
    throw new Error("Hanya distribution dengan status PENDING yang bisa diupdate");
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const itemStock = await tx.itemStock.findFirst({
        where: { itemId: item.itemId },
        include: { item: { select: { name: true } } },
      });

      if (!itemStock) {
        throw new Error(`Stok untuk item tidak ditemukan`);
      }

      if (itemStock.quantity < item.quantity) {
        throw new Error(`Stok tidak mencukupi untuk ${itemStock.item.name}. Stok tersedia: ${itemStock.quantity}, dibutuhkan: ${item.quantity}`);
      }
    }

    await tx.distributionItem.deleteMany({
      where: { distributionId: id },
    });

    const distribution = await tx.distribution.update({
      where: { id },
      data: {
        transactionDate: new Date(transactionDate),
        recipientName,
        note: note || null,
        items: {
          create: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              include: {
                stocks: { select: { id: true, unit: true, quantity: true } },
              },
            },
          },
        },
      },
    });

    return distribution;
  });

  revalidatePath("/distribution");
  revalidatePath(`/distribution/${id}`);
  revalidatePath("/item");
  revalidatePath("/inventory");
  return serializeDetail(result);
}

export async function approveDistribution(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "supervisor"].includes(user.role || "")) {
    throw new Error("Hanya admin dan supervisor yang bisa approve");
  }

  const distribution = await prisma.distribution.findUnique({
    where: { id },
    include: {
      items: { include: { item: { include: { stocks: true } } } },
    },
  });

  if (!distribution) {
    throw new Error("Distribution not found");
  }

  if (distribution.approvedStatus !== "PENDING") {
    throw new Error("Hanya distribution dengan status PENDING yang bisa diapprove");
  }

  // Validate stock again at approval time
  for (const item of distribution.items) {
    const itemStock = await prisma.itemStock.findFirst({
      where: { itemId: item.itemId },
      include: { item: { select: { name: true } } },
    });

    if (!itemStock) {
      throw new Error(`Stok untuk item tidak ditemukan`);
    }

    if (itemStock.quantity < item.quantity) {
      throw new Error(`Stok tidak mencukupi untuk ${itemStock.item.name}. Stok tersedia: ${itemStock.quantity}, dibutuhkan: ${item.quantity}`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Decrement stock for each item
    for (const item of distribution.items) {
      await tx.itemStock.update({
        where: { id: (await tx.itemStock.findFirst({ where: { itemId: item.itemId } }))!.id },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    // Update distribution status to APPROVED
    const updatedDistribution = await tx.distribution.update({
      where: { id },
      data: {
        approvedStatus: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    return updatedDistribution;
  });

  revalidatePath("/distribution");
  revalidatePath(`/distribution/${id}`);
  revalidatePath("/item");
  revalidatePath("/inventory");
  return serialize(result);
}

export async function rejectDistribution(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "supervisor"].includes(user.role || "")) {
    throw new Error("Hanya admin dan supervisor yang bisa reject");
  }

  const distribution = await prisma.distribution.findUnique({
    where: { id },
  });

  if (!distribution) {
    throw new Error("Distribution not found");
  }

  if (distribution.approvedStatus !== "PENDING") {
    throw new Error("Hanya distribution dengan status PENDING yang bisa direject");
  }

  // No stock changes needed - stock was only reserved, not deducted on create
  const result = await prisma.distribution.update({
    where: { id },
    data: {
      approvedStatus: "REJECTED",
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  revalidatePath("/distribution");
  revalidatePath(`/distribution/${id}`);
  revalidatePath("/item");
  revalidatePath("/inventory");
  return serialize(result);
}

export async function softDeleteDistribution(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const distribution = await prisma.distribution.findUnique({
    where: { id },
  });

  if (!distribution) {
    throw new Error("Distribution not found");
  }

  // Allow delete for all statuses including APPROVED
  // No stock restoration - stock was already deducted at approve
  const result = await prisma.distribution.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: {
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  revalidatePath("/distribution");
  return serialize(result);
}

export async function forceDeleteDistribution(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "supervisor"].includes(user.role || "")) {
    throw new Error("Hanya admin dan supervisor yang bisa force delete");
  }

  const distribution = await prisma.distribution.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!distribution) {
    throw new Error("Distribution not found");
  }

  // Allow force delete for all statuses including APPROVED
  await prisma.$transaction(async (tx) => {
    // If APPROVED, restore stock since it was deducted at approve
    if (distribution.approvedStatus === "APPROVED") {
      for (const item of distribution.items) {
        const itemStock = await tx.itemStock.findFirst({
          where: { itemId: item.itemId },
        });
        if (itemStock) {
          await tx.itemStock.update({
            where: { id: itemStock.id },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
    }
    // PENDING and REJECTED never had stock deducted, no restoration needed

    await tx.distributionItem.deleteMany({
      where: { distributionId: id },
    });

    await tx.distribution.delete({ where: { id } });
  });

  revalidatePath("/distribution");
  revalidatePath("/item");
  revalidatePath("/inventory");
  return { success: true as const };
}

export async function restoreDistribution(id: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const distribution = await prisma.distribution.findUnique({
    where: { id },
  });

  if (!distribution) {
    throw new Error("Distribution not found");
  }

  const result = await prisma.distribution.update({
    where: { id },
    data: { deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  revalidatePath("/distribution");
  return serialize(result);
}

function serialize(
  distribution: {
    id: string;
    transactionCode: string;
    transactionDate: Date;
    recipientName: string;
    note: string | null;
    approvedStatus: "PENDING" | "APPROVED" | "REJECTED";
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: { id: string; name: string };
    approvedBy: { id: string; name: string } | null;
    approvedAt: Date | null;
  },
): DistributionRow {
  return {
    id: distribution.id,
    transactionCode: distribution.transactionCode,
    transactionDate: distribution.transactionDate.toISOString(),
    recipientName: distribution.recipientName,
    note: distribution.note,
    approvedStatus: distribution.approvedStatus,
    createdById: distribution.createdById,
    createdByName: distribution.createdBy.name,
    approvedById: distribution.approvedBy?.id ?? null,
    approvedByName: distribution.approvedBy?.name ?? null,
    approvedAt: distribution.approvedAt?.toISOString() ?? null,
    createdAt: distribution.createdAt.toISOString(),
    updatedAt: distribution.updatedAt.toISOString(),
    deletedAt: distribution.deletedAt?.toISOString() ?? null,
  };
}

function serializeDetail(
  distribution: {
    id: string;
    transactionCode: string;
    transactionDate: Date;
    recipientName: string;
    note: string | null;
    approvedStatus: "PENDING" | "APPROVED" | "REJECTED";
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: { id: string; name: string };
    approvedBy: { id: string; name: string } | null;
    approvedAt: Date | null;
    items: {
      id: string;
      itemId: string;
      quantity: number;
      item: {
        id: string;
        name: string;
        stocks: { id: string; unit: string; quantity: number }[];
      };
    }[];
  },
): DistributionDetailRow {
  return {
    id: distribution.id,
    transactionCode: distribution.transactionCode,
    transactionDate: distribution.transactionDate.toISOString(),
    recipientName: distribution.recipientName,
    note: distribution.note,
    approvedStatus: distribution.approvedStatus,
    createdById: distribution.createdById,
    createdByName: distribution.createdBy.name,
    approvedById: distribution.approvedBy?.id ?? null,
    approvedByName: distribution.approvedBy?.name ?? null,
    approvedAt: distribution.approvedAt?.toISOString() ?? null,
    createdAt: distribution.createdAt.toISOString(),
    updatedAt: distribution.updatedAt.toISOString(),
    deletedAt: distribution.deletedAt?.toISOString() ?? null,
    items: distribution.items.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      itemName: item.item.name,
      itemUnit: item.item.stocks[0]?.unit || "pcs",
      quantity: item.quantity,
      currentStock: item.item.stocks.reduce((sum, s) => sum + s.quantity, 0),
    })),
  };
}