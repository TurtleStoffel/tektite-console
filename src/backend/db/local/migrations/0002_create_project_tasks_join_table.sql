CREATE TABLE `project_tasks` (
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `task_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL,
	`is_done` integer DEFAULT false NOT NULL,
	`done_at` text
);
--> statement-breakpoint
INSERT INTO `project_tasks`("project_id", "task_id")
SELECT `project_id`, `id`
FROM `tasks`
WHERE `project_id` IS NOT NULL;--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "description", "created_at", "is_done", "done_at") SELECT "id", "description", "created_at", "is_done", "done_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
