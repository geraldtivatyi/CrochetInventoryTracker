import { useState } from "react";
import { Project } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { categoryColor } from "@/lib/utils";
import { Link } from "wouter";

type ProjectCardProps = {
  project: Project;
  estimatedPrice: number;
  onEdit: (project: Project) => void;
};

export default function ProjectCard({ project, estimatedPrice, onEdit }: ProjectCardProps) {
  return (
    <Card className="bg-white rounded-lg shadow overflow-hidden">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-lg">{project.name}</h3>
          <div className={`text-xs font-bold px-2 py-1 rounded ${categoryColor(project.category)}`}>
            {project.category.charAt(0).toUpperCase() + project.category.slice(1)}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-neutral-600 text-sm">Materials:</span>
            <span className="text-sm">{project.ballsNeeded} balls</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 text-sm">Time to make:</span>
            <span className="text-sm">{project.timeToMake} hours</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600 text-sm">Estimated cost:</span>
            <span className="font-medium">${estimatedPrice.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between">
          <Button
            variant="link"
            className="text-accent-500 hover:text-accent-700 p-0 h-auto"
            onClick={() => onEdit(project)}
          >
            <i className="ri-pencil-line mr-1"></i> Edit
          </Button>
          <Link href={`/calculator?project=${project.id}`}>
            <Button
              variant="link"
              className="text-primary-500 hover:text-primary-700 p-0 h-auto"
            >
              <i className="ri-calculator-line mr-1"></i> Calculate
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
