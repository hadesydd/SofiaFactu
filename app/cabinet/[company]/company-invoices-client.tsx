"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, Upload, FileText, Filter, X, 
  CheckCircle, Loader2, RefreshCw
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CompanySelectionModal } from "@/components/company-selection-modal";
import { PDFViewerModal } from "@/components/pdf-viewer-modal";

interface Invoice {
  id: string;
  filename: string;
  originalName: string;
  vendor: string | null;
  amount: number | null;
  vatAmount: number | null;
  date: string | null;
  status: string;
  confidence: number | null;
  ocrText: string | null;
  category: string | null;
  filePath: string;
  company: string | null;
  createdAt: string;
}

interface Counts {
  total: number;
  toProcess: number;
  processing: number;
  processed: number;
  validated: number;
  unclassified?: number;
}

interface UploadResponse {
  id: string;
}

const companyConfig: Record<string, { name: string; color: string }> = {
  "sofia-transport": { name: "Sofia Transport", color: "blue" },
  "sofiane-transport": { name: "Sofiane Transport", color: "orange" },
  "garage-expertise": { name: "Garage Expertise", color: "green" },
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const parseAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:[.,]|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractDisplayedAmounts = (
  ocrText: string | null,
  amount: number | null,
  vatAmount: number | null,
): { total: number | null; vat: number | null } => {
  if (!ocrText) {
    return { total: amount, vat: vatAmount };
  }

  let detectedTotal: number | null = null;
  let detectedVat: number | null = null;

  const totalRegex =
    /(?:NET\s*[ÀA]?\s*PAY(?:E|ER)|TOTAL\s*TTC|TOTAL\s*TVA\s*COMPRISE|TOTAL\s*[ÀA]?\s*PAYER|MONTANT\s*TTC)[^\d]{0,25}(\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{2}))/gi;
  const vatRegex =
    /(?:MONTANT\s*TVA|TOTAL\s*TVA|TVA(?:\s*\d{1,2}%?)?)[^\d]{0,25}(\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{2}))/gi;

  for (const match of ocrText.matchAll(totalRegex)) {
    const candidate = parseAmount(match[1]);
    if (candidate == null) continue;
    if (detectedTotal == null || candidate > detectedTotal) {
      detectedTotal = candidate;
    }
  }

  for (const match of ocrText.matchAll(vatRegex)) {
    const candidate = parseAmount(match[1]);
    if (candidate == null) continue;
    if (detectedVat == null || candidate > detectedVat) {
      detectedVat = candidate;
    }
  }

  const finalTotal = detectedTotal ?? amount;
  const finalVat = detectedVat ?? vatAmount;

  return { total: finalTotal, vat: finalVat };
};

export function CompanyInvoicesClient({ 
  initialInvoices = [], 
  initialCounts,
  companyId 
}: { 
  initialInvoices?: Invoice[];
  initialCounts?: Counts;
  companyId: string;
}) {
  const company = companyConfig[companyId] || { name: "Société", color: "blue" };
  
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [counts, setCounts] = useState(initialCounts || { total: 0, toProcess: 0, processing: 0, processed: 0, validated: 0 });
  const [loading, setLoading] = useState(false);
  
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [companyFilter, setCompanyFilter] = useState(companyId || "all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { progress: number; status: string }>>({});
  const [justUploadedId, setJustUploadedId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [pdfViewer, setPdfViewer] = useState<{
    isOpen: boolean;
    isEditing?: boolean;
    invoiceId?: string;
    filePath: string;
    fileName: string;
    vendor: string | null;
    amount: number | null;
    date: string | null;
    confidence: number | null;
    category: string | null;
    ocrText: string | null;
  } | null>(null);

  const [showUnclassifiedModal, setShowUnclassifiedModal] = useState(false);
  const [unclassifiedInvoices, setUnclassifiedInvoices] = useState<Invoice[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (period !== "all") params.set("period", period);
    if (vendor !== "all") params.set("vendor", vendor);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    if (companyFilter !== "all") {
      params.set("company", companyFilter);
    }

    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices);
    setCounts(data.counts);
    setLoading(false);
  }, [search, status, period, vendor, minAmount, maxAmount, companyFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Check for unclassified invoices on mount
  useEffect(() => {
    const checkUnclassified = async () => {
      try {
        const res = await fetch('/api/invoices/unclassified');
        const data = await res.json();
        if (data.invoices && data.invoices.length > 0) {
          setUnclassifiedInvoices(data.invoices);
          setShowUnclassifiedModal(true);
        }
      } catch (e) {
        console.error('Error checking unclassified invoices:', e);
      }
    };
    checkUnclassified();
  }, []);

  const runAfterUploads = () => {
    setTimeout(async () => {
      const res = await fetch('/api/invoices/unclassified');
      const data = await res.json();
      if (data.invoices && data.invoices.length > 0) {
        setUnclassifiedInvoices(data.invoices);
        setShowUnclassifiedModal(true);
      }
      fetchInvoices();
    }, 2000);
  };

  const uploadFilesWithConcurrency = async (files: File[], concurrency = 3) => {
    if (files.length === 0) return;

    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= files.length) break;
        await uploadFile(files[index]);
      }
    });

    await Promise.all(workers);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type === "application/pdf" || f.type.startsWith("image/")
    );

    await uploadFilesWithConcurrency(files);
    runAfterUploads();
  };

  const uploadFile = async (file: File) => {
    const uploadId = Math.random().toString(36).substring(2, 15);
    
    setUploadProgress(prev => ({
      ...prev,
      [uploadId]: { progress: 0, status: "uploading" }
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("company", companyId);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            [uploadId]: { progress, status: "uploading" }
          }));
        }
      };

      const response = await new Promise<UploadResponse>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", "/api/invoices");
        xhr.send(formData);
      });

      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { progress: 100, status: "done" }
      }));

      setJustUploadedId(response.id);

      setTimeout(() => {
        setUploadProgress(prev => {
          const { [uploadId]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);

    } catch (error) {
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { progress: 0, status: "error" }
      }));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    await uploadFilesWithConcurrency(Array.from(files));
    runAfterUploads();

    e.target.value = "";
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectAll(true);
      setSelectedIds(new Set(invoices.map(inv => inv.id)));
    } else {
      setSelectAll(false);
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;

    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, invoiceIds: Array.from(selectedIds) }),
    });

    setSelectedIds(new Set());
    setSelectAll(false);
    fetchInvoices();
  };

  const handleAssignCompany = async (invoiceIds: string[], company: string) => {
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "assign-company", 
        invoiceIds,
        company 
      }),
    });
    
    setShowUnclassifiedModal(false);
    setUnclassifiedInvoices([]);
    fetchInvoices();
  };

  const handleDeleteForUnclassified = async (invoiceIds: string[]) => {
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "delete", 
        invoiceIds 
      }),
    });
    
    setShowUnclassifiedModal(false);
    setUnclassifiedInvoices([]);
    fetchInvoices();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    
    try {
      const res = await fetch("/api/invoices/sync", {
        method: "POST",
      });
      const data = await res.json();
      
      if (data.success) {
        const messageText = data.changes > 0 
          ? `${data.message}. ${data.changes} facture(s) ont été déplacées vers d'autres coffres.`
          : data.message;
        setSyncMessage({
          type: data.changes > 0 ? 'success' : 'info',
          text: messageText
        });
        fetchInvoices();
      }
    } catch (error) {
      setSyncMessage({
        type: 'success',
        text: 'Erreur lors de la synchronisation'
      });
    }
    
    setSyncing(false);
    
    // Clear message after 5 seconds
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "TO_PROCESS":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">À traiter</Badge>;
      case "PROCESSING":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">En cours</Badge>;
      case "PROCESSED":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Traité</Badge>;
      case "VALIDATED":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Validé</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Erreur</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPeriod("all");
    setVendor("all");
    setCompanyFilter(companyId || "all");
    setMinAmount("");
    setMaxAmount("");
  };

  const hasActiveFilters =
    search || status !== "all" || period !== "all" || vendor !== "all" || companyFilter !== (companyId || "all") || minAmount || maxAmount;

  return (
    <div className="flex h-full gap-6">
      <div className={`w-72 shrink-0 space-y-4 ${showFilters ? 'block' : 'hidden md:block'}`}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filtres</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6">
                  <X className="h-3 w-3 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recherche</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Fournisseur, fichier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Statut</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="TO_PROCESS">À traiter</SelectItem>
                  <SelectItem value="PROCESSING">En cours</SelectItem>
                  <SelectItem value="PROCESSED">Traité</SelectItem>
                  <SelectItem value="VALIDATED">Validé</SelectItem>
                  <SelectItem value="ERROR">Erreur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Période</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les périodes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les périodes</SelectItem>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="thisMonth">Ce mois</SelectItem>
                  <SelectItem value="lastMonth">Mois dernier</SelectItem>
                  <SelectItem value="thisYear">Cette année</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Société</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les sociétés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les sociétés</SelectItem>
                  <SelectItem value="sofia-transport">Sofia Transport</SelectItem>
                  <SelectItem value="sofiane-transport">Sofiane Transport</SelectItem>
                  <SelectItem value="garage-expertise">Garage Expertise</SelectItem>
                  <SelectItem value="unknown">Non classée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fournisseur</label>
              <Input
                placeholder="Nom fournisseur"
                value={vendor === "all" ? "" : vendor}
                onChange={(e) => setVendor(e.target.value.trim() ? e.target.value : "all")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Montant</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Min"
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <Input
                  placeholder="Max"
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="md:hidden w-full"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Masquer' : 'Afficher'} les filtres
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{counts.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">À traiter</span>
              <span className="font-medium text-orange-600">{counts.toProcess + counts.processing}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Traitées</span>
              <span className="font-medium text-green-600">{counts.processed + counts.validated}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-muted-foreground">
              {counts.total} facture{counts.total !== 1 ? "s" : ""}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} sélectionné{selectedIds.size !== 1 ? "s" : ""}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction("validate")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Valider
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction("delete")}
                  className="text-red-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            )}

            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {syncing ? 'Synchronisation...' : 'Synchroniser'}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Importer
              </Button>
            </div>
          </div>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            syncMessage.type === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {syncMessage.text}
          </div>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragActive(true)}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
          `}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Glissez-déposez vos factures ici, ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, JPG, PNG acceptés
          </p>
        </div>

        {Object.keys(uploadProgress).length > 0 && (
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([id, { progress, status }]) => (
              <div key={id} className="flex items-center gap-2 text-sm">
                <Loader2 className={`h-4 w-4 ${status === 'done' ? 'text-green-500' : 'animate-spin'}`} />
                <span>Traitement en cours...</span>
                {status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune facture trouvée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left text-sm font-medium">Fichier</th>
                      <th className="p-3 text-left text-sm font-medium">Fournisseur</th>
                      <th className="p-3 text-left text-sm font-medium">Total</th>
                      <th className="p-3 text-left text-sm font-medium">TVA</th>
                      <th className="p-3 text-left text-sm font-medium">Date</th>
                      <th className="p-3 text-left text-sm font-medium">Statut</th>
                      <th className="p-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => {
                      const displayed = extractDisplayedAmounts(invoice.ocrText, invoice.amount, invoice.vatAmount);
                      return (
                      <tr 
                        key={invoice.id} 
                        className={`hover:bg-muted/50 transition-colors cursor-pointer ${justUploadedId === invoice.id ? 'bg-green-50' : ''}`}
                        onClick={(e) => {
                          // Prevent opening when clicking checkbox or action buttons
                          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="checkbox"]')) {
                            return;
                          }
                          setPdfViewer({
                            isOpen: true,
                            invoiceId: invoice.id,
                            filePath: invoice.filePath,
                            fileName: invoice.originalName,
                            vendor: invoice.vendor,
                            amount: displayed.total,
                            date: invoice.date,
                            confidence: invoice.confidence,
                            category: invoice.category,
                            ocrText: invoice.ocrText
                          });
                        }}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-500" />
                            <span className="text-sm truncate max-w-[150px]">
                              {invoice.originalName}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm">{invoice.vendor || '—'}</span>
                        </td>
                        <td className="p-3">
                          <span className={`text-sm font-medium ${displayed.total == null ? "text-muted-foreground" : "text-green-600"}`}>
                            {formatCurrency(displayed.total)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`text-sm ${displayed.vat == null ? "text-muted-foreground" : ""}`}>
                            {formatCurrency(displayed.vat)}
                          </span>
                        </td>
                        <td className="p-3">
                          {invoice.date ? (
                            <span className="text-sm">
                              {new Date(invoice.date).toLocaleDateString('fr-FR')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPdfViewer({
                                isOpen: true,
                                invoiceId: invoice.id,
                                filePath: invoice.filePath,
                                fileName: invoice.originalName,
                                vendor: invoice.vendor,
                                amount: displayed.total,
                                date: invoice.date,
                                confidence: invoice.confidence,
                                category: invoice.category,
                                ocrText: invoice.ocrText
                              });
                            }}
                          >
                            Voir
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pdfViewer && pdfViewer.isOpen && (
        <PDFViewerModal
          isOpen={pdfViewer.isOpen}
          isEditing={pdfViewer.isEditing}
          onClose={() => setPdfViewer(null)}
          invoiceId={pdfViewer.invoiceId}
          filePath={pdfViewer.filePath}
          fileName={pdfViewer.fileName}
          vendor={pdfViewer.vendor}
          amount={pdfViewer.amount}
          date={pdfViewer.date}
          confidence={pdfViewer.confidence}
          category={pdfViewer.category}
          ocrText={pdfViewer.ocrText}
        />
      )}

      <CompanySelectionModal
        isOpen={showUnclassifiedModal}
        invoices={unclassifiedInvoices}
        onAssign={handleAssignCompany}
        onDelete={handleDeleteForUnclassified}
        onCancel={() => {
          setShowUnclassifiedModal(false);
          setUnclassifiedInvoices([]);
        }}
      />
    </div>
  );
}
