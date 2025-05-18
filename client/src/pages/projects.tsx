import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectCard from "@/components/projects/project-card";
import ProjectForm from "@/components/projects/project-form";
import { Project, Yarn } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export default function Projects() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch yarns to calculate estimated prices
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

  // Calculate estimated price for a project
  const calculateEstimatedPrice = (project: Project): number => {
    // Find matching yarn by preferred type or use average cost
    let yarnCost = 0;
    if (project.preferredYarnType && yarns.length > 0) {
      const matchingYarn = yarns.find(y => y.type === project.preferredYarnType);
      if (matchingYarn) {
        yarnCost = matchingYarn.costPerBall;
      } else {
        // Use average yarn cost if preferred type not found
        yarnCost = yarns.reduce((sum, yarn) => sum + yarn.costPerBall, 0) / yarns.length;
      }
    } else if (yarns.length > 0) {
      // Use average yarn cost if no preferred type
      yarnCost = yarns.reduce((sum, yarn) => sum + yarn.costPerBall, 0) / yarns.length;
    } else {
      // Default cost if no yarns in inventory
      yarnCost = 5.00;
    }

    // Calculate material cost
    const materialCost = yarnCost * project.ballsNeeded;

    // Calculate labor cost (using default hourly rate of $12)
    const hourlyRate = 12;
    const laborCost = project.timeToMake * hourlyRate;

    // Calculate base cost
    const baseCost = materialCost + laborCost;

    // Apply default markup of 40%
    const markup = baseCost * 0.4;

    // Final price
    return baseCost + markup;
  };

  if (projectsLoading || yarnsLoading) {
    return <div className="p-8 text-center">Loading projects...</div>;
  }

  if (projectsError || yarnsError) {
    return <div className="p-8 text-center text-red-500">Error loading projects. Please try again later.</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-poppins font-semibold text-xl">Crochet Projects</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <i className="ri-add-line mr-1"></i> New Project
        </Button>
      </div>

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
              estimatedPrice={calculateEstimatedPrice(project)}
              onEdit={handleEditProject}
            />
          ))
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm onClose={() => setIsAddDialogOpen(false)} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
