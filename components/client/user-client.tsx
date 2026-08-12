"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  banUser,
  createUser,
  getUsers,
  unbanUser,
  updateUser,
  type CreateUserData,
  type UpdateUserData,
  type UserRow,
} from "@/lib/actions/user";
import { EMPLOYEE_GROUPS, EMPLOYEE_RANKS } from "@/lib/user-options";

const formSchema = z.object({
  name: z.string().min(1, "Nama harus diisi"),
  email: z.email("Email tidak valid"),
  username: z.string().min(3, "Username minimal 3 karakter"),
  role: z.enum(["admin", "supervisor", "staff"]),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .optional()
    .or(z.literal("")),
  employee_code: z
    .string()
    .regex(
      /^\d{8} \d{6} \d \d{3}$/,
      "NIP harus berformat 11111111 222222 3 444",
    ),
  employee_rank: z.enum(EMPLOYEE_RANKS),
  employee_position: z.string().min(1, "Jabatan harus diisi"),
  employee_group: z.enum(EMPLOYEE_GROUPS),
});
type FormValues = z.infer<typeof formSchema>;
type FilterTab = "active" | "banned";
function formatNip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 18);
  const parts = [
    digits.slice(0, 8),
    digits.slice(8, 14),
    digits.slice(14, 15),
    digits.slice(15, 18),
  ].filter(Boolean);
  return parts.join(" ");
}

const emptyValues: FormValues = {
  name: "",
  email: "",
  username: "",
  role: "staff",
  password: "",
  employee_code: "",
  employee_rank: "Juru Muda",
  employee_position: "",
  employee_group: "I/a",
};

export default function UserClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("active");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<UserRow | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });
  const banForm = useForm<{ banReason: string; banExpiresIn: string }>({
    defaultValues: { banReason: "", banExpiresIn: "" },
  });
  const params = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: search || undefined,
      filter,
    }),
    [filter, pagination, search],
  );
  const { data, isLoading } = useQuery({
    queryKey: ["users", params],
    queryFn: () => getUsers(params),
    placeholderData: (previous) => previous,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });
  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      editingUser
        ? updateUser(editingUser.id, values as UpdateUserData)
        : createUser(values as CreateUserData),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success("Data pengguna berhasil disimpan");
    },
    onError: (error) => toast.error(error.message),
  });
  const banMutation = useMutation({
    mutationFn: (values: { banReason: string; banExpiresIn: string }) =>
      banUser(banTarget!.id, {
        banReason: values.banReason,
        banExpiresIn: values.banExpiresIn
          ? Number(values.banExpiresIn) * 86400
          : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setBanTarget(null);
      toast.success("Pengguna berhasil diblokir");
    },
    onError: (error) => toast.error(error.message),
  });
  const unbanMutation = useMutation({
    mutationFn: () => unbanUser(unbanTarget!.id),
    onSuccess: () => {
      invalidate();
      setUnbanTarget(null);
      toast.success("Blokir pengguna dibuka");
    },
    onError: (error) => toast.error(error.message),
  });
  const openCreate = useCallback(() => {
    setEditingUser(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  }, [form]);
  const openEdit = useCallback(
    (user: UserRow) => {
      setEditingUser(user);
      form.reset({
        name: user.name,
        email: user.email,
        username: user.username ?? "",
        role: user.role,
        password: "",
        employee_code: user.employee_code ?? "",
        employee_rank:
          (user.employee_rank as FormValues["employee_rank"]) ?? "Juru Muda",
        employee_position: user.employee_position ?? "",
        employee_group:
          (user.employee_group as FormValues["employee_group"]) ?? "I/a",
      });
      setDialogOpen(true);
    },
    [form],
  );
  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ row }) => row.original.username ?? "-",
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">
            {row.original.role}
          </span>
        ),
      },
      {
        accessorKey: "employee_code",
        header: "NIP",
        cell: ({ row }) => row.original.employee_code ? formatNip(row.original.employee_code) : "-",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={
              row.original.banned ? "text-destructive" : "text-emerald-600"
            }
          >
            {row.original.banned ? "Diblokir" : "Aktif"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(row.original)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {row.original.banned ? (
                  <DropdownMenuItem
                    onClick={() => setUnbanTarget(row.original)}
                  >
                    <CheckCircle2 className="size-4" />
                    Buka Blokir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setBanTarget(row.original);
                      banForm.reset();
                    }}
                  >
                    <Ban className="size-4" />
                    Blokir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [banForm, openEdit],
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
  const renderSelect = (name: "role", label: string, options: readonly string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={form.watch(name)} onValueChange={(value) => value && form.setValue(name, value as "admin" | "supervisor" | "staff")}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const renderCombobox = (name: "employee_rank" | "employee_group", label: string, options: readonly string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Combobox value={form.watch(name)} onValueChange={(value) => value && form.setValue(name, value as never, { shouldValidate: true })} items={options}>
        <ComboboxInput className="w-full" placeholder={`Cari ${label.toLowerCase()}...`} showClear />
        <ComboboxContent>
          <ComboboxEmpty>Tidak ada hasil.</ComboboxEmpty>
          <ComboboxList className="max-h-48">
            {options.map((option) => <ComboboxItem key={option} value={option}>{option}</ComboboxItem>)}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun pengguna dan profil pegawai
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah User
        </Button>
      </div>
      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari nama, email, username, atau NIP..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              />
            </div>
            <div className="flex gap-1 rounded-3xl bg-muted p-1">
              {(["active", "banned"] as const).map((value) => (
                <Button
                  key={value}
                  variant={filter === value ? "default" : "ghost"}
                  size="sm"
                  className="rounded-2xl"
                  onClick={() => setFilter(value)}
                >
                  {value === "active" ? "Aktif" : "Diblokir"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Memuat...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id} className="border-b">
                      {group.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"
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
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-6 py-4 text-sm">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada pengguna
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm">
              {pagination.pageIndex + 1} /{" "}
              {Math.ceil(data.total / data.pageSize)}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Tambah User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Ubah akun dan profil pegawai"
                : "Buat akun pengguna baru"}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutate(values),
            )}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  "name",
                  "email",
                  "username",
                  "password",
                  "employee_position",
                ] as const
              ).map((name) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name}>
                    {name === "employee_position"
                        ? "Jabatan"
                        : name === "password"
                          ? "Password"
                          : name[0].toUpperCase() + name.slice(1)}
                  </Label>
                  <Input
                    id={name}
                    type={name === "password" ? "password" : "text"}
                    placeholder={editingUser && name === "password" ? "Kosongkan jika tidak diubah" : undefined}
                    {...form.register(name)}
                  />
                  {form.formState.errors[name] && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors[name]?.message}
                    </p>
                  )}
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="employee_code">NIP</Label>
                <Input
                  id="employee_code"
                  inputMode="numeric"
                  maxLength={21}
                  pattern="[0-9]{8} [0-9]{6} [0-9] [0-9]{3}"
                  placeholder="99999999 999999 9 999"
                  value={form.watch("employee_code")}
                  onChange={(event) => form.setValue("employee_code", formatNip(event.target.value), { shouldValidate: true })}
                />
                {form.formState.errors.employee_code && <p className="text-xs text-destructive">{form.formState.errors.employee_code.message}</p>}
              </div>
              {renderSelect("role", "Role", ["admin", "supervisor", "staff"])}
              {renderCombobox("employee_rank", "Pangkat", EMPLOYEE_RANKS)}
              {renderCombobox("employee_group", "Golongan", EMPLOYEE_GROUPS)}
            </div>
            <DialogFooter>
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
      <AlertDialog
        open={!!banTarget}
        onOpenChange={(open) => !open && setBanTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blokir User</AlertDialogTitle>
            <AlertDialogDescription>
              Pengguna {banTarget?.name} tidak akan dapat masuk dan seluruh
              sesinya akan dihentikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            onSubmit={banForm.handleSubmit((values) =>
              banMutation.mutate(values),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Alasan blokir</Label>
              <Input
                {...banForm.register("banReason", {
                  required: "Alasan ban harus diisi",
                })}
              />
              {banForm.formState.errors.banReason && (
                <p className="text-xs text-destructive">
                  {banForm.formState.errors.banReason.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Durasi (hari)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Kosongkan untuk permanen"
                {...banForm.register("banExpiresIn")}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant="destructive"
                disabled={banMutation.isPending}
              >
                Blokir
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!unbanTarget}
        onOpenChange={(open) => !open && setUnbanTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buka Blokir User</AlertDialogTitle>
            <AlertDialogDescription>
              Izinkan {unbanTarget?.name} untuk kembali masuk?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unbanMutation.mutate()}
              disabled={unbanMutation.isPending}
            >
              Buka Blokir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
