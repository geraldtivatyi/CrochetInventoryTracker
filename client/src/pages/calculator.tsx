import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import CalculatorForm from "@/components/calculator/calculator-form";
import PriceBreakdown from "@/components/calculator/price-breakdown";
import { PriceCalculation, Yarn } from "@shared/schema";

export default function Calculator() {
  const [location] = useLocation();
  const [calculationResult, setCalculationResult] = useState<PriceCalculation | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedYarn, setSelectedYarn] = useState<{ type: string; color: string } | null>(null);

  // Parse query parameters to get project ID if any
  useEffect(() => {
    console.log("Calculator page - Full location:", location);
    console.log("Calculator page - window.location.search:", window.location.search);
    
    // Use window.location.search directly as wouter might not include query params
    const queryString = window.location.search.slice(1); // Remove the '?' 
    console.log("Calculator page - Query string:", queryString);
    const params = new URLSearchParams(queryString);
    const projectId = params.get('project');
    console.log("Calculator page - Project ID from URL:", projectId);
    if (projectId) {
      console.log("Calculator page - Setting selected project ID:", parseInt(projectId));
      setSelectedProjectId(parseInt(projectId));
    }
  }, [location]);

  // Fetch yarns to find selected yarn details
  const { data: yarns = [] } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });

  // When calculation is complete, find the yarn details if a yarn was selected
  const handleCalculate = (calculation: PriceCalculation) => {
    console.log("Calculator page received calculation:", calculation);
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
            {selectedProjectId && (
              <div className="mt-2 text-xs text-blue-600">
                Debug: Loading project ID {selectedProjectId}
              </div>
            )}
          </div>
        </div>
        
        {/* Price Breakdown */}
        <div className="lg:col-span-1">
          <PriceBreakdown calculation={calculationResult} selectedYarn={selectedYarn} />
        </div>
      </div>
    </div>
  );
}
