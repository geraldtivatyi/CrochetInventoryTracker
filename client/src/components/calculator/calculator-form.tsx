import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPriceCalculationSchema } from "@shared/schema";
import { Project, Yarn, PriceCalculation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Extend the schema with additional validation
const calculatorFormSchema = insertPriceCalculationSchema.extend({
  itemName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  ballsUsed: z.number().int().min(1, { message: "Must use at least 1 ball" }),
  laborHours: z.number().min(0.5, { message: "Time must be at least 0.5 hours" }),
  hourlyRate: z.number().min(1, { message: "Hourly rate must be at least R1" }),
  markupPercentage: z.number().min(0, { message: "Markup cannot be negative" }).max(300, { message: "Markup cannot exceed 300%" }),
});

type CalculatorFormValues = z.infer<typeof calculatorFormSchema>;

type CalculatorFormProps = {
  initialProject?: number;
  onCalculate: (calculation: PriceCalculation) => void;
};

export default function CalculatorForm({ initialProject, onCalculate }: CalculatorFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch projects for the dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  // Fetch yarns for the dropdown
  const { data: yarns = [] } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });
  
  // Initialize form with defaults
  const form = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues: {
      itemName: "",
      projectId: 0,
      yarnId: 0,
      ballsUsed: 1,
      additionalCosts: 0,
      laborHours: 1,
      hourlyRate: 225,
      markupPercentage: 40,
      roundToNearest: false
    },
  });
  
  // If an initial project was provided, load that project's data
  useEffect(() => {
    if (initialProject && projects.length > 0) {
      const project = projects.find(p => p.id === initialProject);
      if (project) {
        form.reset({
          ...form.getValues(),
          projectId: project.id,
          itemName: project.name,
          ballsUsed: project.ballsNeeded,
          laborHours: project.timeToMake,
          // Find a matching yarn if there's a preferred type
          yarnId: project.preferredYarnType 
            ? yarns.find(y => y.type === project.preferredYarnType)?.id || 0 
            : 0
        });
      }
    }
  }, [initialProject, projects, yarns, form]);
  
  const handleSubmit = async (values: CalculatorFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiRequest("POST", "/api/calculations", values);
      const calculation = await result.json();
      onCalculate(calculation);
      toast({
        title: "Price calculated",
        description: `The price for ${values.itemName} has been calculated`,
      });
    } catch (error) {
      console.error("Error calculating price:", error);
      toast({
        title: "Error",
        description: "There was a problem calculating the price",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // When a project is selected, load its data
  const handleProjectChange = (projectId: string) => {
    if (projectId) {
      const id = parseInt(projectId);
      const project = projects.find(p => p.id === id);
      if (project) {
        form.setValue("projectId", id);
        form.setValue("itemName", project.name);
        form.setValue("ballsUsed", project.ballsNeeded);
        form.setValue("laborHours", project.timeToMake);
        
        // If the project has a preferred yarn type, try to select it
        if (project.preferredYarnType) {
          const matchingYarn = yarns.find(y => y.type === project.preferredYarnType);
          if (matchingYarn) {
            form.setValue("yarnId", matchingYarn.id);
          }
        }
      }
    } else {
      // Reset fields if "Create new calculation" is selected
      form.setValue("projectId", 0);
      form.setValue("itemName", "");
      form.setValue("ballsUsed", 1);
      form.setValue("laborHours", 1);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="calc-project">Select Project</FormLabel>
                <Select
                  onValueChange={(value) => handleProjectChange(value)}
                  value={field.value ? field.value.toString() : ""}
                >
                  <FormControl>
                    <SelectTrigger id="calc-project">
                      <SelectValue placeholder="Create new calculation" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Create new calculation</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="itemName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="calc-name">Item Name</FormLabel>
                <FormControl>
                  <Input 
                    id="calc-name" 
                    placeholder="Custom item name" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
          <h4 className="font-medium text-sm text-neutral-700 mb-3">Material Costs</h4>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="yarnId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="calc-yarn">Yarn Type</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                    value={field.value ? field.value.toString() : ""}
                  >
                    <FormControl>
                      <SelectTrigger id="calc-yarn">
                        <SelectValue placeholder="Select yarn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Select yarn</SelectItem>
                      {yarns.map((yarn) => (
                        <SelectItem key={yarn.id} value={yarn.id.toString()}>
                          {yarn.type} - {yarn.color} (${yarn.costPerBall.toFixed(2)}/ball)
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
                name="ballsUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="calc-balls">Balls Required</FormLabel>
                    <FormControl>
                      <Input 
                        id="calc-balls" 
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Number of balls"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="additionalCosts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="calc-additional">Additional Materials Cost</FormLabel>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-neutral-500">$</span>
                      </div>
                      <FormControl>
                        <Input 
                          id="calc-additional" 
                          className="pl-7"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
          <h4 className="font-medium text-sm text-neutral-700 mb-3">Labor Costs</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="laborHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="calc-hours">Time to Complete (hours)</FormLabel>
                  <FormControl>
                    <Input 
                      id="calc-hours" 
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="Hours"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.5)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="calc-rate">Hourly Rate</FormLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-neutral-500">$</span>
                    </div>
                    <FormControl>
                      <Input 
                        id="calc-rate" 
                        className="pl-7"
                        type="number"
                        step="0.50"
                        min="1"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
          <h4 className="font-medium text-sm text-neutral-700 mb-3">Pricing Strategy</h4>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="markupPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="calc-markup">Markup Percentage (%)</FormLabel>
                  <FormControl>
                    <Input 
                      id="calc-markup" 
                      type="number"
                      min="0"
                      max="300"
                      placeholder="%"
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
              name="roundToNearest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel htmlFor="calc-round" className="cursor-pointer">
                    Round to nearest $5
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Calculating..." : "Calculate Price"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
