import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertRoundSchema, insertContestantSchema, insertVoteSchema, users } from "@shared/schema";
import { db } from "./db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    res.json({ 
      user: { 
        id: req.user.id, 
        email: req.user.email, 
        name: req.user.name, 
        role: req.user.role 
      } 
    });
  });

  // Rounds routes
  app.get("/api/rounds", authenticateToken, async (req, res) => {
    try {
      const rounds = await storage.getRounds();
      res.json(rounds);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/rounds/active", authenticateToken, async (req, res) => {
    try {
      const activeRound = await storage.getActiveRound();
      res.json(activeRound);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rounds", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const roundData = insertRoundSchema.parse(req.body);
      const round = await storage.createRound(roundData);
      res.json(round);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/rounds/:id/activate", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.setActiveRound(id);
      res.json({ message: "Round activated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contestants routes
  app.get("/api/contestants/round/:roundId", authenticateToken, async (req, res) => {
    try {
      const { roundId } = req.params;
      const contestants = await storage.getContestantsByRound(roundId);
      res.json(contestants);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/contestants", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const contestantData = insertContestantSchema.parse(req.body);
      const contestant = await storage.createContestant(contestantData);
      res.json(contestant);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/contestants/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const contestant = await storage.updateContestant(id, updates);
      if (!contestant) {
        return res.status(404).json({ message: "Contestant not found" });
      }
      res.json(contestant);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/contestants/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContestant(id);
      res.json({ message: "Contestant deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Votes routes
  app.get("/api/votes/user/:userId", authenticateToken, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Users can only see their own votes unless they're admin
      if (req.user.role !== "admin" && req.user.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const votes = await storage.getVotesByUser(userId);
      res.json(votes);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/votes/contestant/:contestantId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { contestantId } = req.params;
      const votes = await storage.getVotesByContestant(contestantId);
      res.json(votes);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/votes", authenticateToken, async (req: any, res) => {
    try {
      const voteData = {
        userId: req.user.id,
        contestantId: req.body.contestantId,
        vote: req.body.vote,
      };

      // Check if vote already exists
      const existingVote = await storage.getVote(voteData.userId, voteData.contestantId);
      
      if (existingVote) {
        // Update existing vote - allow changing vote
        const updatedVote = await storage.updateVote(voteData.userId, voteData.contestantId, voteData.vote);
        res.json(updatedVote);
      } else {
        // Create new vote
        const vote = await storage.createVote(voteData);
        res.json(vote);
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Internal server error" });
    }
  });

  // Statistics routes
  app.get("/api/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getVotingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Users routes
  app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Get all users (admin only)
      const allUsers = await db.select().from(users);
      const usersWithoutPasswords = allUsers.map(user => ({
        ...user,
        password: undefined
      }));
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // System settings routes
  app.get("/api/settings/:key", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      const setting = await storage.setSystemSetting({ key, value });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
