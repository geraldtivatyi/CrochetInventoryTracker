import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Yarn inventory table
export const yarns = pgTable("yarns", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull(),
  costPerBall: real("cost_per_ball").notNull(),
  quantityInStock: integer("quantity_in_stock").notNull(),
  notes: text("notes"),
});

export const insertYarnSchema = createInsertSchema(yarns).omit({
  id: true,
});

export type InsertYarn = z.infer<typeof insertYarnSchema>;
export type Yarn = typeof yarns.$inferSelect;

// Project templates table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  ballsNeeded: integer("balls_needed").notNull(),
  preferredYarnType: text("preferred_yarn_type"),
  timeToMake: real("time_to_make").notNull(),
  notes: text("notes"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Price calculations table
export const priceCalculations = pgTable("price_calculations", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  projectId: integer("project_id"),
  yarnId: integer("yarn_id"),
  ballsUsed: integer("balls_used").notNull(),
  additionalCosts: real("additional_costs").notNull().default(0),
  laborHours: real("labor_hours").notNull(),
  hourlyRate: real("hourly_rate").notNull(),
  markupPercentage: real("markup_percentage").notNull(),
  roundToNearest: boolean("round_to_nearest").notNull().default(false),
  materialCost: real("material_cost").notNull(),
  laborCost: real("labor_cost").notNull(),
  baseCost: real("base_cost").notNull(),
  markup: real("markup").notNull(),
  finalPrice: real("final_price").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceCalculationSchema = createInsertSchema(priceCalculations).omit({
  id: true,
  createdAt: true,
  // These will be calculated on the server
  materialCost: true,
  laborCost: true,
  baseCost: true,
  markup: true,
  finalPrice: true,
});

export type InsertPriceCalculation = z.infer<typeof insertPriceCalculationSchema>;
export type PriceCalculation = typeof priceCalculations.$inferSelect;

// Activity log table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "add_yarn", "update_yarn", "delete_yarn", "add_project", etc.
  entityId: integer("entity_id").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
