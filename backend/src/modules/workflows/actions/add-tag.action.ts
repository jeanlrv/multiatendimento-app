import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AddTagAction implements ActionExecutor {
    private readonly logger = new Logger(AddTagAction.name);

    constructor(private readonly prisma: PrismaService) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing AddTagAction for workflow ${context.workflowId}`);

        const { tagId, tagName } = params;

        if (!tagId && !tagName) {
            return { success: false, error: 'ID ou Nome da Tag deve ser fornecido' };
        }

        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ação suportada apenas para tickets' };
        }

        try {
            let targetTagId = tagId;

            // If tagId is not provided, try to find or create the tag by name
            if (!targetTagId && tagName) {
                const tag = await (this.prisma as any).tag.findFirst({
                    where: {
                        companyId: context.companyId,
                        name: tagName
                    }
                });

                if (tag) {
                    targetTagId = tag.id;
                } else {
                    const newTag = await (this.prisma as any).tag.create({
                        data: {
                            name: tagName,
                            color: '#e2e8f0', // default gray color
                            companyId: context.companyId
                        }
                    });
                    targetTagId = newTag.id;
                }
            }

            // Check if ticket already has this tag
            const existingRelation = await (this.prisma as any).ticketTag.findUnique({
                where: {
                    ticketId_tagId: {
                        ticketId,
                        tagId: targetTagId
                    }
                }
            });

            if (!existingRelation) {
                await (this.prisma as any).ticketTag.create({
                    data: {
                        ticketId,
                        tagId: targetTagId
                    }
                });
            }

            return {
                success: true,
                data: {
                    ticketId,
                    tagId: targetTagId,
                    added: !existingRelation
                }
            };
        } catch (error) {
            this.logger.error(`AddTag Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
