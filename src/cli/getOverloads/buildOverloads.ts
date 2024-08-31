import ts from "typescript";
import { OperatorOverload } from "../types/OperatorOverload";
import { isPrimitive, type PrimitiveType } from "../types/PrimitiveType";
import type { WithErrorList } from "../types/WithErrorList";
import type { PropertyOperatorSymbolPair } from "./filterOverloadPropertyDeclarations";

/**
 * Builds metadata for operator overloads from given property declarations.
 * This method processes each property declaration to extract operator overload functions
 * and their associated metadata based on the following rules:
 *
 * - **Valid Declarations**: Only considers declarations that are object literal expressions.
 * - **Initializer Check**: Skips declarations that do not have an initializer.
 * - **Class Type Extraction**: Extracts the class type from the declaration, if available.
 * - **Function Validity**: Processes functions that are either `FunctionDeclaration`, `ArrowFunction`,
 *   or `FunctionExpression` and verifies that they have 1 or 2 parameters.
 * - **Return Type Check**: Skips functions that do not have a return type.
 * - **Parameter Type Handling**:
 *   - For 1-parameter functions:
 *     - Sets the `left` type as the class type and the `right` type as the type of the function parameter.
 *   - For 2-parameter functions:
 *     - Sets `left` and `right` types based on the function parameters.
 *     - Ensures that one of the parameters matches the class type (when applicable).
 * - **Primitive Types Handling**: Primitive types (`number`, `string`, `boolean`) are converted to their string representation.
 *
 * Logs warnings for any issues encountered during processing, such as invalid initializers,
 * unresolved parameter types, or functions that do not meet the required criteria.
 *
 * @param declarations An array of `ts.PropertyDeclaration` objects representing operator overload declarations.
 * @returns An array of `OperatorOverrideMetadata` instances, each representing valid operator overload metadata.
 */
export const buildOverloads = (
	checker: ts.TypeChecker,
	declarations: PropertyOperatorSymbolPair[]
): WithErrorList<OperatorOverload[]> =>
{
	const overloadsAndErrors: WithErrorList<OperatorOverload[]> = {
		value: [],
		errorList: [],
	};

	// Helper function to check if a type is primitive and return its string representation
	const getPrimitiveTypeString = (type: ts.Type): PrimitiveType | undefined =>
	{
		const typeName = checker.typeToString(type);
		return isPrimitive(typeName) ? typeName : undefined;
	};

	declarations.forEach(({
		declaration,
		operatorSymbol, // just so we can save it with the rest of the metadata
	}) =>
	{
		if (!declaration.initializer)
		{
			console.warn("Declaration does not have an initializer.");
			return;
		}

		if (!ts.isObjectLiteralExpression(declaration.initializer))
		{
			console.warn("Declaration initializer is not a valid object literal.");
			return;
		}

		const classType = getClassTypeFromDeclaration(checker, declaration);

		if (!classType)
		{
			console.warn("Could not determine the class type from declaration.");
			return;
		}

		const overrides = declaration.initializer.properties;

		overrides.forEach((override) =>
		{
			if (!ts.isPropertyAssignment(override) || !ts.isStringLiteral(override.name))
			{
				console.warn("Property is not a valid string:function assignment.");
				return;
			}

			const overrideName = override.name.text;
			const initializer = override.initializer;
			let func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined;
			let parameters: readonly ts.ParameterDeclaration[] | undefined;

			if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer) || ts.isFunctionDeclaration(initializer))
			{
				func = initializer;
				parameters = initializer.parameters;
			}

			if (!func || !parameters)
			{
				console.warn("Initializer is not a function expression, arrow function, or function declaration.");
				return;
			}

			if (parameters.length < 1 || parameters.length > 2)
			{
				console.warn("Function does not have 1 or 2 parameters.");
				return;
			}

			const signature = checker.getSignatureFromDeclaration(func);
			const returnType = signature ? checker.getReturnTypeOfSignature(signature) : undefined;

			if (!returnType || (returnType.flags & ts.TypeFlags.Void))
			{
				console.warn("Function does not have a return type.");
				return;
			}

			let leftType: ts.Type | PrimitiveType | undefined;
			let rightType: ts.Type | PrimitiveType | undefined;

			if (parameters.length === 1)
			{
				leftType = classType;
				const paramType = checker.getTypeAtLocation(parameters[0]);
				if (paramType)
				{
					leftType = classType;
					rightType = getPrimitiveTypeString(paramType) || paramType;
				}
				else
				{
					console.warn("Parameter type for single-parameter function is not correctly resolved.");
					return;
				}
			}
			else if (parameters.length === 2)
			{
				const param1Type = checker.getTypeAtLocation(parameters[0]);
				const param2Type = checker.getTypeAtLocation(parameters[1]);

				if (param1Type && param2Type)
				{
					if (!typeIsEqual(checker, param1Type, classType) && !typeIsEqual(checker, param2Type, classType))
					{
						console.warn("Neither parameter matches the class type.");
						return;
					}

					leftType = getPrimitiveTypeString(param1Type) || param1Type;
					rightType = getPrimitiveTypeString(param2Type) || param2Type;
				}
				else
				{
					console.warn("Failed to resolve one or both parameter types for two-parameter function.");
					return;
				}
			}

			if (leftType && rightType)
			{
				overloadsAndErrors.value.push(new OperatorOverload(
					checker,
					overrideName,
					leftType,
					rightType,
					func,
					operatorSymbol,
					checker.getSymbolAtLocation(declaration.name)!,
					classType
				));
			}
			else
			{
				console.warn("Failed to resolve both parameter types.");
			}
		});
	});

	return overloadsAndErrors;
};

/**
 * Retrieves the TypeScript `ts.Type` of the class to which the provided property declaration belongs.
 *
 * @param declaration - The property declaration whose class type is to be determined.
 * @returns The `ts.Type` representing the class or undefined if the class type can't be determined.
 */
const getClassTypeFromDeclaration = (checker: ts.TypeChecker, declaration: ts.PropertyDeclaration): ts.Type | undefined =>
{
	// Get the parent of the declaration
	const parentClass = declaration.parent;

	// Check if the parent is a class declaration
	if (ts.isClassDeclaration(parentClass) && parentClass.name)
	{
		// Use the type checker to get the type of the class
		const classType = checker.getTypeAtLocation(parentClass.name);
		return classType;
	}

	return undefined;
};

/**
 * Compares two TypeScript types to determine if they are equivalent.
 *
 * @param typeA - The first TypeScript type to compare.
 * @param typeB - The second TypeScript type to compare.
 * @returns `true` if the types are considered equivalent, `false` otherwise.
 */
const typeIsEqual = (checker: ts.TypeChecker, typeA: ts.Type, typeB: ts.Type): boolean =>
{
	// Direct reference equality check
	if (typeA === typeB)
	{
		return true;
	}

	// Check if types are structurally equivalent
	if (checker.isTypeAssignableTo(typeA, typeB) && checker.isTypeAssignableTo(typeB, typeA))
	{
		return true;
	}

	return false;
};
