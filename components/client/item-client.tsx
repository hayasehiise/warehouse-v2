"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RotateCcw,
  XCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
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
  getItems,
  createItem,
  updateItem,
  softDeleteItem,
  forceDeleteItem,
  restoreItem,
  getCategoriesOptions,
  getItemUnits,
  type ItemRow,
  type FormData,
  type CategoryOption,
} from "@/lib/actions/item";

const formSchema = z.object({
  name: z.string().min(1, "Nama barang harus diisi"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Kategori harus dipilih"),
  unit: z.string().min(1, "Unit harus diisi"),
});

type FilterTab = "active" | "deleted";

export default function ItemClient() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("active");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: search || undefined,
      filter,
      categoryId: categoryFilter || undefined,
      unit: unitFilter || undefined,
    }),
    [pagination.pageIndex, pagination.pageSize, search, filter, categoryFilter, unitFilter],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["items", queryParams],
    queryFn: () => getItems(queryParams),
    placeholderData: (prev) => prev,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", "options"],
    queryFn: () => getCategoriesOptions(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: units } = useQuery({
    queryKey: ["items", "units"],
    queryFn: () => getItemUnits(),
    staleTime: 1000 * 60 * 5,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", categoryId: "", unit: "pcs" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (editingId) {
        return updateItem(editingId, values);
      }
      return createItem(values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setIsDialogOpen(false);
      form.reset({ name: "", description: "", categoryId: "", unit: "pcs" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (filter === "deleted") {
        return forceDeleteItem(deleteTarget.id);
      }
      return softDeleteItem(deleteTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const openCreate = useCallback(() => {
    setEditingId(null);
    form.reset({ name: "", description: "", categoryId: "", unit: "pcs" });
    setIsDialogOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (item: ItemRow) => {
      setEditingId(item.id);
      form.reset({
        name: item.name,
        description: item.description ?? "",
        categoryId: item.categoryId,
        unit: item.stocks.length > 0 ? item.stocks[0].unit : "pcs",
      });
      setIsDialogOpen(true);
    },
    [form],
  );

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate(id);
    },
    [restoreMutation],
  );

  const handleSave = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Kategori",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue() as string}
          </span>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        cell: ({ row }) => {
          const stocks = row.original.stocks;
          return (
            <div className="flex flex-wrap gap-1">
              {stocks.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                >
                  {s.unit}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const item = row.original;
          if (filter === "deleted") {
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
                      onClick={() => handleRestore(item.id)}
                    >
                      <RotateCcw className="size-4" />
                      Pulihkan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(item);
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
                  <DropdownMenuItem onClick={() => openEdit(item)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleteTarget(item);
                      setIsDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [filter, openEdit, handleRestore, setDeleteTarget, setIsDeleteOpen],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    pageCount: data ? Math.ceil(data.total / data.pageSize) : -1,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Barang</h1>
          <p className="text-sm text-muted-foreground">
            Kelola data barang
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Barang
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari barang..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className="pl-9"
              />
            </div>
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
          <div className="flex items-center gap-4">
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v ?? "");
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Semua Kategori">
                  {categoryFilter
                    ? categories?.find((c) => c.id === categoryFilter)?.name
                    : "Semua Kategori"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Kategori</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={unitFilter}
              onValueChange={(v) => {
                setUnitFilter(v ?? "");
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Semua Unit">
                  {unitFilter || "Semua Unit"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Unit</SelectItem>
                {units?.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search
                ? "Barang tidak ditemukan"
                : filter === "deleted"
                  ? "Tidak ada barang yang terhapus"
                  : "Belum ada barang"}
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
        </CardContent>

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
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Barang" : "Tambah Barang"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Ubah detail barang"
                : "Buat data barang baru"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Nama barang"
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Kategori</Label>
                <Select
                  value={form.watch("categoryId")}
                  onValueChange={(v) => { if (v) form.setValue("categoryId", v); }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih kategori">
                      {categories?.find(c => c.id === form.watch("categoryId"))?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.categoryId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.categoryId.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  {...form.register("description")}
                  placeholder="Deskripsi (opsional)"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit Stok</Label>
                <Input
                  id="unit"
                  {...form.register("unit")}
                  placeholder="Contoh: pcs, kg, box"
                  aria-invalid={!!form.formState.errors.unit}
                />
                {form.formState.errors.unit && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.unit.message}
                  </p>
                )}
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
              <Button
                type="submit"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {filter === "deleted"
                ? "Hapus Permanen Barang"
                : "Hapus Barang"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {filter === "deleted" ? (
                <>
                  Apakah Anda yakin ingin menghapus permanen{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.name}
                  </span>
                  ? Tindakan ini tidak dapat dibatalkan.
                </>
              ) : (
                <>
                  Barang{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget?.name}
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
    </div>
  );
}
