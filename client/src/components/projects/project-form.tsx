import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertProjectSchema } from "@shared/schema";
import { Project, Yarn } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import YarnForm from "@/components/inventory/yarn-form";

// Extend the project schema with additional validation
const projectFormSchema = insertProjectSchema.extend({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  category: z.string().min(1, { message: "Please select a category" }),
  ballsNeeded: z.number().int().min(1, { message: "Must need at least 1 ball" }),
  timeToMake: z.number().min(0.5, { message: "Time must be at least 0.5 hours" }),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

type ProjectFormProps = {
  project?: Project;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ProjectForm({ project, onClose, onSuccess }: ProjectFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddYarnDialogOpen, setIsAddYarnDialogOpen] = useState(false);
  
  // Fetch all yarns for the yarn type dropdown
  const { data: yarns = [], isError: yarnsError } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });

  // Handle yarn form success
  const handleYarnFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/yarns'] });
    setIsAddYarnDialogOpen(false);
    toast({
      title: "Yarn added",
      description: "New yarn has been added to inventory and is now available for selection",
    });
  };
  
  // Initialize form with existing project data or defaults
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: project 
      ? { ...project } 
      : {
          name: "",
          category: "",
          ballsNeeded: 0,
          preferredYarnType: "",
          timeToMake: 0,
          notes: "",
        },
  });
  
  const handleSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      if (project) {
        // Update existing project
        await apiRequest("PATCH", `/api/projects/${project.id}`, values);
        toast({
          title: "Project updated",
          description: `${values.name} has been updated`,
        });
      } else {
        // Create new project
        await apiRequest("POST", "/api/projects", values);
        toast({
          title: "Project created",
          description: `${values.name} has been added`,
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving project:", error);
      toast({
        title: "Error",
        description: "There was a problem saving the project",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const categoryOptions = [
    { value: "accessory", label: "Accessory" },
    { value: "clothing", label: "Clothing" },
    { value: "home", label: "Home" },
    { value: "toy", label: "Toy" },
    { value: "other", label: "Other" },
  ];
  
  return (
    <div className="p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {yarnsError && (
            <p role="alert" className="text-sm text-red-600">
              Could not load your saved yarn inventory. Project details can still be saved, but preferred yarn selection is unavailable.
            </p>
          )}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="project-name">Project Name</FormLabel>
                <FormControl>
                  <Input 
                    id="project-name" 
                    placeholder="e.g. Winter Scarf, Baby Blanket" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="project-category">Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger id="project-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ballsNeeded"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="balls-needed">Balls of Yarn Needed</FormLabel>
                  <FormControl>
                    <Input 
                      id="balls-needed" 
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Number of balls"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="preferredYarnType"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel htmlFor="project-yarn">Preferred Yarn</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddYarnDialogOpen(true)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      + Add Yarn
                    </Button>
                  </div>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger id="project-yarn">
                        <SelectValue placeholder="Select yarn type and color" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No preference</SelectItem>
                      {yarns.map((yarn) => (
                        <SelectItem key={`${yarn.type}-${yarn.color}`} value={`${yarn.type} - ${yarn.color}`}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full border border-neutral-300"
                              style={{ backgroundColor: yarn.colorHex }}
                            />
                            <span>{yarn.type} - {yarn.color}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="timeToMake"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="time-to-make">Time to Make (hours)</FormLabel>
                <FormControl>
                  <Input 
                    id="time-to-make" 
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="Estimated hours"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="project-notes">Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    id="project-notes" 
                    placeholder="Any additional information..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-end space-x-3 pt-6 border-t border-neutral-200 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {isSubmitting ? "Saving..." : project ? "Update Project" : "Save Project"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Add Yarn Dialog */}
      <Dialog open={isAddYarnDialogOpen} onOpenChange={setIsAddYarnDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Yarn to Inventory</DialogTitle>
          </DialogHeader>
          <YarnForm 
            onClose={() => setIsAddYarnDialogOpen(false)} 
            onSuccess={handleYarnFormSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
