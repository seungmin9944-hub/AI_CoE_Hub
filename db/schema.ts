import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  category: text("category").notNull(),
  author: text("author").notNull(),
  publishedAt: text("published_at").notNull(),
  readTime: text("read_time").notNull(),
  tocTitle: text("toc_title").notNull().default("ON THIS PAGE"),
  tags: text("tags").notNull(),
  cover: text("cover").notNull().default("{}"),
  blocks: text("blocks").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
