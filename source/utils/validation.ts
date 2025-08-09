type ValidationResult<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
			details?: string[];
	  };

export function validateSchema<T>(
	data: unknown,
	schema: unknown,
	toolName?: string,
): ValidationResult<T> {
	try {
		const result = validateValue(data, schema, []);

		if (result.errors.length > 0) {
			const errorPrefix = toolName
				? `${toolName} validation failed`
				: 'Validation failed';
			return {
				success: false,
				error: `${errorPrefix}: ${result.errors[0]}`,
				details: result.errors,
			};
		}

		return {
			success: true,
			data: data as T,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorPrefix = toolName
			? `${toolName} validation error`
			: 'Validation error';
		return {
			success: false,
			error: `${errorPrefix}: ${errorMessage}`,
		};
	}
}

function validateValue(
	value: unknown,
	schema: unknown,
	path: string[],
): {errors: string[]} {
	const errors: string[] = [];
	const pathString = path.length > 0 ? path.join('.') : 'root';

	// Ensure schema is an object
	if (!schema || typeof schema !== 'object') {
		return {errors};
	}

	const s = schema as Record<string, unknown>;

	// Type validation
	const typeError = validateType(value, s, pathString);
	if (typeError) {
		errors.push(typeError);
		return {errors};
	}

	// Validate based on type
	if (s['type'] === 'object' && typeof value === 'object' && value !== null) {
		errors.push(...validateObject(value, s, path, pathString));
	}

	if (s['type'] === 'array' && Array.isArray(value)) {
		errors.push(...validateArray(value, s, path, pathString));
	}

	if (s['type'] === 'string' && typeof value === 'string') {
		errors.push(...validateString(value, s, pathString));
	}

	if (
		(s['type'] === 'number' || s['type'] === 'integer') &&
		typeof value === 'number'
	) {
		errors.push(...validateNumber(value, s, pathString));
	}

	return {errors};
}

function validateType(
	value: unknown,
	schema: Record<string, unknown>,
	pathString: string,
): string | undefined {
	if (schema['type'] && typeof schema['type'] === 'string') {
		const actualType = getJsonType(value);
		const expectedType = schema['type'];

		// Special case: integer is a subset of number in JSON Schema
		if (expectedType === 'integer' && actualType === 'number') {
			// This will be validated later in validateNumber
			return undefined;
		}

		if (actualType !== expectedType) {
			return `${pathString}: expected ${expectedType}, got ${actualType}`;
		}
	}

	return undefined;
}

function validateObject(
	value: unknown,
	schema: Record<string, unknown>,
	path: string[],
	pathString: string,
): string[] {
	const errors: string[] = [];
	const object = value as Record<string, unknown>;

	// Required properties
	if (Array.isArray(schema['required'])) {
		for (const requiredProp of schema['required']) {
			if (typeof requiredProp === 'string' && !(requiredProp in object)) {
				errors.push(
					`${pathString}: missing required property '${requiredProp}'`,
				);
			}
		}
	}

	// Additional properties
	if (schema['additionalProperties'] === false) {
		const allowedProps = new Set(
			Object.keys((schema['properties'] as Record<string, unknown>) || {}),
		);
		for (const prop of Object.keys(object)) {
			if (!allowedProps.has(prop)) {
				errors.push(`${pathString}: unexpected property '${prop}'`);
			}
		}
	}

	// Property validation
	if (schema['properties'] && typeof schema['properties'] === 'object') {
		for (const [prop, propSchema] of Object.entries(schema['properties'])) {
			if (prop in object) {
				const propResult = validateValue(object[prop], propSchema, [
					...path,
					prop,
				]);
				errors.push(...propResult.errors);
			}
		}
	}

	return errors;
}

function validateArray(
	value: unknown[],
	schema: Record<string, unknown>,
	path: string[],
	pathString: string,
): string[] {
	const errors: string[] = [];

	if (
		typeof schema['minItems'] === 'number' &&
		value.length < schema['minItems']
	) {
		errors.push(
			`${pathString}: array must have at least ${schema['minItems']} items`,
		);
	}

	if (
		typeof schema['maxItems'] === 'number' &&
		value.length > schema['maxItems']
	) {
		errors.push(
			`${pathString}: array must have at most ${schema['maxItems']} items`,
		);
	}

	if (schema['items']) {
		for (const [index, item] of value.entries()) {
			const itemResult = validateValue(item, schema['items'], [
				...path,
				index.toString(),
			]);
			errors.push(...itemResult.errors);
		}
	}

	return errors;
}

function validateString(
	value: string,
	schema: Record<string, unknown>,
	pathString: string,
): string[] {
	const errors: string[] = [];

	if (
		typeof schema['minLength'] === 'number' &&
		value.length < schema['minLength']
	) {
		errors.push(
			`${pathString}: string must be at least ${schema['minLength']} characters`,
		);
	}

	if (
		typeof schema['maxLength'] === 'number' &&
		value.length > schema['maxLength']
	) {
		errors.push(
			`${pathString}: string must be at most ${schema['maxLength']} characters`,
		);
	}

	if (typeof schema['pattern'] === 'string') {
		const regex = new RegExp(schema['pattern']);
		if (!regex.test(value)) {
			errors.push(
				`${pathString}: string does not match pattern ${schema['pattern']}`,
			);
		}
	}

	if (Array.isArray(schema['enum']) && !schema['enum'].includes(value)) {
		errors.push(
			`${pathString}: value must be one of ${schema['enum'].map(v => JSON.stringify(v)).join(', ')}`,
		);
	}

	return errors;
}

function validateNumber(
	value: number,
	schema: Record<string, unknown>,
	pathString: string,
): string[] {
	const errors: string[] = [];

	if (typeof schema['minimum'] === 'number' && value < schema['minimum']) {
		errors.push(`${pathString}: number must be at least ${schema['minimum']}`);
	}

	if (typeof schema['maximum'] === 'number' && value > schema['maximum']) {
		errors.push(`${pathString}: number must be at most ${schema['maximum']}`);
	}

	if (schema['type'] === 'integer' && !Number.isInteger(value)) {
		errors.push(`${pathString}: value must be an integer`);
	}

	return errors;
}

function getJsonType(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	if (typeof value === 'object') return 'object';
	return typeof value;
}
