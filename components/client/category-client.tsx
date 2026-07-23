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
  getCategories,
  createCategory,
  updateCategory,
  softDeleteCategory,
  forceDeleteCategory,
  restoreCategory,
  type CategoryRow,
  type FormData,
} from "@/lib/actions/category";

const formSchema = z.object({
  name: z.string().min(1, "Nama kategori harus diisi"),
  description: z.string().optional(),
});

type FilterTab = "active" | "deleted";

export default function CategoryClient() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("active");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: search || undefined,
      filter,
    }),
    [pagination.pageIndex, pagination.pageSize, search, filter],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["categories", queryParams],
    queryFn: () => getCategories(queryParams),
    placeholderData: (prev) => prev,
  });

  const columns = useMemo<ColumnDef<CategoryRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return (
            <span className="text-muted-foreground">
              {v || "\u2014"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const cat = row.original;
          if (filter === "deleted") {
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRestore(cat.id)}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDeleteTarget(cat);
                    setIsDeleteOpen(true);
                  }}
                >
                  <XCircle className="size-4 text-destructive" />
                </Button>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(cat)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setDeleteTarget(cat);
                  setIsDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [filter],
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (editingId) {
        return updateCategory(editingId, values);
      }
      return createCategory(values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsDialogOpen(false);
      form.reset({ name: "", description: "" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (filter === "deleted") {
        return forceDeleteCategory(deleteTarget.id);
      }
      return softDeleteCategory(deleteTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const openCreate = useCallback(() => {
    setEditingId(null);
    form.reset({ name: "", description: "" });
    setIsDialogOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (cat: CategoryRow) => {
      setEditingId(cat.id);
      form.reset({ name: cat.name, description: cat.description ?? "" });
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

  const rows = table.getRowModel().rows;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Kelola kategori barang
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Kategori
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari kategori..."
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
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search
                ? "Kategori tidak ditemukan"
                : filter === "deleted"
                  ? "Tidak ada kategori yang terhapus"
                  : "Belum ada kategori"}
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
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Kategori" : "Tambah Kategori"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Ubah detail kategori"
                : "Buat kategori barang baru"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Nama kategori"
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Deskripsi (opsional)"
                  rows={3}
                />
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
                ? "Hapus Permanen Kategori"
                : "Hapus Kategori"}
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
                  Kategori{" "}
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
