-- AlterTable
ALTER TABLE `users`
    ADD COLUMN `figura` VARCHAR(32) NULL,
    ADD COLUMN `tono_piel` VARCHAR(32) NULL;

-- AlterTable
ALTER TABLE `garments` ADD COLUMN `largo` VARCHAR(16) NULL;
