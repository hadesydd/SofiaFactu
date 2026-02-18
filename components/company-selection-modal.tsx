"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { FileText, X, Check, Loader2, Truck, Wrench, Trash2 } from "lucide-react";

interface UnclassifiedInvoice {
  id: string;
  filename: string;
  originalName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  filePath: string;
  createdAt: string;
}

interface CompanySelectionModalProps {
  isOpen: boolean;
  invoices: UnclassifiedInvoice[];
  onAssign: (invoiceIds: string[], company: string) => void;
  onCancel: () => void;
  onDelete?: (invoiceIds: string[]) => void;
}

const companies = [
  {
    id: "SOFIA_TRANSPORT",
    name: "Sofia Transport",
    description: "Transporteur logistique",
    icon: Truck,
    color: "blue",
  },
  {
    id: "SOFIANE_TRANSPORT",
    name: "Sofiane Transport",
    description: "Transporteur logistique",
    icon: Truck,
    color: "orange",
  },
  {
    id: "GARAGE_EXPERTISE",
    name: "Garage Expertise",
    description: "Réparation et expertise automobile",
    icon: Wrench,
    color: "green",
  },
];

const companyColors: Record<string, string> = {
  SOFIA_TRANSPORT: "border-blue-500 bg-blue-50",
  SOFIANE_TRANSPORT: "border-orange-500 bg-orange-50",
  GARAGE_EXPERTISE: "border-green-500 bg-green-50",
};

export function CompanySelectionModal({
  isOpen,
  invoices,
  onAssign,
  onCancel,
  onDelete,
}: CompanySelectionModalProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const handleDeleteClick = () => {
    if (!onDelete || selectedInvoices.size === 0) return;
    
    // Si déjà confirmé, supprimer directement
    if (deleteConfirmed) {
      handleDeleteConfirmed();
    } else {
      // Sinon, afficher le dialog
      setShowDeleteDialog(true);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!onDelete) return;
    setShowDeleteDialog(false);
    setDeleteConfirmed(true);
    setDeleting(true);
    await onDelete(Array.from(selectedInvoices));
    setDeleting(false);
  };

  useEffect(() => {
    if (isOpen && invoices.length > 0) {
      setSelectedInvoices(new Set(invoices.map((inv) => inv.id)));
      setCurrentIndex(0);
      setSelectedCompany("");
    }
  }, [isOpen, invoices]);

  if (!isOpen) return null;

  const currentInvoice = invoices[currentIndex];
  const allSelected = invoices.length > 0 && selectedInvoices.size === invoices.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(invoices.map((inv) => inv.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoices);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedInvoices(newSelected);
  };

  const handleConfirm = async () => {
    if (!selectedCompany || selectedInvoices.size === 0) return;

    setLoading(true);
    onAssign(Array.from(selectedInvoices), selectedCompany);
    setLoading(false);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < invoices.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2">
      <div className="bg-background rounded-lg w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-500" />
            <span className="font-medium">
              Classer {invoices.length} facture{invoices.length !== 1 ? "s" : ""} non classée{invoices.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* PDF Viewer */}
          <div className="flex-1 bg-muted/20 p-4">
            {currentInvoice && (
              <iframe
                src={currentInvoice.filePath}
                className="w-full h-full rounded"
                title="PDF Viewer"
              />
            )}
          </div>

          {/* Selection Panel */}
          <div className="w-96 border-l p-4 overflow-y-auto flex flex-col">
            {/* Invoice List */}
            <div className="flex-1 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Factures à classer</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll(!allSelected)}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      currentIndex === index ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(invoice.id, !!checked)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{invoice.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.vendor || "Fournisseur inconnu"}
                      </p>
                    </div>
                    {currentIndex === index && (
                      <span className="text-xs text-muted-foreground">
                        {index + 1}/{invoices.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Navigation */}
              {invoices.length > 1 && (
                <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                  >
                    Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {invoices.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentIndex === invoices.length - 1}
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </div>

            {/* Company Selection */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">
                Sélectionner la société cible
              </h3>
              
              <RadioGroup
                value={selectedCompany}
                onValueChange={setSelectedCompany}
                className="space-y-2"
              >
                {companies.map((company) => (
                  <div key={company.id}>
                    <RadioGroupItem
                      value={company.id}
                      id={company.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={company.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:${companyColors[company.id]} hover:bg-muted`}
                    >
                      <company.icon className={`h-5 w-5 ${
                        company.id === "SOFIA_TRANSPORT" ? "text-blue-500" :
                        company.id === "SOFIANE_TRANSPORT" ? "text-orange-500" :
                        "text-green-500"
                      }`} />
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.description}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Actions */}
            <div className="border-t pt-4 mt-4 flex gap-2">
              {onDelete && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteClick}
                  disabled={selectedInvoices.size === 0 || deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {deleteConfirmed ? "Supprimer" : "Supprimer"}
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={loading || deleting}
              >
                {loading || deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={!selectedCompany || selectedInvoices.size === 0 || loading || deleting}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog de confirmation pour la suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedInvoices.size} facture(s) ? 
              Cette action est irréversible et les factures seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirmed}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
