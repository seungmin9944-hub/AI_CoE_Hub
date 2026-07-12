ALTER TABLE `posts` ADD `toc_title` text DEFAULT 'ON THIS PAGE' NOT NULL;
--> statement-breakpoint
UPDATE `posts` SET `category` = '업무 자동화' WHERE `id` = 'cloudflare-dashboard-01' AND `category` = '실습 가이드';
