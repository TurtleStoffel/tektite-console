CREATE TABLE IF NOT EXISTS `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`markdown` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repository_id` text,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `task_history` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`prompt` text NOT NULL,
	`created_at` text NOT NULL,
	`is_done` integer DEFAULT false NOT NULL,
	`done_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `worktree_prompt_summaries` (
	`worktree_path` text PRIMARY KEY NOT NULL,
	`prompt_summary` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
