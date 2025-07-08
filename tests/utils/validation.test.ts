import test from 'ava';
import {validateSchema} from '../../source/utils/validation.js';

// Basic validation tests
test('validateSchema returns success for valid data', t => {
	const schema = {
		type: 'object',
		properties: {
			name: {type: 'string'},
			age: {type: 'number'},
		},
		required: ['name'],
	};

	const result = validateSchema({name: 'John', age: 30}, schema);

	t.true(result.success);
	if (result.success) {
		t.deepEqual(result.data, {name: 'John', age: 30});
	}
});

test('validateSchema returns error for invalid type', t => {
	const schema = {
		type: 'string',
	};

	const result = validateSchema(123, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('expected string, got number'));
	}
});

test('validateSchema includes tool name in error message', t => {
	const schema = {
		type: 'string',
	};

	const result = validateSchema(123, schema, 'TestTool');

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.startsWith('TestTool validation failed'));
	}
});

test('validateSchema handles non-object schema gracefully', t => {
	const result = validateSchema({name: 'John'}, null);

	t.true(result.success);
	if (result.success) {
		t.deepEqual(result.data, {name: 'John'});
	}
});

// Object validation tests
test('validates required properties', t => {
	const schema = {
		type: 'object',
		properties: {
			name: {type: 'string'},
			email: {type: 'string'},
		},
		required: ['name', 'email'],
	};

	const result = validateSchema({name: 'John'}, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes("missing required property 'email'"));
	}
});

test('validates additional properties when additionalProperties is false', t => {
	const schema = {
		type: 'object',
		properties: {
			name: {type: 'string'},
		},
		additionalProperties: false,
	};

	const result = validateSchema({name: 'John', age: 30}, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes("unexpected property 'age'"));
	}
});

test('allows additional properties when additionalProperties is not false', t => {
	const schema = {
		type: 'object',
		properties: {
			name: {type: 'string'},
		},
	};

	const result = validateSchema({name: 'John', age: 30}, schema);

	t.true(result.success);
});

test('validates nested object properties', t => {
	const schema = {
		type: 'object',
		properties: {
			user: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					age: {type: 'number'},
				},
				required: ['name'],
			},
		},
		required: ['user'],
	};

	const result = validateSchema({user: {age: 30}}, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes("user: missing required property 'name'"));
	}
});

// Array validation tests
test('validates array minItems constraint', t => {
	const schema = {
		type: 'array',
		minItems: 2,
	};

	const result = validateSchema([1], schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('array must have at least 2 items'));
	}
});

test('validates array maxItems constraint', t => {
	const schema = {
		type: 'array',
		maxItems: 2,
	};

	const result = validateSchema([1, 2, 3], schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('array must have at most 2 items'));
	}
});

test('validates array items', t => {
	const schema = {
		type: 'array',
		items: {
			type: 'string',
		},
	};

	const result = validateSchema(['hello', 123], schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('1: expected string, got number'));
	}
});

test('validates complex array items', t => {
	const schema = {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {type: 'number'},
				name: {type: 'string'},
			},
			required: ['id'],
		},
	};

	const result = validateSchema(
		[{id: 1, name: 'John'}, {name: 'Jane'}],
		schema,
	);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes("1: missing required property 'id'"));
	}
});

// String validation tests
test('validates string minLength constraint', t => {
	const schema = {
		type: 'string',
		minLength: 5,
	};

	const result = validateSchema('hi', schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('string must be at least 5 characters'));
	}
});

test('validates string maxLength constraint', t => {
	const schema = {
		type: 'string',
		maxLength: 5,
	};

	const result = validateSchema('hello world', schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('string must be at most 5 characters'));
	}
});

test('validates string pattern constraint', t => {
	const schema = {
		type: 'string',
		pattern: '^[a-zA-Z]+$',
	};

	const result = validateSchema('hello123', schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('string does not match pattern'));
	}
});

test('string pattern validation passes for valid pattern', t => {
	const schema = {
		type: 'string',
		pattern: '^[a-zA-Z]+$',
	};

	const result = validateSchema('hello', schema);

	t.true(result.success);
});

// Number validation tests
test('validates number minimum constraint', t => {
	const schema = {
		type: 'number',
		minimum: 10,
	};

	const result = validateSchema(5, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('number must be at least 10'));
	}
});

test('validates number maximum constraint', t => {
	const schema = {
		type: 'number',
		maximum: 10,
	};

	const result = validateSchema(15, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('number must be at most 10'));
	}
});

test('validates integer type constraint', t => {
	const schema = {
		type: 'integer',
	};

	const result = validateSchema(3.14, schema);

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('value must be an integer'));
	}
});

test('integer validation passes for whole numbers', t => {
	const schema = {
		type: 'integer',
	};

	const result = validateSchema(42, schema);

	t.true(result.success);
});

// Complex nested validation tests
test('validates deeply nested objects with arrays', t => {
	const schema = {
		type: 'object',
		properties: {
			users: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						profile: {
							type: 'object',
							properties: {
								name: {type: 'string', minLength: 1},
								tags: {
									type: 'array',
									items: {type: 'string'},
								},
							},
							required: ['name'],
						},
					},
					required: ['profile'],
				},
			},
		},
		required: ['users'],
	};

	const result = validateSchema(
		{
			users: [
				{
					profile: {
						name: 'John',
						tags: ['admin', 'user'],
					},
				},
				{
					profile: {
						name: '',
						tags: ['user', 123],
					},
				},
			],
		},
		schema,
	);

	t.false(result.success);
	if (!result.success) {
		// Should catch the first error (empty name or invalid tag)
		t.true(
			result.error.includes('string must be at least 1 characters') ||
				result.error.includes('expected string, got number'),
		);
	}
});

// Error message and path tests
test('provides detailed error paths for nested validation', t => {
	const schema = {
		type: 'object',
		properties: {
			config: {
				type: 'object',
				properties: {
					database: {
						type: 'object',
						properties: {
							port: {type: 'number'},
						},
						required: ['port'],
					},
				},
				required: ['database'],
			},
		},
		required: ['config'],
	};

	const result = validateSchema(
		{
			config: {
				database: {},
			},
		},
		schema,
	);

	t.false(result.success);
	if (!result.success) {
		t.true(
			result.error.includes(
				"config.database: missing required property 'port'",
			),
		);
	}
});

test('handles validation errors gracefully', t => {
	const schema = {
		type: 'string',
		pattern: '[invalid regex',
	};

	const result = validateSchema('test', schema, 'TestTool');

	t.false(result.success);
	if (!result.success) {
		t.true(result.error.includes('TestTool validation error'));
	}
});

// Real-world tool schema tests
test('validates edit tool schema', t => {
	const editSchema = {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
			},
			oldString: {
				type: 'string',
			},
			newString: {
				type: 'string',
			},
			replaceAll: {
				type: 'boolean',
				default: false,
			},
		},
		required: ['filePath', 'oldString', 'newString'],
		additionalProperties: false,
	};

	// Valid case
	const validResult = validateSchema(
		{
			filePath: '/path/to/file.txt',
			oldString: 'old text',
			newString: 'new text',
			replaceAll: true,
		},
		editSchema,
		'Edit',
	);

	t.true(validResult.success);

	// Invalid case - missing required field
	const invalidResult = validateSchema(
		{
			filePath: '/path/to/file.txt',
			oldString: 'old text',
		},
		editSchema,
		'Edit',
	);

	t.false(invalidResult.success);
	if (!invalidResult.success) {
		t.true(
			invalidResult.error.includes("missing required property 'newString'"),
		);
	}
});

test('validates multi-edit tool schema', t => {
	const multiEditSchema = {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
			},
			edits: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						oldString: {
							type: 'string',
						},
						newString: {
							type: 'string',
						},
						replaceAll: {
							type: 'boolean',
							default: false,
						},
					},
					required: ['oldString', 'newString'],
					additionalProperties: false,
				},
				minItems: 1,
			},
		},
		required: ['filePath', 'edits'],
		additionalProperties: false,
	};

	// Valid case
	const validResult = validateSchema(
		{
			filePath: '/path/to/file.txt',
			edits: [
				{oldString: 'old1', newString: 'new1'},
				{oldString: 'old2', newString: 'new2', replaceAll: true},
			],
		},
		multiEditSchema,
		'MultiEdit',
	);

	t.true(validResult.success);

	// Invalid case - empty edits array
	const invalidResult = validateSchema(
		{
			filePath: '/path/to/file.txt',
			edits: [],
		},
		multiEditSchema,
		'MultiEdit',
	);

	t.false(invalidResult.success);
	if (!invalidResult.success) {
		t.true(invalidResult.error.includes('array must have at least 1 items'));
	}
});
