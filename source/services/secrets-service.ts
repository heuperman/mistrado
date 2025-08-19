import keytar from 'keytar';

const serviceName = 'Mistrado';

type Key = 'MISTRAL_API_KEY';

export async function getSecret(key: Key): Promise<string | undefined> {
	return (await keytar.getPassword(serviceName, key)) ?? undefined;
}

export async function setSecret({
	key,
	value,
}: {
	key: Key;
	value: string;
}): Promise<void> {
	await keytar.setPassword(serviceName, key, value);
}

export async function deleteSecret(key: string): Promise<void> {
	await keytar.deletePassword(serviceName, key);
}
