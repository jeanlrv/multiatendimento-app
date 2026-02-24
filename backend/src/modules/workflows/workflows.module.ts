import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaService } from '../../database/prisma.service';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { AIModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowAnalyticsController } from './workflow-analytics.controller';
import { WorkflowEventsController } from './workflows-events.controller';
import { WorkflowsProcessor } from './workflows.processor';
import { WorkflowEventsListener } from './workflow-events.listener';


import { ActionRegistry } from './core/action.registry';
import { WorkflowOrchestrator } from './core/workflow.orchestrator';
import { LockService } from './core/lock.service';

/* ============================
   ACTIONS
============================ */

import { DelayAction } from './actions/control/delay.action';
import { ConditionAction } from './actions/control/condition.action';
import { SplitTrafficAction } from './actions/control/split-traffic.action';
import { WaitForEventAction } from './actions/control/wait-for-event.action';

import { SendMessageAction } from './actions/send-message.action';
import { SendEmailAction } from './actions/send-email.action';
import { HttpWebhookAction } from './actions/http-webhook.action';
import { AddTagAction } from './actions/add-tag.action';
import { TransferToHumanAction } from './actions/transfer-to-human.action';

import { CreateScheduleAction } from './actions/create-schedule.action';
import { UpdateScheduleStatusAction } from './actions/update-schedule-status.action';
import { UpdateTicketAction } from './actions/update-ticket.action';
import { AIIntentAction } from './actions/ai-intent.action';
import { AIRespondAction } from './actions/ai-respond.action';
import { AnalyzeSentimentAction } from './actions/analyze-sentiment.action';
import { TransferDepartmentAction } from './actions/transfer-department.action';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'workflows',
        }),

        // 🔥 Importa Scheduling, AI, Mail e WhatsApp para permitir DI nas Actions
        SchedulingModule,
        AIModule,
        MailModule,
        forwardRef(() => WhatsAppModule),
        forwardRef(() => EvaluationsModule),
    ],

    controllers: [
        WorkflowsController,
        WorkflowAnalyticsController,
        WorkflowEventsController,
    ],

    providers: [

        WorkflowsService,
        WorkflowsProcessor,

        ActionRegistry,
        WorkflowOrchestrator,
        LockService,
        WorkflowEventsListener,

        /* Actions */
        DelayAction,
        ConditionAction,
        SplitTrafficAction,
        WaitForEventAction,
        SendMessageAction,
        SendEmailAction,
        HttpWebhookAction,
        AddTagAction,
        TransferToHumanAction,
        CreateScheduleAction,
        UpdateScheduleStatusAction,
        UpdateTicketAction,
        AIIntentAction,
        AIRespondAction,
        AnalyzeSentimentAction,
        TransferDepartmentAction,
    ],

    exports: [WorkflowsService],
})
export class WorkflowsModule implements OnModuleInit {

    constructor(
        private readonly actionRegistry: ActionRegistry,

        private readonly delayAction: DelayAction,
        private readonly conditionAction: ConditionAction,
        private readonly splitTrafficAction: SplitTrafficAction,
        private readonly waitForEventAction: WaitForEventAction,
        private readonly sendMessageAction: SendMessageAction,
        private readonly sendEmailAction: SendEmailAction,
        private readonly httpWebhookAction: HttpWebhookAction,
        private readonly addTagAction: AddTagAction,
        private readonly transferToHumanAction: TransferToHumanAction,
        private readonly createScheduleAction: CreateScheduleAction,
        private readonly updateScheduleStatusAction: UpdateScheduleStatusAction,
        private readonly updateTicketAction: UpdateTicketAction,
        private readonly aiIntentAction: AIIntentAction,
        private readonly aiRespondAction: AIRespondAction,
        private readonly analyzeSentimentAction: AnalyzeSentimentAction,
        private readonly transferDepartmentAction: TransferDepartmentAction,
    ) { }

    onModuleInit() {

        /* Control */
        this.actionRegistry.register('delay', this.delayAction);
        this.actionRegistry.register('condition', this.conditionAction);
        this.actionRegistry.register('split_traffic', this.splitTrafficAction);
        this.actionRegistry.register('wait_for_event', this.waitForEventAction);

        /* Business */
        this.actionRegistry.register('send_message', this.sendMessageAction);
        this.actionRegistry.register('send_email', this.sendEmailAction);
        this.actionRegistry.register('http_webhook', this.httpWebhookAction);

        /* Integrations / Escalations */
        this.actionRegistry.register('add_tag', this.addTagAction);
        this.actionRegistry.register('transfer_to_human', this.transferToHumanAction);

        /* Scheduling */
        this.actionRegistry.register('create_schedule', this.createScheduleAction);
        this.actionRegistry.register('update_schedule_status', this.updateScheduleStatusAction);

        /* Tickets */
        this.actionRegistry.register('update_ticket', this.updateTicketAction);

        /* AI */
        this.actionRegistry.register('ai_intent', this.aiIntentAction);
        this.actionRegistry.register('ai_respond', this.aiRespondAction);
        this.actionRegistry.register('analyze_sentiment', this.analyzeSentimentAction);

        /* Transfer */
        this.actionRegistry.register('transfer_department', this.transferDepartmentAction);
    }
}
