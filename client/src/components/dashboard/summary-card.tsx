import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type SummaryCardProps = {
  title: string;
  value: string | number;
  subtext: string;
  icon: string;
  iconColor: string;
  footer?: {
    text: string;
    icon?: string;
    color?: string;
  };
  isCurrency?: boolean;
};

export default function SummaryCard({
  title,
  value,
  subtext,
  icon,
  iconColor,
  footer,
  isCurrency = false,
}: SummaryCardProps) {
  return (
    <Card className="bg-white rounded-lg shadow">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-neutral-700">{title}</h3>
          <i className={`${icon} ${iconColor} text-xl`}></i>
        </div>
        <p className="text-2xl font-semibold">
          {isCurrency ? formatCurrency(Number(value)) : value}
        </p>
        <p className="text-sm text-neutral-600">{subtext}</p>
        {footer && (
          <div className="mt-2 text-xs">
            <span className={footer.color || "text-accent-600"}>
              {footer.icon && <i className={`${footer.icon} mr-1`}></i>}
              {footer.text}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
