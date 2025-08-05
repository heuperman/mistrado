import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {validateSchema} from '../utils/validation.js';

export type TodoItem = {
	id: string;
	content: string;
	status: 'pending' | 'in_progress' | 'completed';
	priority: 'high' | 'medium' | 'low';
};

export const todoWriteTool: Tool = {
	name: 'TodoWrite',
	description:
		'Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.\n\nWhen to Use This Tool:\n- Complex multi-step tasks (3+ steps)\n- Non-trivial and complex tasks requiring careful planning\n- User explicitly requests todo list\n- User provides multiple tasks\n- After receiving new instructions\n- When starting work on a task (mark as in_progress)\n- After completing a task (mark as completed)\n\nTask States:\n- pending: Task not yet started\n- in_progress: Currently working on (limit to ONE task at a time)\n- completed: Task finished successfully\n\nTask Management:\n- Update task status in real-time as you work\n- Mark tasks complete IMMEDIATELY after finishing\n- Only have ONE task in_progress at any time\n- Complete current tasks before starting new ones\n- Remove tasks that are no longer relevant from the list entirely',
	inputSchema: {
		type: 'object',
		properties: {
			todos: {
				type: 'array',
				description: 'The updated todo list',
				items: {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							description: 'Unique identifier for the todo item',
						},
						content: {
							type: 'string',
							minLength: 1,
							description: 'Task description',
						},
						status: {
							type: 'string',
							enum: ['pending', 'in_progress', 'completed'],
							description: 'Current status of the task',
						},
						priority: {
							type: 'string',
							enum: ['high', 'medium', 'low'],
							description: 'Priority level of the task',
						},
					},
					required: ['id', 'content', 'status', 'priority'],
					additionalProperties: false,
				},
			},
		},
		required: ['todos'],
		additionalProperties: false,
	},
};

export async function handleTodoWriteTool(
	args: unknown,
	todoStorage: Map<string, TodoItem[]>,
) {
	const validation = validateSchema<{
		todos: TodoItem[];
	}>(args, todoWriteTool.inputSchema, 'TodoWrite');

	if (!validation.success) {
		return {
			content: [
				{
					type: 'text' as const,
					text: validation.error,
				},
			],
			isError: true,
		};
	}

	try {
		const {todos} = validation.data;

		// Validate business rules
		const inProgressTodos = todos.filter(todo => todo.status === 'in_progress');
		if (inProgressTodos.length > 1) {
			return {
				content: [
					{
						type: 'text' as const,
						text: 'Error: Only one task can be in_progress at a time. Found multiple in_progress tasks.',
					},
				],
				isError: true,
			};
		}

		// Store the updated todo list (using 'session' as the key for now)
		todoStorage.set('session', todos);

		const totalTasks = todos.length;
		const completedTasks = todos.filter(
			todo => todo.status === 'completed',
		).length;
		const inProgressTask =
			inProgressTodos.length > 0 ? inProgressTodos[0] : null;

		let statusMessage = `Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress.`;

		if (inProgressTask) {
			statusMessage += ` Currently working on: "${inProgressTask.content}".`;
		}

		if (totalTasks > 0) {
			statusMessage += ` Progress: ${completedTasks}/${totalTasks} tasks completed.`;
		}

		statusMessage += ' Please proceed with the current tasks if applicable';

		return {
			content: [
				{
					type: 'text' as const,
					text: statusMessage,
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: 'text' as const,
					text: `Error: ${errorMessage}`,
				},
			],
			isError: true,
		};
	}
}
