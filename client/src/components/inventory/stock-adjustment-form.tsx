import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stockAdjustmentSchema = z.object({
  adjustmentType: z.enum(["add", "remove", "set"]),
  quantity: z.number().int().min(1, { message: "Quantity must be at least 1" }),
  reason: z.string().min(2, { message: "Please provide a reason for the adjustment" }),
});

type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

type StockAdjustmentFormProps = {
  yarn: Yarn;
  onClose: () => void;
  onSuccess: () => void;
};

export default function StockAdjustmentForm({ yarn, onClose, onSuccess }: StockAdjustmentFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      adjustmentType: "add",
      quantity: 1,
      reason: "",
    },
  });
  
  const handleSubmit = async (values: StockAdjustmentValues) => {
    setIsSubmitting(true);
    try {
      let newQuantity = yarn.quantityInStock;
      
      switch (values.adjustmentType) {
        case "add":
          newQuantity = yarn.quantityInStock + values.quantity;
          break;
        case "remove":
          newQuantity = Math.max(0, yarn.quantityInStock - values.quantity);
          break;
        case "set":
          newQuantity = values.quantity;
          break;
      }
      
      // Update the yarn stock
      await apiRequest("PATCH", `/api/yarns/${yarn.id}`, {
        quantityInStock: newQuantity
      });
      
      // Log the activity
      const actionText = values.adjustmentType === "add" ? "Added" : 
                        values.adjustmentType === "remove" ? "Removed" : "Set";
      
      toast({
        title: "Stock updated",
        description: `${actionText} ${values.quantity} balls for ${yarn.type} - ${yarn.color}. Reason: ${values.reason}`,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast({
        title: "Error",
        description: "There was a problem updating the stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const adjustmentType = form.watch("adjustmentType");
  const quantity = form.watch("quantity");
  
  const calculateNewStock = () => {
    switch (adjustmentType) {
      case "add":
        return yarn.quantityInStock + (quantity || 0);
      case "remove":
        return Math.max(0, yarn.quantityInStock - (quantity || 0));
      case "set":
        return quantity || 0;
      default:
        return yarn.quantityInStock;
    }
  };
  
  return (
    <div className="p-5">
      <div className="mb-4 p-3 bg-neutral-50 rounded-md">
        <div className="flex items-center space-x-3">
          <span 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: yarn.colorHex }}
          ></span>
          <div>
            <h3 className="font-medium">{yarn.type} - {yarn.color}</h3>
            <p className="text-sm text-neutral-600">Current stock: {yarn.quantityInStock} balls</p>
          </div>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="adjustmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="adjustment-type">Adjustment Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger id="adjustment-type">
                      <SelectValue placeholder="Select adjustment type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="add">Add Stock</SelectItem>
                    <SelectItem value="remove">Remove Stock</SelectItem>
                    <SelectItem value="set">Set Stock Level</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="quantity">
                  {adjustmentType === "set" ? "New Stock Level" : "Quantity"}
                </FormLabel>
                <FormControl>
                  <Input 
                    id="quantity" 
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter quantity"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {quantity > 0 && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm font-medium text-blue-800">
                New stock level: {calculateNewStock()} balls
              </p>
            </div>
          )}
          
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="reason">Reason for Adjustment</FormLabel>
                <FormControl>
                  <Textarea 
                    id="reason" 
                    placeholder="e.g. Received new shipment, Used for project, Inventory correction..."
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
              {isSubmitting ? "Updating..." : "Update Stock"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}