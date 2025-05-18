import { PriceCalculation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type PriceBreakdownProps = {
  calculation: PriceCalculation | null;
  selectedYarn?: { type: string; color: string } | null;
};

export default function PriceBreakdown({ calculation, selectedYarn }: PriceBreakdownProps) {
  const { toast } = useToast();
  
  const handleSave = () => {
    // In a real app, this would save the calculation to a "saved calculations" list
    toast({
      title: "Calculation saved",
      description: "The price calculation has been saved to your records",
    });
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  if (!calculation) {
    return (
      <Card className="bg-white rounded-lg shadow">
        <CardContent className="p-5">
          <h3 className="font-medium text-lg mb-4">Price Breakdown</h3>
          <div className="py-10 text-center text-neutral-500">
            <p>Complete the calculator form to see the price breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white rounded-lg shadow p-5 sticky top-6">
      <h3 className="font-medium text-lg mb-4">Price Breakdown</h3>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-neutral-200">
          <span className="text-neutral-600">
            Materials ({calculation.ballsUsed} balls{selectedYarn ? ` of ${selectedYarn.type}` : ''})
          </span>
          <span className="font-medium">{formatCurrency(calculation.materialCost - calculation.additionalCosts)}</span>
        </div>
        
        {calculation.additionalCosts > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-neutral-200">
            <span className="text-neutral-600">Additional Materials</span>
            <span className="font-medium">{formatCurrency(calculation.additionalCosts)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center py-2 border-b border-neutral-200">
          <span className="text-neutral-600">
            Labor ({calculation.laborHours} hours @ {formatCurrency(calculation.hourlyRate)}/hr)
          </span>
          <span className="font-medium">{formatCurrency(calculation.laborCost)}</span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-b border-neutral-200">
          <span className="text-neutral-600">Base Cost</span>
          <span className="font-medium">{formatCurrency(calculation.baseCost)}</span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-b border-neutral-200">
          <span className="text-neutral-600">Markup ({calculation.markupPercentage}%)</span>
          <span className="font-medium">{formatCurrency(calculation.markup)}</span>
        </div>
        
        <div className="flex justify-between items-center py-3 bg-primary-50 rounded-md px-3 mt-2">
          <span className="text-neutral-800 font-semibold">Recommended Price</span>
          <span className="text-primary-700 text-xl font-bold">{formatCurrency(calculation.finalPrice)}</span>
        </div>
        
        <div className="mt-6 space-y-3">
          <Button
            variant="accent"
            className="w-full"
            onClick={handleSave}
          >
            <i className="ri-save-line mr-1"></i> Save Calculation
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePrint}
          >
            <i className="ri-printer-line mr-1"></i> Print
          </Button>
        </div>
      </div>
    </Card>
  );
}
