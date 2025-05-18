import { Yarn } from "@shared/schema";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { stockStatusColor } from "@/lib/utils";

type LowStockTableProps = {
  yarns: Yarn[];
  onRestock: (id: number) => void;
};

export default function LowStockTable({ yarns, onRestock }: LowStockTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Yarn</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {yarns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-6 text-neutral-500">
                No low stock items found
              </TableCell>
            </TableRow>
          ) : (
            yarns.map((yarn) => (
              <TableRow key={yarn.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="text-sm font-medium text-neutral-900">{yarn.type}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center">
                    <span 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: yarn.colorHex }}
                    ></span>
                    <span className="text-sm">{yarn.color}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${stockStatusColor(yarn.quantityInStock)}`}>
                    {yarn.quantityInStock} balls
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button 
                    variant="link" 
                    className="text-accent-500 hover:text-accent-700 p-0 h-auto"
                    onClick={() => onRestock(yarn.id)}
                  >
                    Restock
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
