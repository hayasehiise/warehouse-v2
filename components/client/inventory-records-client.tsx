"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Trash2,
  MoreHorizontal,
  Calendar,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";

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
import { format } from "date-fns";
import { id } from "date-fns/locale";

import {
  getInventories,
  createInventory,
  forceDeleteInventory,
  getItemOptions,
  getItemById,
  type InventoryRow,
  type GetInventoriesParams,
  type ItemOption,
} from "@/lib/actions/inventory";

const createInventorySchema = z.object({
  itemId: z.string().min(1, "Barang harus dipilih"),
  transactionDate: z.string().min(1, "Tanggal transaksi harus diisi"),
  quantity: z.number().positive("Quantity harus lebih dari 0"),
  type: z.enum(["MASUK", "KELUAR"]),
  status: z.enum(["BAIK", "RUSAK", "HILANG", "KADALUARSA"]),
});

type CreateInventoryFormData = z.infer<typeof createInventorySchema>;

const typeLabels: Record<"MASUK" | "KELUAR", string> = {
  MASUK: "Masuk",
  KELUAR: "Keluar",
};

const statusLabels: Record<"BAIK" | "RUSAK" | "HILANG" | "KADALUARSA", string> =
  {
    BAIK: "Baik",
    RUSAK: "Rusak",
    HILANG: "Hilang",
    KADALUARSA: "Kadaluarsa",
  };

const typeColors: Record<"MASUK" | "KELUAR", string> = {
  MASUK: "bg-green-100 text-green-800",
  KELUAR: "bg-red-100 text-red-800",
};

const statusColors: Record<"BAIK" | "RUSAK" | "HILANG" | "KADALUARSA", string> =
  {
    BAIK: "bg-green-100 text-green-800",
    RUSAK: "bg-yellow-100 text-yellow-800",
    HILANG: "bg-red-100 text-red-800",
    KADALUARSA: "bg-purple-100 text-purple-800",
  };

const statusOptionsByType: Record<
  "MASUK" | "KELUAR",
  { value: string; label: string }[]
> = {
  MASUK: [{ value: "BAIK", label: "Baik" }],
  KELUAR: [
    { value: "RUSAK", label: "Rusak" },
    { value: "HILANG", label: "Hilang" },
    { value: "KADALUARSA", label: "Kadaluarsa" },
  ],
};

export default function InventoryRecordsClient() {
  const params = useParams();
  const itemId = params.itemId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "MASUK" | "KELUAR">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "BAIK" | "RUSAK" | "HILANG" | "KADALUARSA"
  >("all");
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
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: itemData } = useQuery({
    queryKey: ["item", "detail", itemId],
    queryFn: () => getItemById(itemId),
    staleTime: 1000 * 60 * 5,
  });

  const queryParams = useMemo(
    () => ({
      itemId,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy: (sorting[0]?.id === "quantity"
        ? "quantity"
        : "transactionDate") as "transactionDate" | "quantity",
      sortOrder: (sorting[0]?.desc ? "desc" : "asc") as "asc" | "desc",
      filterType: filterType === "all" ? undefined : filterType,
      filterStatus: filterStatus === "all" ? undefined : filterStatus,
      dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
      dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
    }),
    [
      itemId,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      filterType,
      filterStatus,
      dateFrom,
      dateTo,
    ],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["inventories", queryParams],
    queryFn: () => getInventories(queryParams),
    placeholderData: (prev) => prev,
    enabled: !!itemId,
  });

  const totals = useMemo(() => {
    const masuk =
      data?.data
        .filter((r) => r.type === "MASUK")
        .reduce((sum, r) => sum + r.quantity, 0) ?? 0;
    const keluar =
      data?.data
        .filter((r) => r.type === "KELUAR")
        .reduce((sum, r) => sum + r.quantity, 0) ?? 0;
    return { masuk, keluar, balance: masuk - keluar };
  }, [data?.data]);

  const { data: items } = useQuery({
    queryKey: ["items", "options"],
    queryFn: () => getItemOptions(),
    staleTime: 1000 * 60 * 5,
  });

  const form = useForm<CreateInventoryFormData>({
    resolver: zodResolver(createInventorySchema),
    defaultValues: {
      itemId: itemId,
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      quantity: 1,
      type: "MASUK",
      status: "BAIK",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CreateInventoryFormData) => {
      return createInventory(values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDialogOpen(false);
      form.reset({
        itemId: itemId,
        transactionDate: format(new Date(), "yyyy-MM-dd"),
        quantity: 1,
        type: "MASUK",
        status: "BAIK",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      return forceDeleteInventory(deleteTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
  });

  const openCreate = useCallback(() => {
    form.reset({
      itemId: itemId,
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      quantity: 1,
      type: "MASUK",
      status: "BAIK",
    });
    setIsDialogOpen(true);
  }, [form, itemId]);

  const handleSave = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const columns = useMemo<ColumnDef<InventoryRow>[]>(
    () => [
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
        accessorKey: "quantity",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-auto p-0 font-medium hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <div className="flex items-center gap-1">
              Quantity
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
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">
            {getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => {
          const type = getValue() as "MASUK" | "KELUAR";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[type]}`}
            >
              {typeLabels[type]}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as
            | "BAIK"
            | "RUSAK"
            | "HILANG"
            | "KADALUARSA";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}
            >
              {statusLabels[status]}
            </span>
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
          const inventory = row.original;
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
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleteTarget(inventory);
                      setIsDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Hapus Permanen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {itemData?.name || "Loading..."}
            </h1>
            <p className="text-sm text-muted-foreground">
              Record transaksi {itemData?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground border-l border-border pl-4">
            <div>
              <span className="font-medium text-green-600">{totals.masuk}</span>{" "}
              Masuk
            </div>
            <div>
              <span className="font-medium text-red-600">{totals.keluar}</span>{" "}
              Keluar
            </div>
            <div>
              <span className="font-medium">
                {totals.balance >= 0 ? "+" : ""}
                {totals.balance}
              </span>{" "}
              Saldo
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Tambah Record
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Filter & Pencarian</CardTitle>
          <CardDescription>
            Filter record inventory berdasarkan type, status, dan rentang
            tanggal
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari..."
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
                value={filterType}
                onValueChange={(v) => {
                  setFilterType(v as "all" | "MASUK" | "KELUAR");
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Semua Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Type</SelectItem>
                  <SelectItem value="MASUK">Masuk</SelectItem>
                  <SelectItem value="KELUAR">Keluar</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(
                    v as "all" | "BAIK" | "RUSAK" | "HILANG" | "KADALUARSA",
                  );
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="BAIK">Baik</SelectItem>
                  <SelectItem value="RUSAK">Rusak</SelectItem>
                  <SelectItem value="HILANG">Hilang</SelectItem>
                  <SelectItem value="KADALUARSA">Kadaluarsa</SelectItem>
                </SelectContent>
              </Select>
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
              {search ? "Record tidak ditemukan" : "Belum ada record inventory"}
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
                <tfoot>
                  <tr className="border-t border-border bg-muted/50 font-medium">
                    <td className="px-6 py-3 text-right" colSpan={2}>
                      Total
                    </td>
                    <td className="px-6 py-3 text-right text-green-600">
                      {totals.masuk}
                    </td>
                    <td className="px-6 py-3 text-right text-red-600">
                      {totals.keluar}
                    </td>
                    <td className="px-6 py-3 text-right font-bold">
                      {totals.balance}
                    </td>
                    <td className="px-6 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Record Inventory</DialogTitle>
            <DialogDescription>
              Buat record transaksi masuk atau keluar barang
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="itemId">Barang</Label>
                <Input
                  id="itemId"
                  readOnly
                  value={itemData?.name || ""}
                  className="bg-muted"
                />
                <Input type="hidden" {...form.register("itemId")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionDate">Tanggal Transaksi</Label>
                <Popover>
                  <PopoverTrigger
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
                      selected={
                        form.watch("transactionDate")
                          ? new Date(form.watch("transactionDate"))
                          : new Date()
                      }
                      onSelect={(date) =>
                        date &&
                        form.setValue(
                          "transactionDate",
                          format(date, "yyyy-MM-dd"),
                        )
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
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  {...form.register("quantity", { valueAsNumber: true })}
                  placeholder="Quantity"
                  aria-invalid={!!form.formState.errors.quantity}
                />
                {form.formState.errors.quantity && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.quantity.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => {
                    v && form.setValue("type", v as "MASUK" | "KELUAR");
                    const statusOptions =
                      statusOptionsByType[v as "MASUK" | "KELUAR"];
                    if (statusOptions.length > 0) {
                      form.setValue(
                        "status",
                        statusOptions[0]
                          .value as CreateInventoryFormData["status"],
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASUK">Masuk</SelectItem>
                    <SelectItem value="KELUAR">Keluar</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.type && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    v &&
                    form.setValue(
                      "status",
                      v as CreateInventoryFormData["status"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptionsByType[form.watch("type")]?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.status && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.status.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {form.watch("type") === "MASUK"
                    ? "Type Masuk hanya boleh status Baik"
                    : "Type Keluar tidak boleh status Baik"}
                </p>
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
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Permanen Record</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus permanen record inventory
              <span className="font-medium text-foreground">
                {deleteTarget?.itemName}
              </span>
              ? Tindakan ini tidak dapat dibatalkan dan akan mengembalikan stok
              barang ke keadaan sebelum transaksi ini dibuat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
