import { useState } from "react";
import { Project, Yarn } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { categoryColor } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type ProjectCardProps = {
  project: Project;
  onEdit: (project: Project) => void;
};

export default function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [, setLocation] = useLocation();

  // Fetch yarns to get color information
  const { data: yarns = [], isLoading: yarnsLoading, isError: yarnsError } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });

  // Find matching yarn for color display
  const matchingYarn = project.preferredYarnType 
    ? yarns.find(y => 
        project.preferredYarnType === `${y.type} - ${y.color}` || 
        project.preferredYarnType === y.type
      )
    : null;

  const handleDeleteClick = () => {
    setDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await apiRequest("DELETE", `/api/projects/${project.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      toast({
        title: "Project deleted",
        description: `${project.name} has been removed from projects`,
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "There was a problem deleting the project",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-medium text-lg text-neutral-900">{project.name}</h3>
            <div className={`text-xs font-bold px-2 py-1 rounded ${categoryColor(project.category)}`}>
              {project.category.charAt(0).toUpperCase() + project.category.slice(1)}
            </div>
          </div>
          
          {project.preferredYarnType && (
            <div className="text-sm text-neutral-600 mb-3 flex items-center space-x-2">
              <span>Preferred:</span>
              {matchingYarn ? (
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full border border-neutral-300"
                    style={{ backgroundColor: matchingYarn.colorHex }}
                  />
                  <span className="font-medium">{matchingYarn.type} - {matchingYarn.color}</span>
                </div>
              ) : yarnsLoading ? (
                <span className="font-medium text-neutral-500">Loading inventory…</span>
              ) : yarnsError ? (
                <span className="font-medium text-red-600">Inventory unavailable</span>
              ) : (
                <span className="font-medium text-amber-600">{project.preferredYarnType} (not in inventory)</span>
              )}
            </div>
          )}
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-600 text-sm">Materials:</span>
              <span className="text-sm font-medium">{project.ballsNeeded} balls</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600 text-sm">Time to make:</span>
              <span className="text-sm font-medium">{project.timeToMake} hours</span>
            </div>
          </div>
          
          {project.notes && (
            <div className="mt-3 text-xs text-neutral-500 italic">
              {project.notes}
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-neutral-200 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50 flex-1"
              onClick={() => onEdit(project)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-1"
              onClick={() => {
                setLocation(`/calculator?project=${project.id}`);
              }}
            >
              Calculate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDeleteClick}
              disabled={deleting}
            >
              {deleting ? "..." : "Delete"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        variant="destructive"
      />
    </>
  );
}
