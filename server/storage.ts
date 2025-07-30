import { 
  users, 
  rounds, 
  contestants, 
  votes, 
  systemSettings,
  type User, 
  type InsertUser,
  type Round,
  type InsertRound,
  type Contestant,
  type InsertContestant,
  type Vote,
  type InsertVote,
  type SystemSetting,
  type InsertSystemSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Rounds
  getRounds(): Promise<Round[]>;
  getActiveRound(): Promise<Round | undefined>;
  createRound(round: InsertRound): Promise<Round>;
  updateRound(id: string, updates: Partial<InsertRound>): Promise<Round | undefined>;
  setActiveRound(roundId: string): Promise<void>;
  deactivateRounds(): Promise<void>;
  
  // Contestants
  getContestantsByRound(roundId: string): Promise<Contestant[]>;
  getVisibleContestantsByRound(roundId: string): Promise<Contestant[]>;
  getContestant(id: string): Promise<Contestant | undefined>;
  createContestant(contestant: InsertContestant): Promise<Contestant>;
  updateContestant(id: string, updates: Partial<InsertContestant>): Promise<Contestant | undefined>;
  deleteContestant(id: string): Promise<void>;
  
  // Votes
  getVotesByUser(userId: string): Promise<Vote[]>;
  getVotesByContestant(contestantId: string): Promise<Vote[]>;
  getVote(userId: string, contestantId: string): Promise<Vote | undefined>;
  createVote(vote: InsertVote): Promise<Vote>;
  updateVote(userId: string, contestantId: string, voteValue: boolean): Promise<Vote | undefined>;
  
  // System Settings
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  
  // Statistics
  getVotingStats(): Promise<{
    totalVotes: number;
    activeJudges: number;
    totalContestants: number;
    currentRound: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getRounds(): Promise<Round[]> {
    return await db.select().from(rounds).orderBy(desc(rounds.roundNumber));
  }

  async getActiveRound(): Promise<Round | undefined> {
    const [round] = await db.select().from(rounds).where(eq(rounds.isActive, true));
    return round || undefined;
  }

  async createRound(insertRound: InsertRound): Promise<Round> {
    const [round] = await db
      .insert(rounds)
      .values(insertRound)
      .returning();
    return round;
  }

  async updateRound(id: string, updates: Partial<InsertRound>): Promise<Round | undefined> {
    const [round] = await db
      .update(rounds)
      .set(updates)
      .where(eq(rounds.id, id))
      .returning();
    return round || undefined;
  }

  async setActiveRound(roundId: string): Promise<void> {
    // First deactivate all rounds
    await db.update(rounds).set({ isActive: false });
    // Then activate the selected round
    await db.update(rounds).set({ isActive: true }).where(eq(rounds.id, roundId));
  }

  async deactivateRounds(): Promise<void> {
    // Deactivate all rounds
    await db.update(rounds).set({ isActive: false });
  }

  async getContestantsByRound(roundId: string): Promise<Contestant[]> {
    return await db
      .select()
      .from(contestants)
      .where(eq(contestants.roundId, roundId))
      .orderBy(contestants.order);
  }

  async getVisibleContestantsByRound(roundId: string): Promise<Contestant[]> {
    return await db
      .select()
      .from(contestants)
      .where(and(
        eq(contestants.roundId, roundId),
        eq(contestants.isVisibleToJudges, true)
      ))
      .orderBy(contestants.order);
  }

  async getContestant(id: string): Promise<Contestant | undefined> {
    const [contestant] = await db.select().from(contestants).where(eq(contestants.id, id));
    return contestant || undefined;
  }

  async createContestant(insertContestant: InsertContestant): Promise<Contestant> {
    const [contestant] = await db
      .insert(contestants)
      .values(insertContestant)
      .returning();
    return contestant;
  }

  async updateContestant(id: string, updates: Partial<InsertContestant>): Promise<Contestant | undefined> {
    const [contestant] = await db
      .update(contestants)
      .set(updates)
      .where(eq(contestants.id, id))
      .returning();
    return contestant || undefined;
  }

  async deleteContestant(id: string): Promise<void> {
    await db.delete(contestants).where(eq(contestants.id, id));
  }

  async getVotesByUser(userId: string): Promise<Vote[]> {
    return await db
      .select()
      .from(votes)
      .where(eq(votes.userId, userId))
      .orderBy(desc(votes.createdAt));
  }

  async getVotesByContestant(contestantId: string): Promise<Vote[]> {
    return await db
      .select()
      .from(votes)
      .where(eq(votes.contestantId, contestantId));
  }

  async getVote(userId: string, contestantId: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.contestantId, contestantId)));
    return vote || undefined;
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    // Check if vote already exists for this user and contestant
    const existingVote = await this.getVote(insertVote.userId, insertVote.contestantId);
    if (existingVote) {
      throw new Error("Uživatel již hlasoval pro tohoto soutěžícího");
    }
    
    const [vote] = await db
      .insert(votes)
      .values(insertVote)
      .returning();
    return vote;
  }

  async updateVote(userId: string, contestantId: string, voteValue: boolean): Promise<Vote | undefined> {
    const [vote] = await db
      .update(votes)
      .set({ vote: voteValue })
      .where(and(eq(votes.userId, userId), eq(votes.contestantId, contestantId)))
      .returning();
    return vote || undefined;
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSystemSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    const existingSetting = await this.getSystemSetting(insertSetting.key);
    
    if (existingSetting) {
      const [setting] = await db
        .update(systemSettings)
        .set({ value: insertSetting.value, updatedAt: new Date() })
        .where(eq(systemSettings.key, insertSetting.key))
        .returning();
      return setting;
    } else {
      const [setting] = await db
        .insert(systemSettings)
        .values(insertSetting)
        .returning();
      return setting;
    }
  }

  async getVotingStats(): Promise<{
    totalVotes: number;
    activeJudges: number;
    totalContestants: number;
    currentRound: number;
  }> {
    const totalVotesResult = await db.select().from(votes);
    const activeJudgesResult = await db.select().from(users).where(eq(users.role, "judge"));
    const totalContestantsResult = await db.select().from(contestants);
    const activeRound = await this.getActiveRound();

    return {
      totalVotes: totalVotesResult.length,
      activeJudges: activeJudgesResult.length,
      totalContestants: totalContestantsResult.length,
      currentRound: activeRound?.roundNumber || 0,
    };
  }
}

export const storage = new DatabaseStorage();
