-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TicketMode" AS ENUM ('AI', 'HUMANO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'IN_PROGRESS', 'PAUSED', 'WAITING', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MessageOrigin" AS ENUM ('CLIENT', 'AGENT', 'AI');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'FINISHED', 'NOSHOW');

-- CreateEnum
CREATE TYPE "InternalChatType" AS ENUM ('DIRECT', 'GROUP', 'CHANNEL');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chatStatus" TEXT NOT NULL DEFAULT 'ONLINE',
    "chatSoundEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_departments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT DEFAULT '­ƒÆ¼',
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "aiAgentId" TEXT,
    "workflowId" TEXT,
    "defaultMode" "TicketMode" NOT NULL DEFAULT 'AI',
    "slaFirstResponseMin" INTEGER,
    "slaResolutionMin" INTEGER,
    "outOfHoursMessage" TEXT,
    "greetingMessage" TEXT,
    "closingMessage" TEXT,
    "businessHours" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "autoDistribute" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_flows" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "states" JSONB NOT NULL,
    "transitions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_instances" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "zapiInstanceId" TEXT,
    "zapiToken" TEXT,
    "zapiClientToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PERSON',
    "cpfCnpj" TEXT,
    "emailPrimary" TEXT,
    "phonePrimary" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_custom_fields" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "profilePicture" TEXT,
    "notes" TEXT,
    "information" TEXT,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "csatPending" BOOLEAN NOT NULL DEFAULT false,
    "csatTicketId" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "maxDepartments" INTEGER NOT NULL DEFAULT 1,
    "maxWhatsApp" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "limitTokens" INTEGER NOT NULL DEFAULT 0,
    "limitTokensPerHour" INTEGER NOT NULL DEFAULT 0,
    "limitTokensPerDay" INTEGER NOT NULL DEFAULT 0,
    "dailyCostAlertUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1E293B',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "csatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "csatMessage" TEXT,
    "sentimentAlertThreshold" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "connectionId" TEXT,
    "assignedUserId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "mode" "TicketMode" NOT NULL DEFAULT 'AI',
    "subject" TEXT,
    "unreadMessages" INTEGER NOT NULL DEFAULT 0,
    "currentFlowState" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "realtimeSentimentScore" INTEGER,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "externalId" TEXT,
    "fromMe" BOOLEAN NOT NULL,
    "origin" "MessageOrigin" NOT NULL DEFAULT 'AGENT',
    "messageType" "MessageType" NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "transcription" TEXT,
    "quotedMessageId" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tags" (
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ticket_tags_pkey" PRIMARY KEY ("ticketId","tagId")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'portuguese',
    "embeddingProvider" TEXT NOT NULL DEFAULT 'qwen',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-v2',
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_sync_logs" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "documentId" TEXT,
    "agentHostname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentUrl" TEXT,
    "rawContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "metadata" JSONB,
    "section" TEXT,
    "embedding" vector,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "description" TEXT,
    "anythingllmWorkspaceId" TEXT,
    "prompt" TEXT,
    "modelId" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "configuration" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT,
    "embeddingProvider" TEXT NOT NULL DEFAULT 'qwen',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-v2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "allowInInternalChat" BOOLEAN NOT NULL DEFAULT false,
    "embedId" TEXT,
    "embedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedBrandColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "embedBrandLogo" TEXT,
    "embedAgentName" TEXT,
    "embedWelcomeMsg" TEXT,
    "embedPlaceholder" TEXT NOT NULL DEFAULT 'Digite sua mensagem...',
    "embedPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "embedAllowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedRateLimit" INTEGER NOT NULL DEFAULT 20,
    "allowModelDowngrade" BOOLEAN NOT NULL DEFAULT false,
    "limitTokensPerDay" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embed_chat_sessions" (
    "id" TEXT NOT NULL,
    "embedId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embed_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "customerRating" INTEGER,
    "customerFeedback" TEXT,
    "aiSentiment" "Sentiment" NOT NULL,
    "aiSentimentScore" DOUBLE PRECISION NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "aiJustification" TEXT NOT NULL,
    "workflowTriggered" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "nodes" JSONB,
    "edges" JSONB,
    "config" JSONB,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "version" INTEGER NOT NULL DEFAULT 1,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rule_versions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "trigger" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "nodes" JSONB,
    "edges" JSONB,
    "description" TEXT,
    "diff" JSONB,
    "commitMessage" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "workflow_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowRuleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "result" JSONB,
    "logs" JSONB,
    "duration" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "correlationId" TEXT,
    "companyId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_suspensions" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "correlationKey" TEXT,
    "timeoutAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_metrics" (
    "id" TEXT NOT NULL,
    "workflowRuleId" TEXT NOT NULL,
    "nodeId" TEXT,
    "actionType" TEXT NOT NULL,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "averageDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_action_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_configs" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "businessHours" JSONB NOT NULL,
    "maxSchedulesPerDay" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_reminders" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "schedule_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "targetTenants" TEXT[],
    "excludedTenants" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smtp_configs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smtp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "zapiInstanceId" TEXT NOT NULL,
    "zapiToken" TEXT NOT NULL,
    "zapiClientToken" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "summaryMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "event" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chats" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "type" "InternalChatType" NOT NULL DEFAULT 'DIRECT',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chat_members" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "aiAgentId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "lastReadMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderAiAgentId" TEXT,
    "content" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "replyToId" TEXT,
    "threadId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "mediaUrl" TEXT,
    "readAt" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chat_message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "internal_chat_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chat_message_mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT,
    "aiAgentId" TEXT,

    CONSTRAINT "internal_chat_message_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_chat_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "internal_chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "color" TEXT DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'llm',
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "extraConfig" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_companyId_name_key" ON "roles"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_userId_departmentId_key" ON "user_departments"("userId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "departments_companyId_idx" ON "departments"("companyId");

-- CreateIndex
CREATE INDEX "departments_displayOrder_idx" ON "departments"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "departments_companyId_name_key" ON "departments"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "department_flows_departmentId_key" ON "department_flows"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_phoneNumber_key" ON "whatsapp_instances"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_zapiInstanceId_key" ON "whatsapp_instances"("zapiInstanceId");

-- CreateIndex
CREATE INDEX "whatsapp_instances_companyId_idx" ON "whatsapp_instances"("companyId");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");

-- CreateIndex
CREATE INDEX "customers_companyId_status_idx" ON "customers"("companyId", "status");

-- CreateIndex
CREATE INDEX "customers_companyId_phonePrimary_idx" ON "customers"("companyId", "phonePrimary");

-- CreateIndex
CREATE INDEX "customer_notes_customerId_idx" ON "customer_notes"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_custom_fields_customerId_fieldName_key" ON "customer_custom_fields"("customerId", "fieldName");

-- CreateIndex
CREATE INDEX "contacts_companyId_phoneNumber_idx" ON "contacts"("companyId", "phoneNumber");

-- CreateIndex
CREATE INDEX "contacts_companyId_customerId_idx" ON "contacts"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "contacts_phoneNumber_idx" ON "contacts"("phoneNumber");

-- CreateIndex
CREATE INDEX "contacts_riskScore_idx" ON "contacts"("riskScore");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_publicToken_key" ON "tickets"("publicToken");

-- CreateIndex
CREATE INDEX "tickets_companyId_status_idx" ON "tickets"("companyId", "status");

-- CreateIndex
CREATE INDEX "tickets_companyId_updatedAt_idx" ON "tickets"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "tickets_companyId_departmentId_idx" ON "tickets"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "tickets_companyId_createdAt_idx" ON "tickets"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_companyId_assignedUserId_idx" ON "tickets"("companyId", "assignedUserId");

-- CreateIndex
CREATE INDEX "tickets_departmentId_idx" ON "tickets"("departmentId");

-- CreateIndex
CREATE INDEX "tickets_lastMessageAt_idx" ON "tickets"("lastMessageAt");

-- CreateIndex
CREATE INDEX "tickets_contactId_idx" ON "tickets"("contactId");

-- CreateIndex
CREATE INDEX "tickets_assignedUserId_idx" ON "tickets"("assignedUserId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_companyId_idx" ON "tickets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_externalId_key" ON "messages"("externalId");

-- CreateIndex
CREATE INDEX "messages_ticketId_sentAt_idx" ON "messages"("ticketId", "sentAt");

-- CreateIndex
CREATE INDEX "messages_ticketId_origin_idx" ON "messages"("ticketId", "origin");

-- CreateIndex
CREATE INDEX "messages_ticketId_idx" ON "messages"("ticketId");

-- CreateIndex
CREATE INDEX "messages_externalId_idx" ON "messages"("externalId");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX "messages_origin_idx" ON "messages"("origin");

-- CreateIndex
CREATE INDEX "tags_companyId_idx" ON "tags"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_companyId_name_key" ON "tags"("companyId", "name");

-- CreateIndex
CREATE INDEX "quick_replies_companyId_idx" ON "quick_replies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_companyId_shortcut_key" ON "quick_replies"("companyId", "shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_bases_webhookApiKey_key" ON "knowledge_bases"("webhookApiKey");

-- CreateIndex
CREATE INDEX "knowledge_bases_companyId_idx" ON "knowledge_bases"("companyId");

-- CreateIndex
CREATE INDEX "kb_sync_logs_knowledgeBaseId_idx" ON "kb_sync_logs"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "kb_sync_logs_createdAt_idx" ON "kb_sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "documents_knowledgeBaseId_idx" ON "documents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agents_embedId_key" ON "ai_agents"("embedId");

-- CreateIndex
CREATE INDEX "ai_agents_companyId_idx" ON "ai_agents"("companyId");

-- CreateIndex
CREATE INDEX "ai_agents_knowledgeBaseId_idx" ON "ai_agents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "embed_chat_sessions_embedId_sessionId_idx" ON "embed_chat_sessions"("embedId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "embed_chat_sessions_embedId_sessionId_key" ON "embed_chat_sessions"("embedId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_companyId_idx" ON "api_keys"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_ticketId_key" ON "evaluations"("ticketId");

-- CreateIndex
CREATE INDEX "evaluations_aiSentimentScore_idx" ON "evaluations"("aiSentimentScore");

-- CreateIndex
CREATE INDEX "evaluations_companyId_idx" ON "evaluations"("companyId");

-- CreateIndex
CREATE INDEX "workflow_rules_companyId_idx" ON "workflow_rules"("companyId");

-- CreateIndex
CREATE INDEX "workflow_rules_isActive_idx" ON "workflow_rules"("isActive");

-- CreateIndex
CREATE INDEX "workflow_rules_isTemplate_idx" ON "workflow_rules"("isTemplate");

-- CreateIndex
CREATE INDEX "workflow_rule_versions_workflowId_idx" ON "workflow_rule_versions"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_executions_correlationId_key" ON "workflow_executions"("correlationId");

-- CreateIndex
CREATE INDEX "workflow_executions_companyId_idx" ON "workflow_executions"("companyId");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowRuleId_idx" ON "workflow_executions"("workflowRuleId");

-- CreateIndex
CREATE INDEX "workflow_executions_entityId_idx" ON "workflow_executions"("entityId");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_executedAt_idx" ON "workflow_executions"("executedAt");

-- CreateIndex
CREATE INDEX "workflow_suspensions_eventName_correlationKey_idx" ON "workflow_suspensions"("eventName", "correlationKey");

-- CreateIndex
CREATE INDEX "workflow_suspensions_workflowExecutionId_idx" ON "workflow_suspensions"("workflowExecutionId");

-- CreateIndex
CREATE INDEX "workflow_action_metrics_actionType_idx" ON "workflow_action_metrics"("actionType");

-- CreateIndex
CREATE INDEX "workflow_action_metrics_nodeId_idx" ON "workflow_action_metrics"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_action_metrics_workflowRuleId_nodeId_actionType_key" ON "workflow_action_metrics"("workflowRuleId", "nodeId", "actionType");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_configs_departmentId_key" ON "schedule_configs"("departmentId");

-- CreateIndex
CREATE INDEX "schedules_contactId_idx" ON "schedules"("contactId");

-- CreateIndex
CREATE INDEX "schedules_departmentId_idx" ON "schedules"("departmentId");

-- CreateIndex
CREATE INDEX "schedules_startTime_idx" ON "schedules"("startTime");

-- CreateIndex
CREATE INDEX "schedules_companyId_idx" ON "schedules"("companyId");

-- CreateIndex
CREATE INDEX "schedule_reminders_scheduleId_idx" ON "schedule_reminders"("scheduleId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "settings_companyId_idx" ON "settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_companyId_key_key" ON "settings"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "smtp_configs_companyId_idx" ON "smtp_configs"("companyId");

-- CreateIndex
CREATE INDEX "integrations_companyId_idx" ON "integrations"("companyId");

-- CreateIndex
CREATE INDEX "ai_usage_companyId_idx" ON "ai_usage"("companyId");

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "conversations_companyId_idx" ON "conversations"("companyId");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "conversations_agentId_idx" ON "conversations"("agentId");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_messages_createdAt_idx" ON "conversation_messages"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "notifications"("company_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "internal_chat_members_chatId_idx" ON "internal_chat_members"("chatId");

-- CreateIndex
CREATE INDEX "internal_chat_members_userId_idx" ON "internal_chat_members"("userId");

-- CreateIndex
CREATE INDEX "internal_chat_members_aiAgentId_idx" ON "internal_chat_members"("aiAgentId");

-- CreateIndex
CREATE INDEX "internal_chat_messages_chatId_idx" ON "internal_chat_messages"("chatId");

-- CreateIndex
CREATE INDEX "internal_chat_messages_senderUserId_idx" ON "internal_chat_messages"("senderUserId");

-- CreateIndex
CREATE INDEX "internal_chat_messages_senderAiAgentId_idx" ON "internal_chat_messages"("senderAiAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_chat_message_reactions_messageId_userId_emoji_key" ON "internal_chat_message_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "internal_chat_message_mentions_messageId_idx" ON "internal_chat_message_mentions"("messageId");

-- CreateIndex
CREATE INDEX "internal_chat_attachments_messageId_idx" ON "internal_chat_attachments"("messageId");

-- CreateIndex
CREATE INDEX "saved_filters_userId_idx" ON "saved_filters"("userId");

-- CreateIndex
CREATE INDEX "saved_filters_companyId_idx" ON "saved_filters"("companyId");

-- CreateIndex
CREATE INDEX "broadcasts_companyId_idx" ON "broadcasts"("companyId");

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcastId_idx" ON "broadcast_recipients"("broadcastId");

-- CreateIndex
CREATE INDEX "broadcast_recipients_contactId_idx" ON "broadcast_recipients"("contactId");

-- CreateIndex
CREATE INDEX "scheduled_messages_ticketId_idx" ON "scheduled_messages"("ticketId");

-- CreateIndex
CREATE INDEX "scheduled_messages_companyId_idx" ON "scheduled_messages"("companyId");

-- CreateIndex
CREATE INDEX "scheduled_messages_scheduledAt_idx" ON "scheduled_messages"("scheduledAt");

-- CreateIndex
CREATE INDEX "provider_configs_companyId_idx" ON "provider_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_companyId_provider_key" ON "provider_configs"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_flows" ADD CONSTRAINT "department_flows_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_custom_fields" ADD CONSTRAINT "customer_custom_fields_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_sync_logs" ADD CONSTRAINT "kb_sync_logs_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rule_versions" ADD CONSTRAINT "workflow_rule_versions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rule_versions" ADD CONSTRAINT "workflow_rule_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowRuleId_fkey" FOREIGN KEY ("workflowRuleId") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_suspensions" ADD CONSTRAINT "workflow_suspensions_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_metrics" ADD CONSTRAINT "workflow_action_metrics_workflowRuleId_fkey" FOREIGN KEY ("workflowRuleId") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_configs" ADD CONSTRAINT "schedule_configs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_reminders" ADD CONSTRAINT "schedule_reminders_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smtp_configs" ADD CONSTRAINT "smtp_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chats" ADD CONSTRAINT "internal_chats_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_members" ADD CONSTRAINT "internal_chat_members_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_members" ADD CONSTRAINT "internal_chat_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_members" ADD CONSTRAINT "internal_chat_members_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_senderAiAgentId_fkey" FOREIGN KEY ("senderAiAgentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_message_reactions" ADD CONSTRAINT "internal_chat_message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "internal_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_message_reactions" ADD CONSTRAINT "internal_chat_message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_message_mentions" ADD CONSTRAINT "internal_chat_message_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "internal_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_message_mentions" ADD CONSTRAINT "internal_chat_message_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_message_mentions" ADD CONSTRAINT "internal_chat_message_mentions_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_chat_attachments" ADD CONSTRAINT "internal_chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "internal_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

