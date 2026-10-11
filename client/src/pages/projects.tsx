import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectCard from "@/components/projects/project-card";
import ProjectForm from "@/components/projects/project-form";
import { Project } from "@shared/schema";
import { Yarn } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Projects() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  const { data: yarns = [], isLoading: yarnsLoading, error: yarnsError } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });

  // Handle edit button click
  const handleEditProject = (project: Project) => {
    setCurrentProject(project);
    setIsEditDialogOpen(true);
  };

  // Handle form success (both add and edit)
  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Refresh dashboard data too
  };

  if (projectsLoading) {
    return <div className="p-8 text-center">Loading projects...</div>;
  }

  if (projectsError) {
    return <div className="p-8 text-center text-red-500">Error loading projects. Please try again later.</div>;
  }

  const totalProjects = projects.length;
  const avgTimeToMake = projects.length > 0 ? projects.reduce((sum, p) => sum + p.timeToMake, 0) / projects.length : 0;
  const totalBallsRequired = projects.filter((project) => project.status === "pending").reduce((sum, project) => sum + project.ballsNeeded, 0);
  const pendingDemand = new Map<number, number>();
  for (const project of projects) {
    if (project.status !== "pending" || project.yarnId === null) continue;
    pendingDemand.set(project.yarnId, (pendingDemand.get(project.yarnId) ?? 0) + project.ballsNeeded);
  }
  const yarnShortfalls = yarns.flatMap((yarn) => {
    const demand = pendingDemand.get(yarn.id) ?? 0;
    const available = yarn.quantityInStock - yarn.reservedQuantity;
    return demand > available ? [{ yarn, demand, available, shortfall: demand - available }] : [];
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-poppins font-semibold text-xl">Crochet Projects</h2>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium"
          size="lg"
        >
          + New Project
        </Button>
      </div>

      {/* Project Statistics */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">Total Projects</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{totalProjects}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">Avg. Time</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{avgTimeToMake.toFixed(1)}h</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">Yarn Required</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{totalBallsRequired} balls</div>
              <p className="text-xs text-neutral-500">Across pending projects</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!yarnsLoading && !yarnsError && yarnShortfalls.length > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950">
          <i className="ri-information-line text-amber-700"></i>
          <AlertDescription>
            <strong>A gentle stock reminder:</strong> If you start all your pending projects, you’ll need more yarn:
            {" "}{yarnShortfalls.map(({ yarn, demand, available, shortfall }) =>
              `${yarn.type} - ${yarn.color}: ${demand} needed, ${available} available (short ${shortfall})`,
            ).join("; ")}.
            Starting a project will reserve its yarn; you can add stock before starting projects that are short.
          </AlertDescription>
        </Alert>
      )}
      {yarnsError && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950">
          <AlertDescription>Inventory could not be loaded, so pending project yarn requirements can’t be compared with stock right now.</AlertDescription>
        </Alert>
      )}

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <div className="text-neutral-500">
              <i className="ri-scissors-line text-4xl mb-2"></i>
              <p>No projects created yet. Create your first project to get started!</p>
            </div>
          </div>
        ) : (
          projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              yarns={yarns}
              onEdit={handleEditProject}
            />
          ))
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm onClose={() => setIsAddDialogOpen(false)} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm 
            project={currentProject}
            onClose={() => setIsEditDialogOpen(false)} 
            onSuccess={handleFormSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
