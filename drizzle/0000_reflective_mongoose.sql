CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`category` text NOT NULL,
	`author` text NOT NULL,
	`published_at` text NOT NULL,
	`read_time` text NOT NULL,
	`tags` text NOT NULL,
	`blocks` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);