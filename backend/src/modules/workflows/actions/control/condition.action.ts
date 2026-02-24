import { ActionExecutor, ActionResult, WorkflowContext } from '../../interfaces/action-executor.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConditionAction implements ActionExecutor {
    private readonly logger = new Logger(ConditionAction.name);

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.debug(`Executing Condition: ${JSON.stringify(params)}`);

        const conditions = params.conditions || [];
        const logic = (params.logic || 'AND').toUpperCase();
        const isTrue = this.evaluateConditionSet(conditions, context, logic as 'AND' | 'OR');

        return {
            success: true,
            data: { result: isTrue ? 'true' : 'false' }
        };
    }

    private evaluateConditionSet(conditions: any[], context: WorkflowContext, logic: 'AND' | 'OR' = 'AND'): boolean {
        if (!conditions || conditions.length === 0) return true;

        if (logic === 'OR') {
            for (const condition of conditions) {
                if (this.evaluateCondition(condition, context)) {
                    return true;
                }
            }
            return false;
        }

        // Default: AND logic
        for (const condition of conditions) {
            if (!this.evaluateCondition(condition, context)) {
                return false;
            }
        }
        return true;
    }

    private evaluateCondition(condition: any, context: WorkflowContext): boolean {
        const { field, operator, value } = condition;

        const actualValue = this.resolveValue(field, context);

        let expectedValue = value;
        // Resolve expected value if it's a template variable like {{something}}
        if (typeof value === 'string' && value.includes('{{')) {
            expectedValue = this.resolveTemplateString(value, context);
        }

        const safeActual = actualValue !== undefined && actualValue !== null ? actualValue : '';
        const safeExpected = expectedValue !== undefined && expectedValue !== null ? expectedValue : '';

        switch (operator) {
            case '=':
            case 'equals':
                return String(safeActual) === String(safeExpected);
            case '!=':
            case 'not_equals':
                return String(safeActual) !== String(safeExpected);
            case 'contains':
                return String(safeActual).toLowerCase().includes(String(safeExpected).toLowerCase());
            case '>':
            case 'greater_than':
                return Number(safeActual) > Number(safeExpected);
            case '<':
            case 'less_than':
                return Number(safeActual) < Number(safeExpected);
            case '>=':
                return Number(safeActual) >= Number(safeExpected);
            case '<=':
                return Number(safeActual) <= Number(safeExpected);
            default:
                return false;
        }
    }

    private resolveValue(path: string, context: WorkflowContext): any {
        if (!path) return undefined;
        // If it comes wrapped in {{}} unwrap it
        const cleanPath = path.replace(/\{\{|\}\}/g, '').trim();

        // Search in context.variables first
        const val = cleanPath.split('.').reduce((acc: any, part: string) => acc?.[part], context.variables);
        if (val !== undefined) return val;

        // If not found in variables, try context root (e.g., ticketId)
        return cleanPath.split('.').reduce((acc: any, part: string) => acc?.[part], context);
    }

    private resolveTemplateString(template: string, context: WorkflowContext): string {
        return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_: string, path: string) => {
            const val = this.resolveValue(path, context);
            return val !== undefined ? String(val) : '';
        });
    }
}
