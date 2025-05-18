import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertYarnSchema, 
  insertProjectSchema, 
  insertPriceCalculationSchema,
  insertActivityLogSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Prefix all routes with /api
  const router = express.Router();
  
  // === Yarn routes ===
  
  // Get all yarns
  router.get("/yarns", async (req, res) => {
    const yarns = await storage.getAllYarns();
    res.json(yarns);
  });
  
  // Get yarn by ID
  router.get("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const yarn = await storage.getYarn(id);
    if (!yarn) {
      return res.status(404).json({ message: "Yarn not found" });
    }
    
    res.json(yarn);
  });
  
  // Create new yarn
  router.post("/yarns", async (req, res) => {
    try {
      const yarnData = insertYarnSchema.parse(req.body);
      const newYarn = await storage.createYarn(yarnData);
      
      // Log activity
      await storage.logActivity({
        type: "add_yarn",
        entityId: newYarn.id,
        description: `Added new yarn: ${newYarn.type} - ${newYarn.color}`
      });
      
      res.status(201).json(newYarn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid yarn data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create yarn" });
    }
  });
  
  // Update yarn
  router.patch("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    try {
      // First check if yarn exists
      const existingYarn = await storage.getYarn(id);
      if (!existingYarn) {
        return res.status(404).json({ message: "Yarn not found" });
      }
      
      // Validate partial data
      const yarnData = insertYarnSchema.partial().parse(req.body);
      const updatedYarn = await storage.updateYarn(id, yarnData);
      
      // Log activity
      await storage.logActivity({
        type: "update_yarn",
        entityId: id,
        description: `Updated yarn: ${updatedYarn!.type} - ${updatedYarn!.color}`
      });
      
      res.json(updatedYarn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid yarn data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update yarn" });
    }
  });
  
  // Delete yarn
  router.delete("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    // First check if yarn exists and get details for activity log
    const existingYarn = await storage.getYarn(id);
    if (!existingYarn) {
      return res.status(404).json({ message: "Yarn not found" });
    }
    
    const deleted = await storage.deleteYarn(id);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete yarn" });
    }
    
    // Log activity
    await storage.logActivity({
      type: "delete_yarn",
      entityId: id,
      description: `Deleted yarn: ${existingYarn.type} - ${existingYarn.color}`
    });
    
    res.status(204).end();
  });
  
  // Get low stock yarns
  router.get("/yarns/low-stock/:threshold", async (req, res) => {
    const threshold = parseInt(req.params.threshold);
    if (isNaN(threshold)) {
      return res.status(400).json({ message: "Invalid threshold format" });
    }
    
    const lowStockYarns = await storage.getLowStockYarns(threshold);
    res.json(lowStockYarns);
  });
  
  // === Project routes ===
  
  // Get all projects
  router.get("/projects", async (req, res) => {
    const projects = await storage.getAllProjects();
    res.json(projects);
  });
  
  // Get project by ID
  router.get("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.json(project);
  });
  
  // Create new project
  router.post("/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(projectData);
      
      // Log activity
      await storage.logActivity({
        type: "add_project",
        entityId: newProject.id,
        description: `Added new project: ${newProject.name}`
      });
      
      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  
  // Update project
  router.patch("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    try {
      // First check if project exists
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Validate partial data
      const projectData = insertProjectSchema.partial().parse(req.body);
      const updatedProject = await storage.updateProject(id, projectData);
      
      // Log activity
      await storage.logActivity({
        type: "update_project",
        entityId: id,
        description: `Updated project: ${updatedProject!.name}`
      });
      
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });
  
  // Delete project
  router.delete("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    // First check if project exists and get details for activity log
    const existingProject = await storage.getProject(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const deleted = await storage.deleteProject(id);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete project" });
    }
    
    // Log activity
    await storage.logActivity({
      type: "delete_project",
      entityId: id,
      description: `Deleted project: ${existingProject.name}`
    });
    
    res.status(204).end();
  });
  
  // === Price calculation routes ===
  
  // Get all calculations
  router.get("/calculations", async (req, res) => {
    const calculations = await storage.getAllCalculations();
    res.json(calculations);
  });
  
  // Get calculation by ID
  router.get("/calculations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const calculation = await storage.getCalculation(id);
    if (!calculation) {
      return res.status(404).json({ message: "Calculation not found" });
    }
    
    res.json(calculation);
  });
  
  // Create new calculation
  router.post("/calculations", async (req, res) => {
    try {
      const calculationData = insertPriceCalculationSchema.parse(req.body);
      const newCalculation = await storage.createCalculation(calculationData);
      
      // Log activity
      await storage.logActivity({
        type: "calculate_price",
        entityId: newCalculation.id,
        description: `Calculated price for: ${newCalculation.itemName}`
      });
      
      res.status(201).json(newCalculation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid calculation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create calculation" });
    }
  });
  
  // === Activity log routes ===
  
  // Get recent activity
  router.get("/activity/:limit", async (req, res) => {
    const limit = parseInt(req.params.limit) || 10;
    const activities = await storage.getRecentActivity(limit);
    res.json(activities);
  });
  
  // === Dashboard summary routes ===
  
  // Get dashboard summary data
  router.get("/dashboard", async (req, res) => {
    const yarns = await storage.getAllYarns();
    const projects = await storage.getAllProjects();
    const calculations = await storage.getAllCalculations();
    const recentActivities = await storage.getRecentActivity(5);
    const lowStockYarns = await storage.getLowStockYarns(5);
    
    // Calculate statistics
    const totalYarns = yarns.length;
    const totalProjects = projects.length;
    
    let averagePrice = 0;
    if (calculations.length > 0) {
      const sum = calculations.reduce((acc, calc) => acc + calc.finalPrice, 0);
      averagePrice = parseFloat((sum / calculations.length).toFixed(2));
    }
    
    const newItems = yarns.filter(yarn => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      // Assuming each yarn has a timestamp when it was added, which we don't track
      // Here we're just returning a count placeholder
      return true;
    }).length;
    
    // If we had a profitability calculation, we'd determine the most profitable project
    const mostProfitableProject = projects.length > 0 ? projects[0].name : 'None';
    
    // Recommended markup calculation
    // In a real app, we'd calculate this based on various factors
    const recommendedMarkup = 45;
    
    res.json({
      totalYarns,
      totalProjects,
      averagePrice,
      newItems,
      mostProfitableProject,
      recommendedMarkup,
      recentActivities,
      lowStockYarns
    });
  });

  // Register the router
  app.use("/api", router);
  
  const httpServer = createServer(app);
  return httpServer;
}
