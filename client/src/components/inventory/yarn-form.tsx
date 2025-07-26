import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertYarnSchema } from "@shared/schema";
import { Yarn } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

// Extend the yarn schema with additional validation
const yarnFormSchema = insertYarnSchema.extend({
  type: z.string().min(2, { message: "Type must be at least 2 characters" }),
  color: z.string().min(2, { message: "Color must be at least 2 characters" }),
  costPerBall: z.number().min(0.01, { message: "Cost must be greater than 0" }),
  quantityInStock: z.number().int().min(0, { message: "Stock cannot be negative" }),
});

type YarnFormValues = z.infer<typeof yarnFormSchema>;

type YarnFormProps = {
  yarn?: Yarn;
  onClose: () => void;
  onSuccess: () => void;
};

export default function YarnForm({ yarn, onClose, onSuccess }: YarnFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form with existing yarn data or defaults
  const form = useForm<YarnFormValues>({
    resolver: zodResolver(yarnFormSchema),
    defaultValues: yarn 
      ? { ...yarn } 
      : {
          type: "",
          color: "",
          colorHex: "#B22222", // Default to a red color
          costPerBall: 95.00,
          quantityInStock: 0,
          notes: "",
        },
  });
  
  const handleSubmit = async (values: YarnFormValues) => {
    setIsSubmitting(true);
    try {
      if (yarn) {
        // Update existing yarn
        await apiRequest("PATCH", `/api/yarns/${yarn.id}`, values);
        toast({
          title: "Yarn updated",
          description: `${values.type} - ${values.color} has been updated`,
        });
      } else {
        // Create new yarn
        await apiRequest("POST", "/api/yarns", values);
        toast({
          title: "Yarn added",
          description: `${values.type} - ${values.color} has been added to inventory`,
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving yarn:", error);
      toast({
        title: "Error",
        description: "There was a problem saving the yarn",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="yarn-type">Yarn Type</FormLabel>
                <FormControl>
                  <Input 
                    id="yarn-type" 
                    placeholder="e.g. Merino Wool, Cotton Blend" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="yarn-color">Color</FormLabel>
                  <FormControl>
                    <Input 
                      id="yarn-color" 
                      placeholder="e.g. Crimson Red, Sky Blue" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="colorHex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="color-picker">Color Hex</FormLabel>
                  <div className="flex">
                    <FormControl>
                      <Input 
                        id="color-hex" 
                        className="w-3/4"
                        {...field} 
                      />
                    </FormControl>
                    <div className="ml-2 w-10 h-10 border border-neutral-300 rounded-md overflow-hidden">
                      <input 
                        type="color" 
                        id="color-picker" 
                        className="w-full h-full cursor-pointer"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="costPerBall"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="cost-per-ball">Cost Per Ball</FormLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-neutral-500">$</span>
                    </div>
                    <FormControl>
                      <Input 
                        id="cost-per-ball" 
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
            
            <FormField
              control={form.control}
              name="quantityInStock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="stock-quantity">Quantity in Stock</FormLabel>
                  <FormControl>
                    <Input 
                      id="stock-quantity" 
                      type="number"
                      min="0"
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
          </div>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="yarn-notes">Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    id="yarn-notes" 
                    placeholder="Any additional information..."
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : yarn ? "Update Yarn" : "Save Yarn"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
