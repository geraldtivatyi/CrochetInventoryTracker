import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center mb-2">
            <i className="ri-thread-line text-primary-500 text-3xl mr-2"></i>
            <span className="font-poppins font-bold text-2xl text-neutral-900">CrochetNook</span>
          </div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
