import InventoryRecordsClient from "@/components/client/inventory-records-client";

export default async function InventoryRecordsPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  await params;
  return <InventoryRecordsClient />;
}