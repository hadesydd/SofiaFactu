"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
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
import { PDFViewerModal } from "@/components/pdf-viewer-modal";
import { 
  Search, Trash2, CheckCircle, Upload, 
  FileText, AlertTriangle, CheckCircle2, XCircle, Loader2,
  CloudUpload, Building, Calendar, Euro, Target, FileCheck,
  Image, File, X, Eye, Download, ChevronLeft, ChevronRight, Check
} from "lucide-react";

interface Invoice {
  id: string;
  filename: string;
  originalName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  status: string;
  confidence: number | null;
  ocrText: string | null;
  category: string | null;
  filePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceCounts {
  total: number;
  toProcess: number;
  processing: number;
  processed: number;
  error: number;
  validated: number;
}

interface UploadProgress {
  id: string;
  filename: string;
  savedFilename?: string;
  invoiceId?: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  vendor?: string | null;
  amount?: number | null;
  confidence?: number | null;
  date?: string | null;
  ocrText?: string | null;
  error?: string;
}

interface InvoiceListProps {
  initialInvoices: Invoice[];
  initialCounts: InvoiceCounts;
}

export function InvoiceList({ initialInvoices, initialCounts }: InvoiceListProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [counts, setCounts] = useState(initialCounts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [justUploadedId, setJustUploadedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
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
  const [batchQueue, setBatchQueue] = useState<string[]>([]);
  const [validatedIds, setValidatedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInvoices = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (period !== "all") params.set("period", period);
    if (vendor !== "all") params.set("vendor", vendor);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);

    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices);
    setCounts(data.counts);
  }, [search, status, period, vendor, minAmount, maxAmount]);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const uploadFile = async (file: File, shouldOpenViewer: boolean = true, previousIds: string[] | null = null): Promise<string | null> => {
    const uploadId = generateId();
    const filename = file.name;
    
    setUploadProgress(prev => [...prev, { 
      id: uploadId,
      filename, 
      progress: 0, 
      status: "uploading",
      vendor: null,
      amount: null,
      confidence: null,
      date: null
    }]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(prev => 
        prev.map(p => p.id === uploadId ? { ...p, status: "processing", progress: 50 } : p)
      );

      const res = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();

      setUploadProgress(prev => 
        prev.map(p => p.id === uploadId ? { 
          ...p, 
          progress: 100, 
          status: "done",
          savedFilename: data.filename,
          invoiceId: data.id,
          vendor: data.vendor,
          amount: data.amount,
          confidence: data.confidence,
          date: data.date,
          ocrText: data.ocrText,
        } : p)
      );

      // Open PDF viewer in edit mode after first upload only
      if (shouldOpenViewer) {
        setJustUploadedId(data.id);
        setPdfViewer({
          isOpen: true,
          isEditing: true,
          invoiceId: data.id,
          filePath: `/uploads/invoices/${data.filename}`,
          fileName: data.filename,
          vendor: data.vendor,
          amount: data.amount,
          date: data.date,
          confidence: data.confidence,
          category: data.category,
          ocrText: data.ocrText
        });
      }

      await fetchInvoices();
      
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(p => p.id !== uploadId));
      }, 8000);

      return data.id;

    } catch (error) {
      setUploadProgress(prev => 
        prev.map(p => p.id === uploadId ? { 
          ...p, 
          status: "error",
          error: error instanceof Error ? error.message : "Erreur lors du traitement"
        } : p)
      );
      return null;
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsDragActive(false);
    
    const uploadedIds: string[] = [];
    
    for (let i = 0; i < acceptedFiles.length; i++) {
      const uploadId = await uploadFile(acceptedFiles[i], i === 0, i === 0 ? null : uploadedIds);
      if (uploadId) {
        uploadedIds.push(uploadId);
      }
    }
    
    if (uploadedIds.length > 1) {
      setBatchQueue(uploadedIds);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive: isDragActiveDropzone } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif']
    },
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadedIds: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const id = await uploadFile(files[i], i === 0, i === 0 ? null : uploadedIds);
      if (id) {
        uploadedIds.push(id);
      }
    }

    if (uploadedIds.length > 1) {
      setBatchQueue(uploadedIds);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    } else {
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

  const handleBulkAction = async (action: string, category?: string) => {
    if (selectedIds.size === 0) return;

    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, invoiceIds: Array.from(selectedIds), category }),
    });

    setSelectedIds(new Set());
    await fetchInvoices();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    await fetchInvoices();
  };

  const handleNavigate = async (direction: 'prev' | 'next') => {
    if (!pdfViewer?.invoiceId) return;
    
    // Always use the current invoice list for navigation
    const currentQueue = invoices.map(inv => inv.id);
    
    if (currentQueue.length <= 1) {
      console.log('Only one invoice, cannot navigate');
      return;
    }
    
    const currentIdx = currentQueue.indexOf(pdfViewer.invoiceId);
    if (currentIdx === -1) {
      console.log('Current invoice not found in list');
      return;
    }
    
    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    
    if (newIdx < 0 || newIdx >= currentQueue.length) {
      console.log('Cannot navigate beyond bounds');
      return;
    }
    
    console.log('Navigating to index:', newIdx, 'ID:', currentQueue[newIdx]);
    
    const nextInvoiceId = currentQueue[newIdx];
    
    const res = await fetch(`/api/invoices/${nextInvoiceId}`);
    if (!res.ok) {
      console.error('Failed to fetch invoice');
      return;
    }
    
    const invoiceData = await res.json();
    console.log('Got invoice data:', invoiceData.id, invoiceData.originalName);
    
    setPdfViewer({
      isOpen: true,
      isEditing: false,
      invoiceId: invoiceData.id,
      filePath: invoiceData.filePath,
      fileName: invoiceData.originalName,
      vendor: invoiceData.vendor,
      amount: invoiceData.amount,
      date: invoiceData.date,
      confidence: invoiceData.confidence,
      category: invoiceData.category,
      ocrText: invoiceData.ocrText
    });
    
    // Update batchQueue to match
    setBatchQueue(currentQueue);
  };

  const handleValidateOne = async () => {
    if (!pdfViewer?.invoiceId) return;
    
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "validate", 
        invoiceIds: [pdfViewer.invoiceId] 
      }),
    });
    
    setValidatedIds(prev => new Set([...prev, pdfViewer.invoiceId!]));
    await fetchInvoices();
    
    const currentIdx = batchQueue.indexOf(pdfViewer.invoiceId!);
    if (currentIdx < batchQueue.length - 1) {
      handleNavigate('next');
    }
  };

  const handleValidateAll = async () => {
    if (batchQueue.length === 0) return;
    
    await fetch("/api/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "validate", 
        invoiceIds: batchQueue 
      }),
    });
    
    setBatchQueue([]);
    setValidatedIds(new Set());
    setPdfViewer(null);
    await fetchInvoices();
  };

  const getCurrentIndex = () => {
    if (!pdfViewer?.invoiceId) return 0;
    const currentQueue = invoices.map(inv => inv.id);
    const idx = currentQueue.indexOf(pdfViewer.invoiceId);
    return idx >= 0 ? idx : 0;
  };

  const removeUpload = (id: string) => {
    setUploadProgress(prev => prev.filter(p => p.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALIDATED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PROCESSED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "PROCESSING":
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string, confidence: number | null) => {
    let label = status === "TO_PROCESS" ? "À vérifier" : status === "PROCESSED" ? "Traité" : status === "PROCESSING" ? "En cours" : status === "ERROR" ? "Erreur" : status === "VALIDATED" ? "Validé" : status;
    
    if (status === "TO_PROCESS" && confidence !== null) {
      label = `À vérifier (${confidence}%)`;
    } else if (status === "PROCESSED" && confidence !== null) {
      label = `Auto-validé (${confidence}%)`;
    } else if (status === "PROCESSING") {
      label = "Traitement...";
    } else if (status === "ERROR") {
      label = "Erreur";
    }

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      VALIDATED: "default",
      PROCESSED: "secondary",
      PROCESSING: "outline",
      ERROR: "destructive",
      TO_PROCESS: "secondary",
    };

    return <Badge variant={variants[status] || "secondary"}>{label}</Badge>;
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <File className="h-5 w-5 text-red-500" />;
    if (mimeType.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const getConfidenceColor = (confidence: number | null | undefined) => {
    if (confidence === null || confidence === undefined) return "bg-gray-200";
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Boîte de réception</h1>
          <p className="text-muted-foreground">{counts.total} facture{counts.total !== 1 ? "s" : ""} à traiter</p>
        </div>
      </div>

      {/* Zone de drop améliorée avec animations */}
      <Card className="overflow-hidden">
        <div
          {...getRootProps()}
          className={`
            relative overflow-hidden cursor-pointer transition-all duration-300 ease-out
            ${isDragActiveDropzone || isDragActive 
              ? "bg-green-50/80 dark:bg-green-950/20 scale-[1.01] shadow-lg shadow-green-500/20" 
              : "hover:bg-muted/30"}
          `}
        >
          {/* Animation de fond lors du drag */}
          {isDragActiveDropzone && (
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-green-500/10 animate-pulse" />
          )}
          
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CloudUpload className="h-4 w-4" />
                Importer des factures
              </CardTitle>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                multiple
                className="hidden"
                {...getInputProps()}
              />
            </div>
          </CardHeader>
          
          <CardContent className="relative z-10">
            <div className={`
              rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300
              ${isDragActiveDropzone || isDragActive 
                ? "border-green-500 bg-green-500/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/20"}
            `}>
              <input {...getInputProps()} />
              
              <div className="flex flex-col items-center gap-4">
                {/* Icône animée */}
                <div className={`
                  h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${isDragActiveDropzone || isDragActive 
                    ? "bg-green-500/20 scale-110 shadow-lg shadow-green-500/30" 
                    : "bg-primary/10"}
                `}>
                  {isDragActiveDropzone || isDragActive ? (
                    <FileCheck className="h-8 w-8 text-green-600 animate-bounce" />
                  ) : (
                    <CloudUpload className="h-8 w-8 text-primary" />
                  )}
                </div>
                
                <div>
                  <p className="font-semibold text-lg">
                    {isDragActiveDropzone || isDragActive 
                      ? "Déposez vos fichiers ici" 
                      : "Glissez-déposez vos factures ici"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ou cliquez pour sélectionner des fichiers
                  </p>
                </div>

                {/* Types de fichiers acceptés */}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <File className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">PDF</span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Image className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">JPG</span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Image className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">PNG</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Taille max: 10 Mo par fichier
                </p>
              </div>
            </div>
          </CardContent>
        </div>

        {/* Liste des uploads avec données OCR */}
        {uploadProgress.length > 0 && (
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {uploadProgress.length} fichier{uploadProgress.length > 1 ? "s" : ""} en cours
              </p>
            </div>
            
            {uploadProgress.map((upload) => (
              <div 
                key={upload.id}
                className="rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                {/* En-tête avec status */}
                <div className="flex items-center justify-between p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    {upload.status === "uploading" || upload.status === "processing" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : upload.status === "done" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <span className="font-medium">{upload.filename}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {upload.status === "uploading" && "Upload en cours..."}
                        {upload.status === "processing" && "Traitement OCR..."}
                        {upload.status === "done" && "Terminé"}
                        {upload.status === "error" && "Erreur"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {upload.status === "processing" && (
                      <span className="text-xs text-blue-500 animate-pulse">OCR en cours...</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeUpload(upload.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Progression */}
                {upload.status !== "error" && (
                  <Progress 
                    value={upload.progress} 
                    className="h-1 rounded-none"
                  />
                )}
                
                {/* DONNÉES OCR - Affichage après traitement */}
                {upload.status === "done" && (
                  <div className="p-4 space-y-4">
                    {/* Informations extraites */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-start gap-2">
                        <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Fournisseur</p>
                          <p className="font-medium">{upload.vendor || "Inconnu"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Montant</p>
                          <p className="font-semibold text-green-600">
                            {upload.amount ? formatAmount(upload.amount) : "—"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="font-medium">{upload.date ? formatDate(upload.date) : "—"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="font-medium">{upload.confidence || 0}%</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Barre de confidence */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Fiabilité de l'extraction</span>
                        <span className={`
                          font-medium
                          ${(upload.confidence || 0) >= 80 ? "text-green-600" : 
                            (upload.confidence || 0) >= 50 ? "text-yellow-600" : "text-red-600"}
                        `}>
                          {(upload.confidence || 0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${getConfidenceColor(upload.confidence)}`}
                          style={{ width: `${upload.confidence || 0}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Actions rapides */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          if (upload.invoiceId) {
                            setBatchQueue(prev => prev.includes(upload.invoiceId!) ? prev : [...prev, upload.invoiceId!]);
                          }
                          setPdfViewer({
                            isOpen: true,
                            invoiceId: upload.invoiceId,
                            filePath: `/uploads/invoices/${upload.savedFilename || upload.filename}`,
                            fileName: upload.savedFilename || upload.filename,
                            vendor: upload.vendor ?? null,
                            amount: upload.amount ?? null,
                            date: upload.date ?? null,
                            confidence: upload.confidence ?? null,
                            category: null,
                            ocrText: upload.ocrText ?? null
                          });
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Voir le détail
                      </Button>
                      {upload.invoiceId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs text-green-600 border-green-200 hover:bg-green-50"
                          onClick={async () => {
                            await fetch("/api/invoices/bulk", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ 
                                action: "validate", 
                                invoiceIds: [upload.invoiceId!] 
                              }),
                            });
                            await fetchInvoices();
                            setValidatedIds(prev => new Set([...prev, upload.invoiceId!]));
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Valider
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Erreur */}
                {upload.status === "error" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-red-500 text-sm">
                      <XCircle className="h-4 w-4" />
                      <span>{upload.error || "Erreur lors du traitement"}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => removeUpload(upload.id)}
                    >
                      Fermer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Actions de masse */}
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Checkbox
          checked={selectedIds.size === invoices.length && invoices.length > 0}
          onCheckedChange={handleSelectAll}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBulkDeleteConfirm(true)}
          disabled={selectedIds.size === 0}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBulkAction("validate")}
          disabled={selectedIds.size === 0}
          className="text-muted-foreground"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Valider
        </Button>
        <Select onValueChange={(v) => handleBulkAction("categorize", v)}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Catégoriser" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fourniture">Fourniture</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="energie">Énergie</SelectItem>
            <SelectItem value="autre">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">FILTRES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous ({counts.total})</SelectItem>
                    <SelectItem value="TO_PROCESS">À traiter ({counts.toProcess})</SelectItem>
                    <SelectItem value="PROCESSING">En attente ({counts.processing})</SelectItem>
                    <SelectItem value="PROCESSED">Traitées ({counts.processed})</SelectItem>
                    <SelectItem value="ERROR">Erreur ({counts.error})</SelectItem>
                    <SelectItem value="VALIDATED">Validées ({counts.validated})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <label className="text-xs font-medium">Période</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="thisMonth">Ce mois</SelectItem>
                    <SelectItem value="lastMonth">Mois dernier</SelectItem>
                    <SelectItem value="thisYear">Cette année</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <label className="text-xs font-medium">Montant</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Min"
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="h-8"
                  />
                  <Input
                    placeholder="Max"
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              <Button onClick={fetchInvoices} className="w-full">
                Appliquer
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une facture..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchInvoices()}
              className="pl-10"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucune facture trouvée</p>
                  <p className="text-sm text-muted-foreground/70">
                    Importez vos premières factures pour commencer
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          {getStatusIcon(invoice.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(invoice.mimeType)}
                            <div>
                              <span className="font-medium block">{invoice.originalName}</span>
                              <span className="text-xs text-muted-foreground">{formatFileSize(invoice.size)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.vendor ? (
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              {invoice.vendor}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(invoice.amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(invoice.date)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status, invoice.confidence)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                console.log('Opening PDF viewer for:', invoice.filePath);
                                setPdfViewer({
                                  isOpen: true,
                                  invoiceId: invoice.id,
                                  filePath: invoice.filePath,
                                  fileName: invoice.originalName,
                                  vendor: invoice.vendor,
                                  amount: invoice.amount,
                                  date: invoice.date,
                                  confidence: invoice.confidence,
                                  category: invoice.category,
                                  ocrText: invoice.ocrText
                                });
                              }}
                              className="opacity-100"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(invoice.filePath, '_blank')}
                              className="opacity-100"
                            >
                              <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmId(invoice.id)}
                              className="opacity-100"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {invoices.length > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              Affichage 1-{invoices.length} sur {counts.total} facture{counts.total !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <PDFViewerModal
          isOpen={pdfViewer.isOpen}
          isEditing={pdfViewer.isEditing}
          onClose={() => {
            setPdfViewer(null);
            setBatchQueue([]);
          }}
          invoiceId={pdfViewer.invoiceId}
          filePath={pdfViewer.filePath}
          fileName={pdfViewer.fileName}
          vendor={pdfViewer.vendor}
          amount={pdfViewer.amount}
          date={pdfViewer.date}
          confidence={pdfViewer.confidence}
          category={pdfViewer.category}
          ocrText={pdfViewer.ocrText}
          batchQueue={batchQueue.length > 1 ? batchQueue : invoices.map(inv => inv.id)}
          currentIndex={getCurrentIndex()}
          onNavigate={handleNavigate}
          onValidateAll={batchQueue.length > 1 ? handleValidateAll : undefined}
          onValidate={handleValidateOne}
          isValidated={validatedIds.has(pdfViewer.invoiceId || '')}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteConfirmId) {
                  await handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression multiple</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.size} facture{selectedIds.size > 1 ? "s" : ""} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteConfirm(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await handleBulkAction("delete");
                setBulkDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
