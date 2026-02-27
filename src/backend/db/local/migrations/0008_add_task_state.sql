ALTER TABLE `tasks` ADD `state` text DEFAULT 'todo' NOT NULL;
--> statement-breakpoint
UPDATE `tasks`
SET `state` = CASE
    WHEN `is_done` = 1 THEN 'done'
    ELSE 'in_progress'
END;
