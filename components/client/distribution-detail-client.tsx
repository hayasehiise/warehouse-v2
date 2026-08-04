"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Edit,
  CheckCircle2,
  XCircle,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  User,
  Calendar,
  FileText,
  Clock,
  Plus,
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

import {
  getDistributionById,
  approveDistribution,
  rejectDistribution,
  softDeleteDistribution,
  forceDeleteDistribution,
  restoreDistribution,
  updateDistribution,
  getItemOptionsForDistribution,
  type DistributionDetailRow,
  type ItemOptionWithStock,
} from "@/lib/actions/distribution";

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

const formSchema = z
  .object({
    transactionDate: z.string().min(1, "Tanggal transaksi harus diisi"),
    recipientName: z.string().min(1, "Nama penerima harus diisi"),
    note: z.string().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, "Barang harus dipilih"),
          quantity: z.number().positive("Quantity harus lebih dari 0"),
        }),
      )
      .min(1, "Minimal 1 item harus ditambahkan"),
  })
  .refine(
    (data) => {
      const itemIds = data.items.map((item) => item.itemId);
      return new Set(itemIds).size === itemIds.length;
    },
    {
      message: "Item tidak boleh sama",
      path: ["items"],
    },
  );

type CreateDistributionFormData = z.infer<typeof formSchema>;

export default function DistributionDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteTarget, setDeleteTarget] =
    useState<DistributionDetailRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isForceDelete, setIsForceDelete] = useState(false);

  const [approveTarget, setApproveTarget] =
    useState<DistributionDetailRow | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);

  const [rejectTarget, setRejectTarget] =
    useState<DistributionDetailRow | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] =
    useState<DistributionDetailRow | null>(null);

  const { data: distribution, isLoading } = useQuery({
    queryKey: ["distribution", "detail", id],
    queryFn: () => getDistributionById(id),
    enabled: !!id,
    staleTime: 1000 * 60,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approveTarget) return;
      return approveDistribution(approveTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution", "detail", id],
      });
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsApproveOpen(false);
      setApproveTarget(null);
      toast.success("Pengambilan berhasil disetujui");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      return rejectDistribution(rejectTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution", "detail", id],
      });
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsRejectOpen(false);
      setRejectTarget(null);
      toast.success("Pengambilan berhasil ditolak");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: CreateDistributionFormData;
    }) => {
      return updateDistribution(id, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution", "detail", id],
      });
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsEditDialogOpen(false);
      setEditingDistribution(null);
      toast.success("Pengambilan berhasil diperbarui");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { data: itemOptions = [] } = useQuery({
    queryKey: ["items", "for-distribution"],
    queryFn: () => getItemOptionsForDistribution(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 10,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (isForceDelete) {
        return forceDeleteDistribution(deleteTarget.id);
      }
      return softDeleteDistribution(deleteTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({ queryKey: ["items-for-inventory"] });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      setIsForceDelete(false);
      router.push("/distribution");
      toast.success(
        isForceDelete
          ? "Pengambilan berhasil dihapus permanen"
          : "Pengambilan berhasil dihapus",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDistribution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      queryClient.invalidateQueries({
        queryKey: ["distribution", "detail", id],
      });
      router.push("/distribution");
      toast.success("Pengambilan berhasil dipulihkan");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleRestore = (id: string) => {
    restoreMutation.mutate(id);
  };

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleReject = () => {
    rejectMutation.mutate();
  };

  const handleEdit = useCallback(async () => {
    if (!distribution) return;
    queryClient.invalidateQueries({ queryKey: ["items", "for-distribution"] });
    const freshData = await getDistributionById(distribution.id);
    if (freshData) {
      setEditingDistribution(freshData);
      setIsEditDialogOpen(true);
    }
  }, [distribution]);

  const handleSave = useCallback(
    (values: CreateDistributionFormData) => {
      if (editingDistribution) {
        updateMutation.mutate({ id: editingDistribution.id, values });
      }
    },
    [editingDistribution, updateMutation],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-pulse space-y-4 max-w-md mx-auto">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!distribution) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Detail Pengambilan
              </h1>
              <p className="text-sm text-muted-foreground">
                Data tidak ditemukan
              </p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Pengambilan tidak ditemukan
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDeleted = distribution.deletedAt !== null;
  const isPending = distribution.approvedStatus === "PENDING";
  const isApproved = distribution.approvedStatus === "APPROVED";
  const isRejected = distribution.approvedStatus === "REJECTED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {distribution.transactionCode}
            </h1>
            <p className="text-sm text-muted-foreground">
              Detail pengambilan barang
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDeleted && (
            <Button
              variant="outline"
              onClick={() => handleRestore(distribution.id)}
              disabled={restoreMutation.isPending}
            >
              <RotateCcw className="size-4 mr-2" />
              Pulihkan
            </Button>
          )}
          {!isDeleted && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline">
                    <MoreHorizontal className="size-4 mr-2" />
                    Aksi
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {isPending && (
                  <>
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setApproveTarget(distribution);
                        setIsApproveOpen(true);
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setRejectTarget(distribution);
                        setIsRejectOpen(true);
                      }}
                    >
                      <XCircle className="size-4" />
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                        setIsForceDelete(false);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </DropdownMenuItem>
                  </>
                )}
                {isRejected && (
                  <>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                        setIsForceDelete(false);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                        setIsForceDelete(true);
                      }}
                    >
                      <XCircle className="size-4" />
                      Hapus Permanen
                    </DropdownMenuItem>
                  </>
                )}
                {isApproved && (
                  <>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                        setIsForceDelete(false);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Hapus
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget(distribution);
                        setIsDeleteOpen(true);
                        setIsForceDelete(true);
                      }}
                    >
                      <XCircle className="size-4" />
                      Hapus Permanen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Pengambilan</CardTitle>
              <CardDescription>
                Detail transaksi pengambilan barang
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Kode Transaksi
                  </Label>
                  <p className="font-mono text-lg font-medium">
                    {distribution.transactionCode}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Tanggal Transaksi
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <p>
                      {format(
                        new Date(distribution.transactionDate),
                        "dd MMMM yyyy",
                        { locale: localeId },
                      )}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Penerima
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <p className="font-medium">{distribution.recipientName}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Status Approval
                  </Label>
                  <Badge className={statusColors[distribution.approvedStatus]}>
                    {statusLabels[distribution.approvedStatus]}
                  </Badge>
                </div>
                {distribution.note && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-sm text-muted-foreground">
                      Catatan
                    </Label>
                    <div className="flex items-start gap-2">
                      <FileText className="size-4 text-muted-foreground mt-0.5" />
                      <p className="whitespace-pre-wrap">{distribution.note}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Dibuat Oleh
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <p>{distribution.createdByName}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Dibuat Pada
                  </Label>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <p>
                      {format(
                        new Date(distribution.createdAt),
                        "dd MMMM yyyy HH:mm",
                        { locale: localeId },
                      )}
                    </p>
                  </div>
                </div>
                {distribution.approvedByName && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      Diapprove Oleh
                    </Label>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-muted-foreground" />
                      <p>{distribution.approvedByName}</p>
                    </div>
                  </div>
                )}
                {distribution.approvedAt && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">
                      Diapprove Pada
                    </Label>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" />
                      <p>
                        {format(
                          new Date(distribution.approvedAt),
                          "dd MMMM yyyy HH:mm",
                          { locale: localeId },
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Item Pengambilan</CardTitle>
              <CardDescription>
                Daftar barang yang diambil beserta quantity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distribution.items.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Tidak ada item
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Barang
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Unit
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Stok Saat Ini
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {distribution.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.itemName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{item.itemUnit}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                            {item.currentStock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-muted/50">
                        <td className="px-4 py-3 font-medium" colSpan={2}>
                          Total Item
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {distribution.items.length}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {distribution.items.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Total Item Unik
                </Label>
                <p className="text-2xl font-bold">
                  {distribution.items.length}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Total Quantity
                </Label>
                <p className="text-2xl font-bold tabular-nums">
                  {distribution.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  )}
                </p>
              </div>
              <div className="pt-4 border-t">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={statusColors[distribution.approvedStatus]}>
                    {statusLabels[distribution.approvedStatus]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {isDeleted && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Data Dihapus</CardTitle>
                <CardDescription>
                  Data ini telah dihapus dan tidak akan muncul di daftar aktif
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRestore(distribution.id)}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="size-4 mr-2" />
                  Pulihkan Data
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setDeleteTarget(distribution);
                    setIsDeleteOpen(true);
                    setIsForceDelete(true);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <XCircle className="size-4 mr-2" />
                  Hapus Permanen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isForceDelete
                ? "Hapus Permanen Pengambilan"
                : "Hapus Pengambilan"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isForceDelete ? (
                <>
                  Apakah Anda yakin ingin menghapus permanen pengambilan
                  <span className="font-medium text-foreground">
                    {deleteTarget?.transactionCode}
                  </span>
                  ? Tindakan ini tidak dapat dibatalkan.
                  {deleteTarget?.approvedStatus === "REJECTED" && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Stok barang yang sudah dikembalikan saat reject tidak akan
                      terpengaruh.
                    </p>
                  )}
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
              variant={isForceDelete ? "destructive" : "default"}
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? "Menghapus..."
                : isForceDelete
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
                &nbsp;{approveTarget?.transactionCode}
              </span>
              ? Stok barang akan dikurangi secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
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
                &nbsp;{rejectTarget?.transactionCode}
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

      <DistributionEditDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        editingDistribution={editingDistribution}
        onSave={handleSave}
        isPending={updateMutation.isPending}
        items={itemOptions}
      />
    </div>
  );
}

interface DistributionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingDistribution: DistributionDetailRow | null;
  onSave: (values: CreateDistributionFormData) => void;
  isPending: boolean;
  items: ItemOptionWithStock[];
}

function DistributionEditDialog({
  isOpen,
  onClose,
  editingDistribution,
  onSave,
  isPending,
  items: itemOptions,
}: DistributionEditDialogProps) {
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
    if (editingDistribution) {
      form.reset({
        transactionDate: format(
          new Date(editingDistribution.transactionDate),
          "yyyy-MM-dd",
        ),
        recipientName: editingDistribution.recipientName,
        note: editingDistribution.note ?? "",
        items: editingDistribution.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      });
    }
  }, [editingDistribution, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-h-[90vh]"
      >
        <DialogHeader>
          <DialogTitle>Edit Pengambilan</DialogTitle>
          <DialogDescription>Ubah detail pengambilan</DialogDescription>
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
                    selected={
                      form.watch("transactionDate")
                        ? new Date(form.watch("transactionDate")!)
                        : new Date()
                    }
                    onSelect={(date) =>
                      date &&
                      form.setValue(
                        "transactionDate",
                        format(date, "yyyy-MM-dd"),
                      )
                    }
                    locale={localeId}
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
                    form.setValue("items", [
                      ...items,
                      { itemId: "", quantity: 1 },
                    ]);
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
                      <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Barang
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-24">
                        Unit
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground w-32">
                        Quantity
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-12">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.watch("items").map((item, index) => (
                      <DistributionEditItemRow
                        key={index}
                        index={index}
                        form={form}
                        items={itemOptions}
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

interface DistributionEditItemRowProps {
  index: number;
  form: ReturnType<typeof useForm<CreateDistributionFormData>>;
  items: ItemOptionWithStock[];
}

function DistributionEditItemRow({
  index,
  form,
  items: itemOptions,
}: DistributionEditItemRowProps) {
  const { watch, setValue, register } = form;
  const items = watch("items");
  const currentItem = items[index];

  const handleItemChange = (itemId: string) => {
    setValue(`items.${index}.itemId`, itemId);
    setValue(`items.${index}.quantity`, 1);
  };

  const handleRemove = () => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setValue("items", newItems);
  };

  const duplicateError =
    watch("items").filter(
      (item, i) => i !== index && item.itemId === currentItem.itemId,
    ).length > 0;
  const selectedItem = itemOptions.find((i) => i.id === currentItem.itemId);

  return (
    <TableRow className="border-b border-border last:border-0 hover:bg-muted/50">
      <TableCell className="px-4 py-3">
        <Select
          value={currentItem.itemId}
          onValueChange={(v) => v && handleItemChange(v)}
        >
          <SelectTrigger
            className="w-full min-w-[280px]"
            aria-invalid={!!currentItem.itemId && duplicateError}
          >
            <SelectValue placeholder="Pilih barang">
              {selectedItem
                ? `${selectedItem.name} (${selectedItem.unit})`
                : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {itemOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <div className="flex items-center justify-between w-full min-w-[300px]">
                  <span>
                    {item.name} ({item.unit})
                  </span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    Stok: {item.totalStock}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentItem.itemId && duplicateError && (
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
