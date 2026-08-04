"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar,
  MoreHorizontal,
  Trash2,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Edit,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

import {
  getDistributions,
  createDistribution,
  updateDistribution,
  softDeleteDistribution,
  forceDeleteDistribution,
  restoreDistribution,
  approveDistribution,
  rejectDistribution,
  getItemOptionsForDistribution,
  getDistributionById,
  type DistributionRow,
  type GetDistributionsParams,
  type CreateDistributionFormData,
  type ItemOptionWithStock,
} from "@/lib/actions/distribution";

import { getCategoriesOptions } from "@/lib/actions/item";

const formSchema = z.object({
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

type FilterTab = "active" | "deleted";
type FilterStatus = "all" | "PENDING" | "APPROVED" | "REJECTED";

const statusLabels: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "Pending",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const statusColors: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function DistributionClient() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("active");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "transactionDate", desc: true },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<CreateDistributionFormData | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DistributionRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [approveTarget, setApproveTarget] = useState<DistributionRow | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DistributionRow | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: search || undefined,
      filter: filter,
      filterStatus: filterStatus === "all" ? undefined : filterStatus,
      dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
      dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
      sortBy: (sorting[0]?.id === "createdAt" ? "createdAt" : "transactionDate") as "createdAt" | "transactionDate" | "approvedStatus",
      sortOrder: (sorting[0]?.desc ? "desc" : "asc") as "asc" | "desc",
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      search,
      filter,
      filterStatus,
      dateFrom,
      dateTo,
      sorting,
    ],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["distributions", queryParams],
    queryFn: () => getDistributions(queryParams),
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "options"],
    queryFn: () => getCategoriesOptions(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items", "for-distribution"],
    queryFn: () => getItemOptionsForDistribution(),
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateDistributionFormData) => {
      return createDistribution(values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDialogOpen(false);
      setEditingId(null);
      setEditingData(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CreateDistributionFormData }) => {
      return updateDistribution(id, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDialogOpen(false);
      setEditingId(null);
      setEditingData(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (filter === "deleted") {
        return forceDeleteDistribution(deleteTarget.id);
      }
      return softDeleteDistribution(deleteTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDistribution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approveTarget) return;
      return approveDistribution(approveTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsApproveOpen(false);
      setApproveTarget(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      return rejectDistribution(rejectTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsRejectOpen(false);
      setRejectTarget(null);
    },
  });

  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditingData(null);
    setIsDialogOpen(true);
  }, []);

  const openEdit = useCallback(
    async (distribution: DistributionRow) => {
      const fullDistribution = await getDistributionById(distribution.id);
      if (fullDistribution) {
        setEditingId(fullDistribution.id);
        setEditingData({
          transactionDate: format(new Date(fullDistribution.transactionDate), "yyyy-MM-dd"),
          recipientName: fullDistribution.recipientName,
          note: fullDistribution.note ?? "",
          items: fullDistribution.items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        });
        setIsDialogOpen(true);
      }
    },
    [],
  );

  const handleSave = useCallback(
    (values: CreateDistributionFormData) => {
      if (editingId) {
        updateMutation.mutate({ id: editingId, values });
      } else {
        createMutation.mutate(values);
      }
    },
    [editingId, createMutation, updateMutation],
  );

  const handleDelete = useCallback(() => {
    deleteMutation.mutate();
  }, [deleteMutation]);

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate(id);
    },
    [restoreMutation],
  );

  const handleApprove = useCallback(() => {
    approveMutation.mutate();
  }, [approveMutation]);

  const handleReject = useCallback(() => {
    rejectMutation.mutate();
  }, [rejectMutation]);

  const columns = useMemo<ColumnDef<DistributionRow>[]>(
    () => [
      {
        accessorKey: "transactionCode",
        header: "Kode Transaksi",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "transactionDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-auto p-0 font-medium hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <div className="flex items-center gap-1">
              Tanggal Transaksi
              {column.getIsSorted() ? (
                column.getIsSorted() === "asc" ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )
              ) : (
                <span className="text-muted-foreground">⇅</span>
              )}
            </div>
          </Button>
        ),
        cell: ({ getValue }) => {
          const date = new Date(getValue() as string);
          return format(date, "dd MMM yyyy", { locale: id });
        },
      },
      {
        accessorKey: "recipientName",
        header: "Penerima",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "approvedStatus",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as "PENDING" | "APPROVED" | "REJECTED";
          return (
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdByName",
        header: "Dibuat Oleh",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const distribution = row.original;
          const isDeleted = filter === "deleted";
          const isPending = distribution.approvedStatus === "PENDING";
          const isRejected = distribution.approvedStatus === "REJECTED";

          if (isDeleted) {
            return (
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRestore(distribution.id)}>
                      <RotateCcw className="size-4" />
                      Pulihkan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <XCircle className="size-4" />
                      Hapus Permanen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(distribution)} disabled={!isPending}>
                    <Edit className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = `/distribution/${distribution.id}`}>
                    <Eye className="size-4" />
                    Detail
                  </DropdownMenuItem>
                  {isPending && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => {
                        setApproveTarget(distribution);
                        setIsApproveOpen(true);
                      }}>
                        <CheckCircle2 className="size-4" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setRejectTarget(distribution);
                        setIsRejectOpen(true);
                      }}>
                        <XCircle className="size-4" />
                        Reject
                      </DropdownMenuItem>
                    </>
                  )}
                  {isRejected && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setDeleteTarget(distribution);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Hapus
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [filter, openEdit, handleRestore, setDeleteTarget, setIsDeleteOpen, setApproveTarget, setIsApproveOpen, setRejectTarget, setIsRejectOpen],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    pageCount: data ? Math.ceil(data.total / data.pageSize) : -1,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pengambilan</h1>
          <p className="text-sm text-muted-foreground">
            Kelola data pengambilan barang
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={createMutation.isPending || updateMutation.isPending}>
          <Plus className="size-4" />
          Tambah Pengambilan
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Filter & Pencarian</CardTitle>
          <CardDescription>
            Filter pengambilan berdasarkan status approval, rentang tanggal, dan pencarian
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari kode transaksi atau penerima..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v as FilterStatus);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Disetujui</SelectItem>
                  <SelectItem value="REJECTED">Ditolak</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 rounded-3xl bg-muted p-1">
                <Button
                  variant={filter === "active" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setFilter("active");
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="rounded-2xl"
                >
                  Aktif
                </Button>
                <Button
                  variant={filter === "deleted" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setFilter("deleted");
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="rounded-2xl"
                >
                  Terhapus
                </Button>
              </div>
            </div>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="gap-2">
                    <Calendar className="size-4" />
                    <span>Rentang Tanggal</span>
                    <ChevronDown className="size-4" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4 min-w-[480px]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Dari</Label>
                      <CalendarUI
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        locale={id}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Sampai</Label>
                      <CalendarUI
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        locale={id}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateFrom(undefined);
                        setDateTo(undefined);
                        setPagination((p) => ({ ...p, pageIndex: 0 }));
                      }}
                    >
                      Hapus Filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPagination((p) => ({ ...p, pageIndex: 0 }));
                      }}
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? "Pengambilan tidak ditemukan" : filter === "deleted" ? "Tidak ada pengambilan yang terhapus" : "Belum ada pengambilan"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-border">
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors hover:bg-muted/50 last:border-0"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-4 text-sm">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <p className="text-sm text-muted-foreground">
                Menampilkan {data.page * data.pageSize - data.pageSize + 1}-
                {Math.min(data.page * data.pageSize, data.total)} dari{" "}
                {data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  {pagination.pageIndex + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(v) => {
                    setPagination({ pageIndex: 0, pageSize: Number(v) });
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DistributionFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingId={editingId}
        initialData={editingData}
        onSave={handleSave}
        isPending={createMutation.isPending || updateMutation.isPending}
        items={items}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {filter === "deleted"
                ? "Hapus Permanen Pengambilan"
                : "Hapus Pengambilan"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {filter === "deleted" ? (
                <>
                  Apakah Anda yakin ingin menghapus permanen{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.transactionCode}
                  </span>
                  ? Tindakan ini tidak dapat dibatalkan.
                </>
              ) : (
                <>
                  Pengambilan{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.transactionCode}
                  </span>{" "}
                  akan dipindahkan ke tempat sampah. Anda masih bisa
                  memulihkannya nanti.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant={filter === "deleted" ? "destructive" : "default"}
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? "Menghapus..."
                : filter === "deleted"
                  ? "Hapus Permanen"
                  : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Pengambilan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyetujui pengambilan
              <span className="font-medium text-foreground">
                {approveTarget?.transactionCode}
              </span>
              ? Stok barang akan dikurangi secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? "Menyetujui..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Pengambilan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menolak pengambilan
              <span className="font-medium text-foreground">
                {rejectTarget?.transactionCode}
              </span>
              ? Stok barang yang sudah dikurangi akan dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Menolak..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DistributionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  initialData: CreateDistributionFormData | null;
  onSave: (values: CreateDistributionFormData) => void;
  isPending: boolean;
  items: ItemOptionWithStock[];
}

function DistributionFormDialog({
  isOpen,
  onClose,
  editingId,
  initialData,
  onSave,
  isPending,
  items,
}: DistributionFormDialogProps) {
  const form = useForm<CreateDistributionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      recipientName: "",
      note: "",
      items: [{ itemId: "", quantity: 1 }],
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        transactionDate: format(new Date(), "yyyy-MM-dd"),
        recipientName: "",
        note: "",
        items: [{ itemId: "", quantity: 1 }],
      });
    }
  }, [isOpen, form]);

  useEffect(() => {
    if (editingId && initialData) {
      form.reset({
        ...initialData,
        items: initialData.items.length > 0 ? initialData.items : [{ itemId: "", quantity: 1 }],
      });
    }
  }, [editingId, initialData, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Pengambilan" : "Tambah Pengambilan"}
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Ubah detail pengambilan"
              : "Buat data pengambilan baru"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSave)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transactionDate">Tanggal Transaksi</Label>
              <Popover>
                <PopoverTrigger
                  nativeButton={false}
                  render={
                    <Input
                      id="transactionDate"
                      readOnly
                      {...form.register("transactionDate")}
                      placeholder="Pilih tanggal"
                    />
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={form.watch("transactionDate") ? new Date(form.watch("transactionDate")!) : new Date()}
                    onSelect={(date) =>
                      date &&
                      form.setValue("transactionDate", format(date, "yyyy-MM-dd"))
                    }
                    locale={id}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.transactionDate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.transactionDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipientName">Nama Penerima</Label>
              <Input
                id="recipientName"
                {...form.register("recipientName")}
                placeholder="Nama penerima"
                aria-invalid={!!form.formState.errors.recipientName}
              />
              {form.formState.errors.recipientName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recipientName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Catatan</Label>
              <Input
                id="note"
                {...form.register("note")}
                placeholder="Catatan (opsional)"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Daftar Item</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const items = form.getValues("items");
                    form.setValue("items", [...items, { itemId: "", quantity: 1 }]);
                  }}
                >
                  <Plus className="size-4" />
                  Tambah Item
                </Button>
              </div>
              {form.formState.errors.items && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.items.message}
                </p>
              )}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Barang</TableHead>
                      <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">Unit</TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-32">Quantity</TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-12">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.watch("items").map((item, index) => (
                      <DistributionItemRow
                        key={index}
                        index={index}
                        form={form}
                        items={items}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Batal
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DistributionItemRowProps {
  index: number;
  form: ReturnType<typeof useForm<CreateDistributionFormData>>;
  items: ItemOptionWithStock[];
}

function DistributionItemRow({
  index,
  form,
  items: itemOptions,
}: DistributionItemRowProps) {
  const { control, watch, setValue, register } = form;
  const items = watch("items");
  const currentItem = items[index];

  const handleItemChange = (itemId: string) => {
    const selectedItem = itemOptions.find((i) => i.id === itemId);
    setValue(`items.${index}.itemId`, itemId);
    setValue(`items.${index}.quantity`, 1);
  };

  const handleRemove = () => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setValue("items", newItems);
  };

  const duplicateError = watch("items").filter((item, i) => i !== index && item.itemId === currentItem.itemId).length > 0;
  const selectedItem = itemOptions.find((i) => i.id === currentItem.itemId);

  return (
    <TableRow className="border-b border-border last:border-0 hover:bg-muted/50">
      <TableCell className="px-4 py-3">
        <Select
          value={currentItem.itemId}
          onValueChange={(v) => v && handleItemChange(v)}
        >
          <SelectTrigger className="w-full min-w-[280px]" aria-invalid={!!currentItem.itemId && duplicateError}>
            <SelectValue placeholder="Pilih barang">
              {selectedItem ? `${selectedItem.name} (${selectedItem.unit})` : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {itemOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <div className="flex items-center justify-between w-full min-w-[300px]">
                  <span>{item.name} ({item.unit})</span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    Stok: {item.totalStock}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(currentItem.itemId && duplicateError) && (
          <p className="text-xs text-destructive mt-1">Item tidak boleh sama</p>
        )}
        {form.formState.errors.items && (
          <p className="text-xs text-destructive mt-1">
            {form.formState.errors.items.message}
          </p>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 w-24">
        {selectedItem && (
          <Badge variant="outline" className="w-full justify-center">
            {selectedItem.unit}
          </Badge>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 w-32">
        <Input
          type="number"
          min="1"
          step="1"
          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          className="w-full text-center"
          placeholder="Qty"
          disabled={!currentItem.itemId}
        />
      </TableCell>
      <TableCell className="px-4 py-3 w-12 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleRemove}
          disabled={items.length <= 1}
          className="text-destructive hover:bg-destructive/10"
        >
          <XCircle className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}