import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  Yarn,
  InsertYarn,
  Project,
  InsertProject,
  PriceCalculation,
  InsertPriceCalculation,
  ActivityLog,
  InsertActivityLog,
  yarns,
  projects,
  priceCalculations,
  activityLogs
} from "@shared/schema";
import { eq, lte, desc } from "drizzle-orm";
import { IStorage } from "./storage";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    try {
      // Check if we have any data, if not, seed with sample data
      const existingYarns = await db.select().from(yarns).limit(1);
      
      if (existingYarns.length === 0) {
        // Insert sample yarns
        await db.insert(yarns).values([
          {
            type: "Merino Wool",
            color: "Crimson Red",
            colorHex: "#B22222",
            costPerBall: 6.99,
            quantityInStock: 12,
            notes: "Premium soft"
          },
          {
            type: "Cotton Blend",
            color: "Sky Blue",
            colorHex: "#87CEEB",
            costPerBall: 4.50,
            quantityInStock: 2,
            notes: "Lightweight"
          },
          {
            type: "Alpaca Wool",
            color: "Caramel",
            colorHex: "#C68E17",
            costPerBall: 8.25,
            quantityInStock: 3,
            notes: "Extra soft"
          },
          {
            type: "Chunky Acrylic",
            color: "Lavender",
            colorHex: "#B57EDC",
            costPerBall: 5.75,
            quantityInStock: 8,
            notes: "Bulky weight"
          }
        ]);

        // Insert sample projects
        await db.insert(projects).values([
          {
            name: "Winter Scarf",
            category: "Accessory",
            ballsNeeded: 3,
            preferredYarnType: "Merino Wool",
            timeToMake: 5,
            notes: "Classic pattern"
          },
          {
            name: "Baby Blanket",
            category: "Home",
            ballsNeeded: 8,
            preferredYarnType: "Cotton Blend",
            timeToMake: 12,
            notes: "Simple stitch pattern"
          },
          {
            name: "Amigurumi Set",
            category: "Toy",
            ballsNeeded: 5,
            preferredYarnType: "Chunky Acrylic",
            timeToMake: 8,
            notes: "Set of 3 small animals"
          }
        ]);

        // Insert sample activities
        await db.insert(activityLogs).values([
          {
            type: "add_yarn",
            entityId: 1,
            description: "Added new yarn: Merino Wool - Crimson Red"
          },
          {
            type: "update_project",
            entityId: 1,
            description: "Updated project: Winter Scarf"
          },
          {
            type: "calculate_price",
            entityId: 2,
            description: "Calculated price for: Baby Blanket"
          }
        ]);
      }
    } catch (error) {
      console.error("Error initializing data:", error);
    }
  }

  // Yarn methods
  async getAllYarns(): Promise<Yarn[]> {
    return await db.select().from(yarns);
  }

  async getYarn(id: number): Promise<Yarn | undefined> {
    const result = await db.select().from(yarns).where(eq(yarns.id, id)).limit(1);
    return result[0];
  }

  async createYarn(yarn: InsertYarn): Promise<Yarn> {
    const result = await db.insert(yarns).values(yarn).returning();
    return result[0];
  }

  async updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined> {
    const result = await db.update(yarns).set(yarn).where(eq(yarns.id, id)).returning();
    return result[0];
  }

  async deleteYarn(id: number): Promise<boolean> {
    const result = await db.delete(yarns).where(eq(yarns.id, id));
    return result.rowCount > 0;
  }

  async getLowStockYarns(threshold: number): Promise<Yarn[]> {
    return await db.select().from(yarns).where(lte(yarns.quantityInStock, threshold));
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  // Price calculation methods
  async getAllCalculations(): Promise<PriceCalculation[]> {
    return await db.select().from(priceCalculations);
  }

  async getCalculation(id: number): Promise<PriceCalculation | undefined> {
    const result = await db.select().from(priceCalculations).where(eq(priceCalculations.id, id)).limit(1);
    return result[0];
  }

  async createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation> {
    // Calculate the prices
    let materialCost = calculation.additionalCosts;
    
    if (calculation.yarnId) {
      const yarn = await this.getYarn(calculation.yarnId);
      if (yarn) {
        materialCost += calculation.ballsUsed * yarn.costPerBall;
      }
    }
    
    const laborCost = calculation.laborHours * calculation.hourlyRate;
    const baseCost = materialCost + laborCost;
    const markup = baseCost * (calculation.markupPercentage / 100);
    let finalPrice = baseCost + markup;
    
    // Round to nearest $5 if requested
    if (calculation.roundToNearest) {
      finalPrice = Math.ceil(finalPrice / 5) * 5;
    }
    
    const calculationWithPrices = {
      ...calculation,
      materialCost,
      laborCost,
      baseCost,
      markup,
      finalPrice
    };
    
    const result = await db.insert(priceCalculations).values(calculationWithPrices).returning();
    return result[0];
  }

  // Activity log methods
  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(limit);
  }

  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(activity).returning();
    return result[0];
  }
}