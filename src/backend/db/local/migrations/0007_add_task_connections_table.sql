CREATE TABLE `task_connections` (
	`source_task_id` text NOT NULL,
	`target_task_id` text NOT NULL,
	PRIMARY KEY(`source_task_id`, `target_task_id`),
	FOREIGN KEY (`source_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
