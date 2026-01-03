CREATE TABLE `audioChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`filename` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`startTimeSeconds` int NOT NULL,
	`endTimeSeconds` int NOT NULL,
	`durationSeconds` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audioChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalFilename` varchar(512) NOT NULL,
	`originalFileUrl` text NOT NULL,
	`originalFileKey` varchar(512) NOT NULL,
	`durationSeconds` int,
	`status` enum('uploading','splitting','transcribing','completed','failed') NOT NULL DEFAULT 'uploading',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`chunkId` int,
	`transcriptType` enum('chunk','combined') NOT NULL,
	`content` text NOT NULL,
	`fileUrl` text,
	`fileKey` varchar(512),
	`sarvamJobId` varchar(256),
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transcripts_id` PRIMARY KEY(`id`)
);
