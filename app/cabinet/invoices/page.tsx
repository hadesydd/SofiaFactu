import { prisma } from "@/lib/prisma";
import { InvoiceList } from "@/components/invoice-list";

async function getInvoices() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.invoice.groupBy({
    by: ["status"],
    _count: true,
  });

  const result = {
    total: invoices.length,
    toProcess: counts.find((c) => c.status === "TO_PROCESS")?._count || 0,
    processing: counts.find((c) => c.status === "PROCESSING")?._count || 0,
    processed: counts.find((c) => c.status === "PROCESSED")?._count || 0,
    error: counts.find((c) => c.status === "ERROR")?._count || 0,
    validated: counts.find((c) => c.status === "VALIDATED")?._count || 0,
  };

  return {
    invoices: invoices.map((inv) => ({
      ...inv,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      date: inv.date?.toISOString() || null,
    })),
    counts: result,
  };
}

export default async function InvoicesPage() {
  const { invoices, counts } = await getInvoices();

  return <InvoiceList initialInvoices={invoices} initialCounts={counts} />;
}
