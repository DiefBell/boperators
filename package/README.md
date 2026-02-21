<center>

# boperators
### Operator overloading JavaScript and TypeScript.

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

</center>

Operator overloading is a common programming feature that JavaScript lacks. Just something as simple as adding two vectors, we've got to create a `.Add` method or add elements one-at-a-time.

`boperators` finally brings operator overloading to JavaScript by leveraging TypeScript typings. You define one or more overload functions on a class for whichever operators you want, and with magic we search for anywhere you've used overloaded operators and substitute in your functions.

This is the core library and API, and isn't designed to be used directly. Instead, you can use:
- The [Boperators CLI](https://www.npmjs.com/package/@boperators/cli);
- The [`tsc`](https://www.npmjs.com/package/@boperators/plugin-tsc) plugin;
- The [NextJS/Webpack loader](https://www.npmjs.com/package/@boperators/webpack-loader);
- The [Vite plugin](https://www.npmjs.com/package/@boperators/plugin-vite);
- The [ESBuild plugin](https://www.npmjs.com/package/@boperators/plugin-esbuild);
- The [Bun plugin](https://www.npmjs.com/package/@boperators/plugin-bun) for running directly with Bun.

We also offer a [TypeScript Language Server plugin](https://www.npmjs.com/package/@boperators/plugin-ts-language-server) for real-time type hinting and intellisense in your IDE, and an [MCP server](https://www.npmjs.com/package/@boperators/mcp-server) to optimize your vibe coding experience.


## Installation

```sh
npm install -D boperators @boperators/cli @boperators/plugin-ts-language-server
```


## Defining Overloads

Define overloads as property arrays on your classes, using the operator string as the property name. Overload fields are readonly arrays (with `as const` at the end) so you can define multiple overloads for different types. As long as you don't have overlapping typings between any functions, we can work out which one to use in a given situation. 

### Static Operators

Static operators (`+`, `-`, `*`, `/`, `%`, comparisons, logical) are `static readonly` fields with two-parameter functions (LHS and RHS). At least one parameter must match the class type.

Arrow functions or function expressions both work for static operators.

```typescript
class Vector3 {
    static readonly "+" = [
        (a: Vector3, b: Vector3) => new Vector3(a.x + b.x, a.y + b.y, a.z + b.z),
    ] as const;

    // Multiple overloads for different RHS types
    static readonly "*" = [
        function (a: Vector3, b: Vector3): Vector3 {
            return new Vector3(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x,
            );
		},
        function mutliplyByScalar(a: Vector3, b: number): Vector3 {
            return new Vector3(a.x * b, a.y * b, a.z * b);
		}
    ] as const;

    // Comparison operators must return boolean
    static readonly "==" = [
        (a: Vector3, b: Vector3): boolean => a.length() === b.length(),
    ] as const;
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

Unlike with JavaScript primitives, you can declare a variable as `const` and still use assignment operators with this, as they're only mutating the object.

```typescript
const vec3 = new Vector3(3, 4, 5);
vec3 += new Vector3(6, 7, 8);
```

### Prefix Unary Operators

Prefix unary operators (`-`, `+`, `!`, `~`) are `static readonly` fields with one-parameter functions. The parameter must match the class type. For operators that also have binary forms (`-`, `+`), both binary and unary overloads can coexist in the same array, distinguished by parameter count.

```typescript
class Vector3 {
    static readonly "-" = [
		// two parameters means binary operation: `a - b`
        (a: Vector3, b: Vector3) =>
            new Vector3(a.x - b.x, a.y - b.y, a.z - b.z),
		// single parameter means unary operation, e.g. making a value "negative"
        (a: Vector3) =>
            new Vector3(-a.x, -a.y, -a.z), // unary: -a
    ] as const;

    static readonly "!" = [
        (a: Vector3): boolean =>
            a.x === 0 && a.y === 0 && a.z === 0,
    ] as const;
}
```

### Postfix Unary Operators

Postfix unary operators (`++`, `--`) are `readonly` instance fields with zero-parameter functions (only `this`). They mutate the object and must return `void`. Must use function expressions, not arrow functions.

```typescript
class Counter {
    value = 0;

    readonly "++" = [
        function (this: Counter): void {
            this.value++;
        },
    ] as const;
}
```

### Using Overloaded Operators Within Definitions

The transform only applies to **consuming code**, not to the overload definitions themselves. If you need to call an overloaded operator inside an overload body (including on the same class), reference the overload array directly:

```typescript
class Expr {
    static readonly "-" = [
        // unary negation
        (inner: Expr): Expr => new Expr.Neg(inner),

        // binary minus — calls the unary overload and the + overload directly
        (lhs: Expr, rhs: Expr): Expr =>
            lhs + Expr["-"][0](rhs),

        (lhs: Expr, rhs: number): Expr =>
            lhs + Expr["-"][0](new Expr.Num(rhs)),

        (lhs: number, rhs: Expr): Expr =>
            new Expr.Num(lhs) + Expr["-"][0](rhs),
    ] as const;
}
```

Writing `lhs + -rhs` inside the overload body would **not** be transformed, since the source transform has not yet run on this code. Use `ClassName["op"][index](args)` for static overloads and `obj["op"][index].call(obj, args)` for instance overloads.

## How It Works

`boperators` has a two-phase pipeline:

1. **Parse**: `OverloadStore` scans all source files for classes with operator-named properties and indexes them by `(operatorKind, lhsType, rhsType)`.
2. **Transform**: `OverloadInjector` finds binary and unary expressions, looks up matching overloads, and replaces them:
   - **Binary static**: `a + b` becomes `ClassName["+"][0](a, b)`
   - **Binary instance**: `a += b` becomes `a["+="][0].call(a, b)`
   - **Prefix unary**: `-a` becomes `ClassName["-"][1](a)`
   - **Postfix unary**: `x++` becomes `x["++"][0].call(x)`

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
| `-` (unary) | static | Prefix negation (1 param) |
| `+` (unary) | static | Prefix plus (1 param) |
| `!` | static | Prefix logical NOT (1 param) |
| `~` | static | Prefix bitwise NOT (1 param) |
| `++` | instance | Postfix increment, must return `void` |
| `--` | instance | Postfix decrement, must return `void` |

## Conflict Detection

When parsing overload definitions, if there are duplicate overloads with matching `(operator, lhsType, rhsType)`, a warning is shown (or an error if `--error-on-warning` is set via the CLI).

## License

MIT
