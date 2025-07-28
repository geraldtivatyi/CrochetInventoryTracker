import { useState } from "react";
import { Yarn } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { stockStatusColor } from "@/lib/utils";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type YarnTableProps = {
  yarns: Yarn[];
  onEdit: (yarn: Yarn) => void;
  onStockAdjust: (yarn: Yarn) => void;
};

export default function YarnTable({ yarns, onEdit, onStockAdjust }: YarnTableProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; yarn?: Yarn }>({ open: false });
  
  const handleDeleteClick = (yarn: Yarn) => {
    setDeleteDialog({ open: true, yarn });
  };

  const handleConfirmDelete = async () => {
    const yarn = deleteDialog.yarn;
    if (!yarn) return;

    setDeleting(yarn.id);
    try {
      await apiRequest("DELETE", `/api/yarns/${yarn.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/yarns'] });
      toast({
        title: "Yarn deleted",
        description: `${yarn.type} - ${yarn.color} has been removed from inventory`,
      });
    } catch (error) {
      console.error("Error deleting yarn:", error);
      toast({
        title: "Error",
        description: "There was a problem deleting the yarn",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
      setDeleteDialog({ open: false });
    }
  };
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-neutral-50">
          <TableRow>
            <TableHead>Yarn Type</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Cost Per Ball</TableHead>
            <TableHead>In Stock</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {yarns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-neutral-500">
                No yarns found. Add your first yarn to get started!
              </TableCell>
            </TableRow>
          ) : (
            yarns.map((yarn) => (
              <TableRow key={yarn.id}>
                <TableCell>
                  <div className="text-sm font-medium text-neutral-900">{yarn.type}</div>
                  {yarn.notes && <div className="text-xs text-neutral-500">{yarn.notes}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <span 
                      className="w-4 h-4 rounded-full mr-2" 
                      style={{ backgroundColor: yarn.colorHex }}
                    ></span>
                    <span className="text-sm text-neutral-900">{yarn.color}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-neutral-900">
                  {formatCurrency(yarn.costPerBall)}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs rounded-full ${stockStatusColor(yarn.quantityInStock)}`}>
                    {yarn.quantityInStock} balls
                  </span>
                </TableCell>
                <TableCell className="text-sm font-medium min-w-[120px]">
                  <div className="flex space-x-1 items-center">
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => onStockAdjust(yarn)}
                      title="Adjust Stock"
                    >
                      Stock
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => onEdit(yarn)}
                      title="Edit Yarn"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeleteClick(yarn)}
                      disabled={deleting === yarn.id}
                      title="Delete Yarn"
                    >
                      {deleting === yarn.id ? "..." : "Delete"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open })}
        title="Delete Yarn"
        description={
          deleteDialog.yarn
            ? `Are you sure you want to delete ${deleteDialog.yarn.type} - ${deleteDialog.yarn.color}? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        isLoading={deleting === deleteDialog.yarn?.id}
        variant="destructive"
      />
    </div>
  );
}
