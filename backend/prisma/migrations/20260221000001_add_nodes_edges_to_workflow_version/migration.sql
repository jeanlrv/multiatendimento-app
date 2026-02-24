-- AlterTable: add nodes and edges columns to workflow_rule_versions
ALTER TABLE "workflow_rule_versions" ADD COLUMN "nodes" JSONB;
ALTER TABLE "workflow_rule_versions" ADD COLUMN "edges" JSONB;
