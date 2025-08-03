import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {defaultModel} from '../defaults.js';

export type Settings = {
	model: string;
};

export function getCurrentModel(): string {
	try {
		const settingsPath = path.join(process.cwd(), '.mistrado', 'settings.json');
		const settingsContent = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(settingsContent) as Settings;
		return settings.model;
	} catch {
		return defaultModel;
	}
}

export async function updateSettings(
	newSettings: Partial<Settings>,
): Promise<void> {
	const settingsDir = path.join(process.cwd(), '.mistrado');
	const settingsPath = path.join(settingsDir, 'settings.json');

	let currentSettings: Settings = {model: defaultModel};

	try {
		const existingContent = fs.readFileSync(settingsPath, 'utf8');
		currentSettings = JSON.parse(existingContent) as Settings;
	} catch {
		// Create directory if it doesn't exist
		fs.mkdirSync(settingsDir, {recursive: true});
	}

	const updatedSettings = {...currentSettings, ...newSettings};

	fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
}
