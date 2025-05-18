import {
  Yarn,
  InsertYarn,
  Project,
  InsertProject,
  PriceCalculation,
  InsertPriceCalculation,
  ActivityLog,
  InsertActivityLog
} from "@shared/schema";

export interface IStorage {
  // Yarn Methods
  getAllYarns(): Promise<Yarn[]>;
  getYarn(id: number): Promise<Yarn | undefined>;
  createYarn(yarn: InsertYarn): Promise<Yarn>;
  updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined>;
  deleteYarn(id: number): Promise<boolean>;
  getLowStockYarns(threshold: number): Promise<Yarn[]>;
  
  // Project Methods
  getAllProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Price Calculation Methods
  getAllCalculations(): Promise<PriceCalculation[]>;
  getCalculation(id: number): Promise<PriceCalculation | undefined>;
  createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation>;
  
  // Activity Log Methods
  getRecentActivity(limit: number): Promise<ActivityLog[]>;
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
}

export class MemStorage implements IStorage {
  private yarns: Map<number, Yarn>;
  private projects: Map<number, Project>;
  private calculations: Map<number, PriceCalculation>;
  private activities: Map<number, ActivityLog>;
  private yarnsCurrentId: number;
  private projectsCurrentId: number;
  private calculationsCurrentId: number;
  private activitiesCurrentId: number;

  constructor() {
    this.yarns = new Map();
    this.projects = new Map();
    this.calculations = new Map();
    this.activities = new Map();
    this.yarnsCurrentId = 1;
    this.projectsCurrentId = 1;
    this.calculationsCurrentId = 1;
    this.activitiesCurrentId = 1;

    // Add some initial data
    this.initializeData();
  }

  private initializeData() {
    // Sample yarns
    this.createYarn({
      type: "Merino Wool",
      color: "Crimson Red",
      colorHex: "#B22222",
      costPerBall: 6.99,
      quantityInStock: 12,
      notes: "Premium soft"
    });
    
    this.createYarn({
      type: "Cotton Blend",
      color: "Sky Blue",
      colorHex: "#87CEEB",
      costPerBall: 4.50,
      quantityInStock: 2,
      notes: "Lightweight"
    });
    
    this.createYarn({
      type: "Alpaca Wool",
      color: "Caramel",
      colorHex: "#C68E17",
      costPerBall: 8.25,
      quantityInStock: 3,
      notes: "Extra soft"
    });
    
    this.createYarn({
      type: "Chunky Acrylic",
      color: "Lavender",
      colorHex: "#B57EDC",
      costPerBall: 5.75,
      quantityInStock: 8,
      notes: "Bulky weight"
    });

    // Sample projects
    this.createProject({
      name: "Winter Scarf",
      category: "Accessory",
      ballsNeeded: 3,
      preferredYarnType: "Merino Wool",
      timeToMake: 5,
      notes: "Classic pattern"
    });
    
    this.createProject({
      name: "Baby Blanket",
      category: "Home",
      ballsNeeded: 8,
      preferredYarnType: "Cotton Blend",
      timeToMake: 12,
      notes: "Simple stitch pattern"
    });
    
    this.createProject({
      name: "Amigurumi Set",
      category: "Toy",
      ballsNeeded: 5,
      preferredYarnType: "Chunky Acrylic",
      timeToMake: 8,
      notes: "Set of 3 small animals"
    });

    // Sample activities
    this.logActivity({
      type: "add_yarn",
      entityId: 1,
      description: "Added new yarn: Merino Wool - Crimson Red"
    });
    
    this.logActivity({
      type: "update_project",
      entityId: 1,
      description: "Updated project: Winter Scarf"
    });
    
    this.logActivity({
      type: "calculate_price",
      entityId: 2,
      description: "Calculated price for: Baby Blanket"
    });
  }

  // Yarn methods
  async getAllYarns(): Promise<Yarn[]> {
    return Array.from(this.yarns.values());
  }

  async getYarn(id: number): Promise<Yarn | undefined> {
    return this.yarns.get(id);
  }

  async createYarn(yarn: InsertYarn): Promise<Yarn> {
    const id = this.yarnsCurrentId++;
    const newYarn: Yarn = { ...yarn, id };
    this.yarns.set(id, newYarn);
    return newYarn;
  }

  async updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined> {
    const existingYarn = this.yarns.get(id);
    if (!existingYarn) return undefined;

    const updatedYarn = { ...existingYarn, ...yarn };
    this.yarns.set(id, updatedYarn);
    return updatedYarn;
  }

  async deleteYarn(id: number): Promise<boolean> {
    return this.yarns.delete(id);
  }

  async getLowStockYarns(threshold: number): Promise<Yarn[]> {
    return Array.from(this.yarns.values()).filter(yarn => yarn.quantityInStock <= threshold);
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.projectsCurrentId++;
    const newProject: Project = { ...project, id };
    this.projects.set(id, newProject);
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const existingProject = this.projects.get(id);
    if (!existingProject) return undefined;

    const updatedProject = { ...existingProject, ...project };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Price calculation methods
  async getAllCalculations(): Promise<PriceCalculation[]> {
    return Array.from(this.calculations.values());
  }

  async getCalculation(id: number): Promise<PriceCalculation | undefined> {
    return this.calculations.get(id);
  }

  async createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation> {
    const id = this.calculationsCurrentId++;
    
    // Calculate the prices
    const materialCost = calculation.ballsUsed * (calculation.yarnId ? 
      (this.yarns.get(calculation.yarnId)?.costPerBall || 0) : 0) + calculation.additionalCosts;
    
    const laborCost = calculation.laborHours * calculation.hourlyRate;
    const baseCost = materialCost + laborCost;
    const markup = baseCost * (calculation.markupPercentage / 100);
    let finalPrice = baseCost + markup;
    
    // Round to nearest $5 if requested
    if (calculation.roundToNearest) {
      finalPrice = Math.ceil(finalPrice / 5) * 5;
    }
    
    const newCalculation: PriceCalculation = {
      ...calculation,
      id,
      materialCost,
      laborCost,
      baseCost,
      markup,
      finalPrice,
      createdAt: new Date()
    };
    
    this.calculations.set(id, newCalculation);
    return newCalculation;
  }

  // Activity log methods
  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activitiesCurrentId++;
    const newActivity: ActivityLog = {
      ...activity,
      id,
      timestamp: new Date()
    };
    this.activities.set(id, newActivity);
    return newActivity;
  }
}

export const storage = new MemStorage();
