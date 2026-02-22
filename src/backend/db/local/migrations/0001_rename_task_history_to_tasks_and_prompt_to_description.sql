ALTER TABLE `task_history` RENAME TO `tasks`;
ALTER TABLE `tasks` RENAME COLUMN `prompt` TO `description`;
