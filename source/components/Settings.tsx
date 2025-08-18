import React, {useState} from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import {updateSettings, getCurrentModel} from '../utils/settings.js';
import {defaultModel} from '../defaults.js';

type SettingsProps = {
	readonly onComplete: (message: string) => void;
};

const availableModels = [
	{
		description: 'free smaller tool use model with usage limits (default)',
		value: defaultModel,
	},
	{
		description: 'more powerful tool use model',
		value: 'devstral-medium-latest',
	},
];

export function Settings({onComplete}: SettingsProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const currentModel = getCurrentModel();

	const items = availableModels.map(model => ({
		...model,
		label:
			model.value === currentModel
				? `${model.value} - ${model.description} (current)`
				: `${model.value} - ${model.description}`,
	}));

	const handleSelect = async (item: {label: string; value: string}) => {
		if (item.value === currentModel) {
			onComplete('No changes made - same model already selected.');
			return;
		}

		setIsUpdating(true);

		try {
			await updateSettings({model: item.value});
			onComplete(
				`Model changed to ${item.value}. Settings saved to .mistrado/settings.json`,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			onComplete(`Failed to update settings: ${errorMessage}`);
		}
	};

	if (isUpdating) {
		return (
			<Box flexDirection="column">
				<Text>Updating settings...</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold>Select Model:</Text>
			<Text dimColor>Current: {currentModel}</Text>
			<Text dimColor>
				Use arrow keys to navigate, Enter to select, Ctrl+C to cancel
			</Text>
			<Box marginTop={1}>
				<SelectInput items={items} onSelect={handleSelect} />
			</Box>
		</Box>
	);
}
