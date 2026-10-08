import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import CalculatorForm from "@/components/calculator/calculator-form";
import PriceBreakdown from "@/components/calculator/price-breakdown";
import { PriceCalculation, Yarn } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

export default function Calculator() {
  const [location] = useLocation();
  const [calculationResult, setCalculationResult] = useState<PriceCalculation | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedYarn, setSelectedYarn] = useState<{ type: string; color: string } | null>(null);

  // Parse query parameters to get project ID if any
  useEffect(() => {
    // Use window.location.search directly as wouter might not include query params
    const queryString = window.location.search.slice(1); // Remove the '?' 
    const params = new URLSearchParams(queryString);
    const projectId = params.get('project');
    if (projectId) {
      setSelectedProjectId(parseInt(projectId));
    }
  }, [location]);

  // Fetch yarns to find selected yarn details
  const { data: yarns = [] } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });
  const { data: calculations = [], isLoading: calculationsLoading, error: calculationsError } = useQuery<PriceCalculation[]>({
    queryKey: ['/api/calculations'],
  });

  // When calculation is complete, find the yarn details if a yarn was selected
  const handleCalculate = (calculation: PriceCalculation) => {
    setCalculationResult(calculation);
    
    if (calculation.yarnId) {
      const yarn = yarns.find(y => y.id === calculation.yarnId);
      if (yarn) {
        setSelectedYarn({
          type: yarn.type,
          color: yarn.color
        });
      }
    } else {
      setSelectedYarn(null);
    }
  };

  const showCalculation = (calculation: PriceCalculation) => {
    handleCalculate(calculation);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-poppins font-semibold text-xl mb-4">Pricing Calculator</h2>
        <p className="text-neutral-600">Calculate the recommended price for your crochet items based on materials, labor, and markup.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calculator Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-medium text-lg mb-4">Item Details</h3>
            <CalculatorForm 
              initialProject={selectedProjectId} 
              onCalculate={handleCalculate} 
            />

          </div>
        </div>
        
        {/* Price Breakdown */}
        <div className="lg:col-span-1">
          <PriceBreakdown calculation={calculationResult} selectedYarn={selectedYarn} />
        </div>
      </div>
      <div className="mt-6 rounded-lg bg-white p-5 shadow">
        <h3 className="mb-4 font-medium text-lg">Saved calculations</h3>
        {calculationsError ? (
          <p role="alert" className="text-sm text-red-600">Could not load saved calculations. Please try again.</p>
        ) : calculationsLoading ? (
          <p className="text-sm text-neutral-500">Loading saved calculations…</p>
        ) : calculations.length === 0 ? (
          <p className="text-sm text-neutral-500">No price calculations have been saved yet. Calculations are saved when you select Calculate Price.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {calculations.slice(0, 10).map((calculation) => (
              <li key={calculation.id}>
                <button
                  type="button"
                  onClick={() => showCalculation(calculation)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-neutral-50"
                >
                  <span>
                    <span className="block font-medium text-neutral-900">{calculation.itemName}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(String(calculation.createdAt)).toLocaleString()} · {calculation.ballsUsed} balls · {calculation.laborHours} hours
                    </span>
                  </span>
                  <span className="font-semibold">{formatCurrency(calculation.finalPrice)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
