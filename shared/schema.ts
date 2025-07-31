import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("judge"), // judge or admin
  createdAt: timestamp("created_at").defaultNow(),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false),
  roundNumber: integer("round_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contestants = pgTable("contestants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  age: integer("age").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  roundId: uuid("round_id").references(() => rounds.id),
  order: integer("order").notNull().default(1),
  isVisibleToJudges: boolean("is_visible_to_judges").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  contestantId: uuid("contestant_id").references(() => contestants.id).notNull(),
  vote: boolean("vote").notNull(), // true = positive, false = negative
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  votes: many(votes),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  contestants: many(contestants),
}));

export const contestantsRelations = relations(contestants, ({ one, many }) => ({
  round: one(rounds, {
    fields: [contestants.roundId],
    references: [rounds.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
  contestant: one(contestants, {
    fields: [votes.contestantId],
    references: [contestants.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRoundSchema = createInsertSchema(rounds).omit({
  id: true,
  createdAt: true,
});

export const insertContestantSchema = createInsertSchema(contestants).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Round = typeof rounds.$inferSelect;
export type InsertRound = z.infer<typeof insertRoundSchema>;
export type Contestant = typeof contestants.$inferSelect;
export type InsertContestant = z.infer<typeof insertContestantSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;