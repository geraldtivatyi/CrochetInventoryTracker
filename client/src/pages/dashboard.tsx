import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import SummaryCard from "@/components/dashboard/summary-card";
import ActivityItem from "@/components/dashboard/activity-item";
import LowStockTable from "@/components/dashboard/low-stock-table";
import { ActivityLog, Yarn } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Dashboard summary type from the API
type DashboardSummary = {
  totalYarns: number;
  totalProjects: number;
  averagePrice: number;
  newItems: number;
  mostProfitableProject: string;
  recommendedMarkup: number;
  recentActivities: ActivityLog[];
  lowStockYarns: Yarn[];
};

export default function Dashboard() {
  const { toast } = useToast();
  
  // Fetch dashboard data
  const { data: dashboard, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard'],
  });

  // Handle restock action for low stock yarns
  const handleRestock = async (id: number) => {
    try {
      const yarn = dashboard?.lowStockYarns.find(y => y.id === id);
      if (yarn) {
        // Update the stock quantity by adding 5 balls
        await apiRequest("PATCH", `/api/yarns/${id}`, {
          quantityInStock: yarn.quantityInStock + 5
        });
        
        toast({
          title: "Restock order placed",
          description: `5 balls of ${yarn.type} - ${yarn.color} have been ordered.`,
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
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Inventory"
          value={dashboard?.totalYarns || 0}
          subtext="Total yarn varieties"
          icon="ri-archive-line"
          iconColor="text-primary-500"
          footer={{
            text: `${dashboard?.newItems || 0} new items this month`,
            icon: "ri-arrow-up-line",
            color: "text-accent-600"
          }}
        />
        
        <SummaryCard
          title="Projects"
          value={dashboard?.totalProjects || 0}
          subtext="Active project templates"
          icon="ri-scissors-line"
          iconColor="text-primary-500"
          footer={{
            text: `Most profitable: ${dashboard?.mostProfitableProject || 'None'}`,
            color: "text-primary-600"
          }}
        />
        
        <SummaryCard
          title="Pricing"
          value={dashboard?.averagePrice || 0}
          subtext="Average item price"
          icon="ri-price-tag-3-line"
          iconColor="text-primary-500"
          footer={{
            text: `Recommended markup: ${dashboard?.recommendedMarkup || 0}%`,
            color: "text-accent-600"
          }}
          isCurrency={true}
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
          <h3 className="font-medium text-neutral-700 mb-4">Low Stock Alert</h3>
          <LowStockTable 
            yarns={dashboard?.lowStockYarns || []} 
            onRestock={handleRestock} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
