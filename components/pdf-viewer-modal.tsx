"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Download, Loader2, FileText, Building, Calendar as CalendarIcon, Euro, 
  Hash, Percent, Tag, FileCheck, AlertCircle, X, CreditCard,
  User, MapPin, Phone, Mail, Pencil, Save, ChevronLeft, ChevronRight,
  CheckCircle, CheckCircle2
} from "lucide-react";

interface PDFViewerModalProps {
  isOpen: boolean;
  isEditing?: boolean;
  onClose: () => void;
  invoiceId?: string;
  filePath: string;
  fileName: string;
  vendor?: string | null;
  amount?: number | null;
  date?: string | null;
  confidence?: number | null;
  category?: string | null;
  ocrText?: string | null;
  batchQueue?: string[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
  onValidateAll?: () => void;
  onValidate?: () => void;
  isValidated?: boolean;
}

export function PDFViewerModal({
  isOpen,
  isEditing: isEditingProp,
  onClose,
  invoiceId,
  filePath,
  fileName,
  vendor,
  amount,
  date,
  confidence,
  category,
  ocrText,
  batchQueue = [],
  currentIndex = 0,
  onNavigate,
  onValidateAll,
  onValidate,
  isValidated = false
}: PDFViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vendor: vendor || "",
    amount: amount?.toString() || "",
    date: date || "",
    category: category || "",
    iban: "",
    email: "",
    phone: "",
    siret: "",
    address: "",
  });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setIsEditing(isEditingProp || false);
      setFormData({
        vendor: vendor || "",
        amount: amount?.toString() || "",
        date: date || "",
        category: category || "",
        iban: extractIBAN(ocrText || null) || "",
        email: extractEmail(ocrText || null) || "",
        phone: extractPhone(ocrText || null) || "",
        siret: extractSIRET(ocrText || null) || "",
        address: extractAddress(ocrText || null) || "",
      });
    }
  }, [isOpen, isEditingProp, vendor, amount, date, category, ocrText]);

  const formatAmount = (amt: number | null | undefined) => {
    if (amt === null || amt === undefined) return null;
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amt);
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(filePath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      window.open(filePath, '_blank');
    }
  };

  const handleSave = async () => {
    if (!invoiceId) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendor: formData.vendor || null,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          date: formData.date ? new Date(formData.date).toISOString() : null,
          category: formData.category || null,
          iban: formData.iban || null,
          email: formData.email || null,
          phone: formData.phone || null,
          siret: formData.siret || null,
          address: formData.address || null,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        onClose();
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return "bg-green-100 text-green-700 border-green-200";
    if (conf >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const getStatusLabel = (conf: number | null | undefined) => {
    if (conf === null || conf === undefined) return "Non analysé";
    if (conf >= 80) return "Fiable";
    if (conf >= 50) return "Partiel";
    return "Faible";
  };

  const extractIBAN = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/FR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}/i);
    if (match) return match[0].toUpperCase().replace(/\s/g, ' ');
    const match2 = text.match(/FR[A-Z0-9]{23}/i);
    return match2 ? match2[0].toUpperCase() : null;
  };

  const extractEmail = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  };

  const extractPhone = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/(?:tel|téléphone|phone)[\s:.]*(\d{10}|\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i);
    if (match) return match[1];
    const match2 = text.match(/0\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/);
    return match2 ? match2[0] : null;
  };

  const extractSIRET = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/\b\d{14}\b/);
    return match ? match[0] : null;
  };

  const extractAddress = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/(\d+[\s,]+[A-Z][a-zéèêëàâäùûüôöîï]*[\s,]+[A-Z]{2,5})/);
    return match ? match[0] : null;
  };

  const extractInvoiceNumber = (text: string | null) => {
    if (!text) return null;
    const match = text.match(/(?:facture|invoice|n°|no|numéro)[\s.:]*([A-Z0-9-]+)/i);
    if (match) return match[1];
    const match2 = text.match(/N°\s*([A-Z0-9-]+)/i);
    return match2 ? match2[1] : null;
  };

  const invoiceNumber = extractInvoiceNumber(ocrText || null);
  const parsedDate = formData.date ? new Date(formData.date) : undefined;

  const handleClose = () => {
    onClose();
  };

  const renderEditableField = (
    label: string,
    field: keyof typeof formData,
    icon: React.ReactNode,
    placeholder: string,
    multiline: boolean = false
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      {isEditing ? (
        multiline ? (
          <Textarea
            value={formData[field]}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={placeholder}
            className="min-h-[60px]"
          />
        ) : (
          <Input
            value={formData[field]}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="p-2.5 bg-muted/30 rounded-md">
          {formData[field] ? (
            <span className="text-sm break-all">{formData[field]}</span>
          ) : (
            <span className="text-muted-foreground text-sm italic">Non détecté</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="!max-w-[90vw] !w-[90vw] !h-[85vh] !max-h-[85vh] !p-0 !m-0 rounded-lg overflow-hidden [&>button]:hidden">
        <div className="flex h-full w-full">
          {/* PDF - 60% */}
          <div className="w-[60%] h-full bg-muted/10 flex flex-col">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground bg-background/80 z-10">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Chargement du PDF...</span>
              </div>
            )}
            <iframe
              src={filePath}
              className="w-full h-full border-0"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              title={fileName}
            />
          </div>

          {/* Infos OCR - 40% */}
          <div className="w-[40%] h-full overflow-y-auto bg-background border-l flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/10 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 text-red-500 shrink-0" />
                  <span className="font-medium text-sm truncate">{fileName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Validate All button - only in batch mode */}
                  {batchQueue.length > 1 && onValidateAll && (
                    <Button 
                      variant="default" 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={onValidateAll}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Tout valider ({batchQueue.length})
                    </Button>
                  )}
                  {isEditing ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Enregistrer
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditing(false)}
                      >
                        Annuler
                      </Button>
                    </>
                  ) : invoiceId ? (
                    <>
                      {onValidate && (
                        <Button 
                          variant={isValidated ? "default" : "outline"}
                          size="sm"
                          className={isValidated ? "bg-green-600 hover:bg-green-700" : "text-green-600 border-green-200 hover:bg-green-50"}
                          onClick={onValidate}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isValidated ? "Validé" : "Valider"}
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                    </>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Navigation Bar - show when there are multiple invoices */}
            {batchQueue.length > 1 && (
              <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.('prev')}
                  disabled={currentIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Button>
                <span className="text-sm font-medium">
                  Facture {currentIndex + 1} sur {batchQueue.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.('next')}
                  disabled={currentIndex >= batchQueue.length - 1}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Détails OCR */}
            <div className="p-4 space-y-4 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                <FileCheck className="h-4 w-4" />
                Données {isEditing ? "(Édition)" : "extraites (OCR)"}
              </div>

              {/* Société / Fournisseur */}
              {renderEditableField("Société / Fournisseur", "vendor", <Building className="h-3 w-3" />, "Nom du fournisseur")}

              {/* Montant */}
              {renderEditableField("Montant TTC", "amount", <Euro className="h-3 w-3" />, "0.00")}

              {/* Date */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  Date de la facture
                </div>
                {isEditing ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={"w-full justify-start text-left font-normal"}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {parsedDate ? parsedDate.toLocaleDateString("fr-FR") : "Sélectionner une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parsedDate}
                        onSelect={(date) => {
                          if (date) {
                            setFormData({ ...formData, date: date.toISOString().split('T')[0] });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="p-2.5 bg-muted/30 rounded-md">
                    {date ? (
                      <span className="font-medium text-sm">{formatDate(date)}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Non détectée</span>
                    )}
                  </div>
                )}
              </div>

              {/* Numéro de facture (read-only) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  N° Facture
                </div>
                <div className="p-2.5 bg-muted/30 rounded-md">
                  {invoiceNumber ? (
                    <span className="font-mono text-sm font-medium">{invoiceNumber}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">Non détecté</span>
                  )}
                </div>
              </div>

              {/* IBAN */}
              {renderEditableField("IBAN", "iban", <CreditCard className="h-3 w-3" />, "FR00 0000 0000 0000 0000 00")}

              {/* Email */}
              {renderEditableField("Email", "email", <Mail className="h-3 w-3" />, "email@exemple.fr")}

              {/* Téléphone */}
              {renderEditableField("Téléphone", "phone", <Phone className="h-3 w-3" />, "01 23 45 67 89")}

              {/* SIRET */}
              {renderEditableField("SIRET", "siret", <User className="h-3 w-3" />, "123 456 789 00000")}

              {/* Adresse */}
              {renderEditableField("Adresse", "address", <MapPin className="h-3 w-3" />, "123 rue example", true)}

              {/* Catégorie */}
              {renderEditableField("Catégorie", "category", <Tag className="h-3 w-3" />, "Catégorie")}

              {/* Confiance */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  Fiabilité de l'extraction
                </div>
                <div className="p-2.5 bg-muted/30 rounded-md">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getConfidenceColor(confidence ?? 0)} border text-xs`}>
                      {confidence !== null && confidence !== undefined ? `${confidence}%` : "N/A"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(confidence)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alerte si confiance faible */}
              {confidence !== null && confidence !== undefined && confidence < 50 && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700">
                    <strong>Attention:</strong> Fiabilité faible. Vérifiez les informations manuellement.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
