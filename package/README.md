# boperators

Operator overloading for TypeScript.

`boperators` lets you define operator overloads on your TypeScript classes and transforms binary expressions into the corresponding overload calls at the source level.

## Installation

```sh
bun add boperators
# or
npm install boperators
```

## Defining Overloads

Define overloads as property arrays on your classes, using the operator string as the property name. Overload fields are arrays so you can define multiple overloads for different types.

### Static Operators

Static operators (`+`, `-`, `*`, `/`, `%`, comparisons, logical) are `static readonly` fields with two-parameter functions (LHS and RHS). At least one parameter must match the class type.

Arrow functions or function expressions both work for static operators.

```typescript
class Vector3 {
    // String literal property name
    static readonly "+" = [
        (a: Vector3, b: Vector3) =>
            new Vector3(a.x + b.x, a.y + b.y, a.z + b.z),
    ];

    // Multiple overloads for different RHS types
    static readonly "*" = [
        (a: Vector3, b: Vector3): Vector3 =>
            new Vector3(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x,
            ),
        (a: Vector3, b: number): Vector3 =>
            new Vector3(a.x * b, a.y * b, a.z * b),
    ] as const;

    // Comparison operators must return boolean
    static readonly "==" = [
        (a: Vector3, b: Vector3): boolean =>
            a.length() === b.length(),
    ];
}
```

### Instance Operators

Instance operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&&=`, `||=`) are `readonly` instance fields with a single parameter (the RHS). They use `this` to mutate the LHS object and must return `void`.

Instance operators **must** use function expressions (not arrow functions), because arrow functions cannot bind `this`.

```typescript
class Vector3 {
    readonly "+=" = [
        function (this: Vector3, rhs: Vector3): void {
            this.x += rhs.x;
            this.y += rhs.y;
            this.z += rhs.z;
        },
    ];
}
```

### Using the Operator Enum

Instead of string literals, you can use the `Operator` enum for computed property names:

```typescript
import { Operator } from "boperators";

class Angle {
    static readonly [Operator.MODULO] = [
        (angle: Angle, rads: number): Angle =>
            new Angle(angle.radians % rads),
    ];
}
```

## How It Works

`boperators` has a two-phase pipeline:

1. **Parse**: `OverloadStore` scans all source files for classes with operator-named properties and indexes them by `(operatorKind, lhsType, rhsType)`.
2. **Transform**: `OverloadInjector` finds binary expressions, looks up matching overloads, and replaces them:
   - **Static**: `a + b` becomes `ClassName["+"][0](a, b)`
   - **Instance**: `a += b` becomes `a["+="][0].call(a, b)`

Imports for referenced classes are automatically added where needed.

## Supported Operators

| Operator | Type | Notes |
|----------|------|-------|
| `+` | static | |
| `-` | static | |
| `*` | static | |
| `/` | static | |
| `%` | static | |
| `+=` | instance | Must return `void` |
| `-=` | instance | Must return `void` |
| `*=` | instance | Must return `void` |
| `/=` | instance | Must return `void` |
| `%=` | instance | Must return `void` |
| `>` | static | Must return `boolean` |
| `>=` | static | Must return `boolean` |
| `<` | static | Must return `boolean` |
| `<=` | static | Must return `boolean` |
| `==` | static | Must return `boolean` |
| `===` | static | Must return `boolean` |
| `!=` | static | Must return `boolean` |
| `!==` | static | Must return `boolean` |
| `&&` | static | |
| `\|\|` | static | |
| `??` | static | |
| `&&=` | instance | Must return `void` |
| `\|\|=` | instance | Must return `void` |

## API

The core library exports the transformation pipeline for use in plugins and tooling:

```typescript
import { OverloadStore, OverloadInjector, ErrorManager } from "boperators";
import { Project } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const errorManager = new ErrorManager(false);
const store = new OverloadStore(project, errorManager);
const injector = new OverloadInjector(project, store);

// Phase 1: Parse overload definitions from all files
for (const file of project.getSourceFiles()) {
    store.addOverloadsFromFile(file);
}
errorManager.throwIfErrorsElseLogWarnings();

// Phase 2: Transform binary expressions
for (const file of project.getSourceFiles()) {
    injector.overloadFile(file);
}
```

The `Operator` enum and `operatorSymbols` array are also exported for defining overloads with computed property names.

## Conflict Detection

When parsing overload definitions, if there are duplicate overloads with matching `(operator, lhsType, rhsType)`, a warning is shown (or an error if `--error-on-warning` is set via the CLI).

## License

MIT
