import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import SummaryCard from "@/components/dashboard/summary-card";
import ActivityItem from "@/components/dashboard/activity-item";
import LowStockTable from "@/components/dashboard/low-stock-table";
import { ActivityLog, Yarn } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

// Dashboard summary type from the API
type DashboardSummary = {
  dataPersistence: "database" | "memory";
  totalYarns: number;
  totalStockBalls: number;
  totalProjects: number;
  averagePrice: number | null;
  pricingCalculationCount: number;
  recentActivities: ActivityLog[];
  lowStockYarns: Yarn[];
};

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch dashboard data
  const { data: dashboard, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard'],
    staleTime: 0,
  });

  // Handle restock action for low stock yarns
  const handleRestock = async (id: number) => {
    try {
      const yarn = dashboard?.lowStockYarns.find(y => y.id === id);
      if (yarn) {
        // Update the stock quantity by adding 5 balls
        await apiRequest("PATCH", `/api/yarns/${id}`, {
          quantityInStock: yarn.quantityInStock + 5,
          adjustmentReason: "Dashboard stock adjustment",
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        
        toast({
          title: "Stock updated",
          description: `Added 5 balls to ${yarn.type} - ${yarn.color}. This updates your inventory only; it doesn't place a supplier order.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restock yarn.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse">
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Error loading dashboard data. Please try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-poppins font-semibold text-xl mb-4">Dashboard</h2>
      {dashboard?.dataPersistence === "memory" && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The app is running without a database. Changes are held in memory and will be lost when the server restarts.
          Configure DATABASE_URL to use persistent data.
        </p>
      )}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Inventory"
          value={dashboard?.totalYarns || 0}
          subtext="Total yarn varieties"
          icon="ri-archive-line"
          iconColor="text-primary-500"
          footer={{
            text: `${dashboard?.totalStockBalls || 0} balls currently in stock`,
            color: "text-neutral-600"
          }}
        />
        
        <SummaryCard
          title="Projects"
          value={dashboard?.totalProjects || 0}
          subtext="Active project templates"
          icon="ri-scissors-line"
          iconColor="text-primary-500"
          footer={{
            text: "Saved project templates",
            color: "text-neutral-600"
          }}
        />
        
        <SummaryCard
          title="Pricing estimates"
          value={dashboard?.averagePrice === null || dashboard?.averagePrice === undefined
            ? "—"
            : formatCurrency(dashboard.averagePrice)}
          subtext="Average calculated price"
          icon="ri-price-tag-3-line"
          iconColor="text-primary-500"
          footer={{
            text: dashboard?.pricingCalculationCount
              ? `Based on ${dashboard.pricingCalculationCount} saved calculation${dashboard.pricingCalculationCount === 1 ? "" : "s"}`
              : "No saved pricing calculations yet",
            color: "text-neutral-600"
          }}
        />
      </div>
      
      {/* Recent Activity */}
      <Card className="bg-white rounded-lg shadow mb-6">
        <CardContent className="p-5">
          <h3 className="font-medium text-neutral-700 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {dashboard?.recentActivities && dashboard.recentActivities.length > 0 ? (
              dashboard.recentActivities.map(activity => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-neutral-500 py-4 text-center">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Low Stock Alert */}
      <Card className="bg-white rounded-lg shadow">
        <CardContent className="p-5">
          <h3 className="font-medium text-neutral-700 mb-4">Low Stock Alert (5 balls or fewer)</h3>
          <LowStockTable 
            yarns={dashboard?.lowStockYarns || []} 
            onRestock={handleRestock} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
