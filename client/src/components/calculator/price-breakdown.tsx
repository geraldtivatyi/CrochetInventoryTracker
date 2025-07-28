import { PriceCalculation, Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PriceBreakdownProps = {
  calculation: PriceCalculation | null;
  selectedYarn?: { type: string; color: string } | null;
};

export default function PriceBreakdown({ calculation, selectedYarn }: PriceBreakdownProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [updatingProject, setUpdatingProject] = useState(false);

  // Fetch projects to get current project data
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const currentProject = calculation?.projectId 
    ? projects.find(p => p.id === calculation.projectId)
    : null;
  
  const handleSave = () => {
    // In a real app, this would save the calculation to a "saved calculations" list
    toast({
      title: "Calculation saved",
      description: "The price calculation has been saved to your records",
    });
  };

  const handleUpdateProject = async () => {
    if (!calculation || !currentProject) return;
    
    setUpdatingProject(true);
    try {
      // Update the project with the new calculated values
      const updatedProject = {
        ...currentProject,
        ballsNeeded: calculation.ballsUsed,
        timeToMake: calculation.laborHours,
        // Store the calculated price in project notes or a new field
        notes: `Calculated price: ${formatCurrency(calculation.finalPrice)}${currentProject.notes ? ` | ${currentProject.notes}` : ''}`
      };

      await apiRequest("PATCH", `/api/projects/${currentProject.id}`, updatedProject);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      
      toast({
        title: "Project updated",
        description: `${currentProject.name} has been updated with the calculated pricing`,
      });
      
      // Redirect to projects page after 1 second
      setTimeout(() => {
        setLocation('/projects');
      }, 1000);
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "There was a problem updating the project",
        variant: "destructive",
      });
    } finally {
      setUpdatingProject(false);
    }
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
        
        {/* Prominent Recommended Sale Price */}
        <div className="mt-6 p-5 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white text-center">
          <p className="text-sm font-medium opacity-90 mb-2">Recommended Sale Price</p>
          <p className="text-4xl font-bold mb-1">{formatCurrency(calculation.finalPrice)}</p>
          <p className="text-xs opacity-80">
            {calculation.roundToNearest ? 'Rounded to nearest R5' : 'Includes materials, labor & markup'}
          </p>
        </div>
        
        <div className="mt-6 space-y-3">
          {currentProject && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleUpdateProject}
              disabled={updatingProject}
            >
              {updatingProject ? (
                "Updating..."
              ) : (
                <>
                  <i className="ri-refresh-line mr-1"></i> Update Project Pricing
                </>
              )}
            </Button>
          )}
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
