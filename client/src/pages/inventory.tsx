import { useState, ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import YarnTable from "@/components/inventory/yarn-table";
import YarnForm from "@/components/inventory/yarn-form";
import { Yarn } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export default function Inventory() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentYarn, setCurrentYarn] = useState<Yarn | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");

  // Fetch all yarns
  const { data: yarns = [], isLoading, error } = useQuery<Yarn[]>({
    queryKey: ['/api/yarns'],
  });

  // Handle search input change
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  // Filter and sort yarns based on user selections
  const filteredYarns = yarns.filter(yarn => {
    const matchesSearch = yarn.type.toLowerCase().includes(searchTerm) || 
                          yarn.color.toLowerCase().includes(searchTerm);
    
    const matchesColor = colorFilter === "" || getColorCategory(yarn.colorHex) === colorFilter;
    
    return matchesSearch && matchesColor;
  }).sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.type.localeCompare(b.type);
      case "price-low":
        return a.costPerBall - b.costPerBall;
      case "price-high":
        return b.costPerBall - a.costPerBall;
      case "stock-low":
        return a.quantityInStock - b.quantityInStock;
      case "stock-high":
        return b.quantityInStock - a.quantityInStock;
      default:
        return 0;
    }
  });

  // Function to categorize color by hex code
  function getColorCategory(hex: string): string {
    // Simple color categorization based on hex value
    hex = hex.toLowerCase();
    if (hex.startsWith("#f") || hex.startsWith("#e") || hex.startsWith("#d")) return "light";
    if (hex.includes("ff0000") || hex.includes("f00") || hex.includes("cc") || hex.includes("aa0000")) return "red";
    if (hex.includes("0000ff") || hex.includes("00f") || hex.includes("0000cc") || hex.includes("0000aa")) return "blue";
    if (hex.includes("00ff00") || hex.includes("0f0") || hex.includes("00cc00") || hex.includes("00aa00")) return "green";
    if (hex.includes("ffff00") || hex.includes("ff0") || hex.includes("cccc00") || hex.includes("aaaa00")) return "yellow";
    if (hex.includes("000") || hex.includes("111") || hex.includes("222") || hex.includes("333")) return "neutral";
    return "other";
  }

  // Handle edit button click
  const handleEditYarn = (yarn: Yarn) => {
    setCurrentYarn(yarn);
    setIsEditDialogOpen(true);
  };

  // Handle form success (both add and edit)
  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/yarns'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Refresh dashboard data too
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading yarn inventory...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading inventory. Please try again later.</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-poppins font-semibold text-xl">Yarn Inventory</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <i className="ri-add-line mr-1"></i> Add Yarn
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="bg-white rounded-lg shadow p-4 mb-6">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search-yarn" className="block text-sm font-medium text-neutral-700 mb-1">Search</label>
              <div className="relative">
                <Input
                  id="search-yarn"
                  className="pl-9"
                  placeholder="Search yarn..."
                  onChange={handleSearch}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <i className="ri-search-line text-neutral-400"></i>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="filter-color" className="block text-sm font-medium text-neutral-700 mb-1">Color</label>
              <Select
                value={colorFilter}
                onValueChange={setColorFilter}
              >
                <SelectTrigger id="filter-color">
                  <SelectValue placeholder="All Colors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Colors</SelectItem>
                  <SelectItem value="red">Reds</SelectItem>
                  <SelectItem value="blue">Blues</SelectItem>
                  <SelectItem value="green">Greens</SelectItem>
                  <SelectItem value="yellow">Yellows</SelectItem>
                  <SelectItem value="neutral">Neutrals</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-neutral-700 mb-1">Sort By</label>
              <Select
                value={sortBy}
                onValueChange={setSortBy}
              >
                <SelectTrigger id="sort-by">
                  <SelectValue placeholder="Name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="stock-low">Stock: Low to High</SelectItem>
                  <SelectItem value="stock-high">Stock: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="bg-white rounded-lg shadow overflow-hidden">
        <YarnTable yarns={filteredYarns} onEdit={handleEditYarn} />
        
        {/* Pagination (simplified) */}
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 sm:px-6">
          <nav className="flex items-center justify-between">
            <div className="hidden sm:block">
              <p className="text-sm text-neutral-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredYarns.length}</span> of <span className="font-medium">{yarns.length}</span> entries
              </p>
            </div>
            <div className="flex-1 flex justify-center sm:justify-end">
              <Button variant="outline" className="relative inline-flex items-center px-4 py-2" disabled>
                Previous
              </Button>
              <Button variant="outline" className="ml-3 relative inline-flex items-center px-4 py-2" disabled>
                Next
              </Button>
            </div>
          </nav>
        </div>
      </Card>

      {/* Add Yarn Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Yarn</DialogTitle>
          </DialogHeader>
          <YarnForm onClose={() => setIsAddDialogOpen(false)} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Yarn Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Yarn</DialogTitle>
          </DialogHeader>
          <YarnForm 
            yarn={currentYarn}
            onClose={() => setIsEditDialogOpen(false)} 
            onSuccess={handleFormSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
