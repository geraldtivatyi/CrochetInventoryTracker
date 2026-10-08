import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectCard from "@/components/projects/project-card";
import ProjectForm from "@/components/projects/project-form";
import { Project } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export default function Projects() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
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
  const totalBallsRequired = projects.reduce((sum, project) => sum + project.ballsNeeded, 0);

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
            </CardContent>
          </Card>
        </div>
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
