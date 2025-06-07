import keytar from 'keytar';

const SERVICE_NAME = 'Mistrado';

type Key = 'MISTRAL_API_KEY';

export async function getSecret(key: Key): Promise<string | null> {
	return keytar.getPassword(SERVICE_NAME, key);
}

export async function setSecret({
	key,
	value,
}: {
	key: Key;
	value: string;
}): Promise<void> {
	await keytar.setPassword(SERVICE_NAME, key, value);
}

export async function deleteSecret(key: Key): Promise<void> {
	await keytar.deletePassword(SERVICE_NAME, key);
}
