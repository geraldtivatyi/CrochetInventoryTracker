import { useState } from "react";
import { Project, Yarn } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryColor } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ProjectCardProps = {
  project: Project;
  yarns: Yarn[];
  onEdit: (project: Project) => void;
};

export default function ProjectCard({ project, yarns, onEdit }: ProjectCardProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [completeDialog, setCompleteDialog] = useState(false);
  const [ballsUsed, setBallsUsed] = useState("0");
  const [, setLocation] = useLocation();

  const matchingYarn = (project.yarnId !== null
    ? yarns.find((yarn) => yarn.id === project.yarnId)
    : undefined) ??
    (project.yarnId === null && project.preferredYarnType
      ? yarns.find((yarn) => project.preferredYarnType === `${yarn.type} - ${yarn.color}` || project.preferredYarnType === yarn.type)
      : undefined);
  const available = matchingYarn ? matchingYarn.quantityInStock - matchingYarn.reservedQuantity : 0;
  const shortfall = project.ballsNeeded - available;
  const maxBallsUsed = project.reservedBalls + available;
  const statusLabel = project.status === "in_progress" ? "In progress" : project.status[0].toUpperCase() + project.status.slice(1);
  const statusClass = project.status === "completed"
    ? "bg-green-100 text-green-800"
    : project.status === "in_progress"
      ? "bg-blue-100 text-blue-800"
      : project.status === "cancelled"
        ? "bg-neutral-100 text-neutral-700"
        : "bg-amber-100 text-amber-800";

  const refreshProjectData = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/yarns"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const runAction = async (action: "start" | "cancel" | "complete", body?: { ballsUsed: number }) => {
    setBusy(true);
    try {
      await apiRequest("POST", `/api/projects/${project.id}/${action}`, body);
      refreshProjectData();
      setCancelDialog(false);
      setCompleteDialog(false);
      toast({
        title: action === "start" ? "Project started" : action === "complete" ? "Project completed" : "Project cancelled",
        description: action === "start"
          ? `${project.name} is in progress and its yarn has been reserved.`
          : action === "complete"
            ? `${project.name} is complete and inventory has been updated.`
            : `Any yarn reserved for ${project.name} has been released.`,
      });
    } catch (error) {
      toast({
        title: "Could not update project",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await apiRequest("DELETE", `/api/projects/${project.id}`);
      refreshProjectData();
      toast({
        title: "Project deleted",
        description: `${project.name} has been removed${project.status === "in_progress" ? " and its reserved yarn returned to available stock" : ""}.`,
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "There was a problem deleting the project",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
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
          <div className="mb-3">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
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
              ) : (
                <span className="font-medium text-amber-600">{project.preferredYarnType} (not in inventory)</span>
              )}
            </div>
          )}
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-600 text-sm">Estimated materials:</span>
              <span className="text-sm font-medium">{project.ballsNeeded} balls</span>
            </div>
            {project.status === "in_progress" && (
              <div className="flex justify-between">
                <span className="text-neutral-600 text-sm">Reserved for this project:</span>
                <span className="text-sm font-medium">{project.reservedBalls} balls</span>
              </div>
            )}
            {project.status === "completed" && project.ballsUsed !== null && (
              <div className="flex justify-between">
                <span className="text-neutral-600 text-sm">Yarn used:</span>
                <span className="text-sm font-medium">{project.ballsUsed} balls</span>
              </div>
            )}
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
          
          {project.status === "pending" && matchingYarn && shortfall > 0 && (
            <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              You’ll need {shortfall} more {matchingYarn.type} - {matchingYarn.color} ball{shortfall === 1 ? "" : "s"} before starting.
            </p>
          )}
          {project.status === "in_progress" && matchingYarn && (
            <p className="mt-3 rounded-md bg-blue-50 p-2 text-xs text-blue-800">
              {project.reservedBalls} ball{project.reservedBalls === 1 ? " is" : "s are"} reserved and unavailable to other projects.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
            {project.status === "pending" && (
              <>
                <Button variant="outline" size="sm" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => onEdit(project)} disabled={busy}>Edit</Button>
                <Button size="sm" onClick={() => void runAction("start")} disabled={busy || (!!matchingYarn && shortfall > 0)}>
                  {busy ? "Working…" : "Start project"}
                </Button>
              </>
            )}
            {project.status === "in_progress" && (
              <Button size="sm" onClick={() => {
                setBallsUsed(project.reservedBalls.toString());
                setCompleteDialog(true);
              }} disabled={busy}>Complete project</Button>
            )}
            {(project.status === "pending" || project.status === "in_progress") && (
              <Button variant="outline" size="sm" onClick={() => setCancelDialog(true)} disabled={busy}>Cancel project</Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => setLocation(`/calculator?project=${project.id}`)}
            >
              Calculate
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeleteClick} disabled={busy}>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"?${project.status === "in_progress" ? " Its reserved yarn will be returned to available stock." : ""} This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        isLoading={busy}
        variant="destructive"
      />
      <ConfirmationDialog
        open={cancelDialog}
        onOpenChange={setCancelDialog}
        title="Cancel Project"
        description={`Cancel "${project.name}"?${project.status === "in_progress" ? " Its yarn reservation will be released." : ""}`}
        confirmText="Cancel project"
        cancelText="Keep project"
        onConfirm={() => void runAction("cancel")}
        isLoading={busy}
        variant="destructive"
      />
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete {project.name}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            const used = Number(ballsUsed);
            if (!Number.isSafeInteger(used) || used < 0 || used > maxBallsUsed) {
              toast({
                title: "Check yarn used",
                description: `Enter a whole number between 0 and ${maxBallsUsed}.`,
                variant: "destructive",
              });
              return;
            }
            void runAction("complete", { ballsUsed: used });
          }}>
            {matchingYarn ? (
              <>
                <label htmlFor={`balls-used-${project.id}`} className="block text-sm font-medium">
                  Balls of {matchingYarn.type} - {matchingYarn.color} actually used
                </label>
                <Input id={`balls-used-${project.id}`} type="number" min="0" max={maxBallsUsed} step="1" value={ballsUsed} onChange={(event) => setBallsUsed(event.target.value)} required />
                <p className="text-xs text-neutral-600">
                  {project.reservedBalls} reserved; up to {maxBallsUsed} can be recorded. Any unused reserved balls return to available stock.
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-600">This project has no yarn selected from inventory. No stock will be adjusted.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompleteDialog(false)} disabled={busy}>Back</Button>
              <Button type="submit" disabled={busy}>{busy ? "Completing…" : "Complete project"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
