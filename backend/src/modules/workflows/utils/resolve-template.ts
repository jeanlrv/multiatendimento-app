import { WorkflowContext } from '../interfaces/action-executor.interface';

/**
 * Resolves {{variableName}} and {{nested.path}} template variables
 * using values from context.variables.
 * Falls back to the original placeholder if the variable is not found.
 */
export function resolveTemplate(value: string, context: WorkflowContext): string {
    if (!value || !value.includes('{{')) return value;
    return value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_: string, path: string) => {
        const resolved = path.split('.').reduce((acc: any, part: string) => acc?.[part], context.variables);
        return resolved !== undefined ? String(resolved) : `{{${path}}}`;
    });
}
