import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {defaultModel} from '../defaults.js';

export type Settings = {
	model: string;
};

export function getCurrentModel(
	settingsDir: string = path.join(process.cwd(), '.mistrado'),
): string {
	try {
		const settingsPath = path.join(settingsDir, 'settings.json');
		const settingsContent = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(settingsContent) as Settings;
		return settings.model ?? defaultModel;
	} catch {
		return defaultModel;
	}
}

export async function updateSettings(
	newSettings: Partial<Settings>,
	settingsDir: string = path.join(process.cwd(), '.mistrado'),
): Promise<void> {
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
