<center>

# boperators
### Operator overloading for JavaScript and TypeScript.

![Sym.JS logo](https://github.com/DiefBell/boperators/blob/653ea138f4dcd1e6b4dd112133a4942f70e91fb3/logo.png)

</center>

Operator overloading is a common programming feature that JavaScript lacks. Just something as simple as adding two vectors requires a `.add()` method or element-by-element assignment.

`boperators` brings operator overloading to JavaScript by leveraging TypeScript typings. You define overloaded methods on a class for whichever operators you want, and at build time we find every usage of those operators and substitute in your method calls.

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

Operator overloads are standard TypeScript methods whose name is the operator string. Both string literal names and computed bracket names are supported — they are equivalent:

```typescript
class Vec2 {
    // String literal name
    static "+"(a: Vec2, b: Vec2): Vec2 { ... }

    // Computed bracket name — identical behaviour
    static ["+"](a: Vec2, b: Vec2): Vec2 { ... }
}
```

Use whichever style you prefer. The examples below use the bracket style.


### Static Operators

Static operators (`+`, `-`, `*`, `/`, `%`, comparisons, logical) are `static` methods with two parameters (LHS and RHS). At least one parameter must match the class type.

```typescript
class Vector3 {
    static ["+"](a: Vector3, b: Vector3): Vector3 {
        return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    // Multiple overloads for different RHS types — use TypeScript overload signatures,
    // then handle all cases in a single implementation.
    static ["*"](a: Vector3, b: Vector3): Vector3;
    static ["*"](a: Vector3, b: number): Vector3;
    static ["*"](a: Vector3, b: Vector3 | number): Vector3 {
        if (b instanceof Vector3) {
            return new Vector3(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x,
            );
        }
        return new Vector3(a.x * b, a.y * b, a.z * b);
    }

    // Comparison operators must return boolean
    static ["=="](a: Vector3, b: Vector3): boolean {
        return a.length() === b.length();
    }
}
```


### Instance Operators

Instance operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&&=`, `||=`) are instance methods with a single parameter (the RHS). They use `this` for the LHS and must return `void`.

```typescript
class Vector3 {
    ["+="](rhs: Vector3): void {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;
    }
}
```

Unlike with JavaScript primitives, you can declare a variable as `const` and still use assignment operators with it, since they only mutate the object.

```typescript
const vec3 = new Vector3(3, 4, 5);
vec3 += new Vector3(6, 7, 8);
```


### Prefix Unary Operators

Prefix unary operators (`-`, `+`, `!`, `~`) are `static` methods with a single parameter matching the class type.

For operators that also have a binary form (`-`, `+`), both can live on the same method — just add overload signatures for each, distinguished by parameter count. The implementation then handles all cases.

```typescript
class Vector3 {
    // Unary-only operator
    static ["!"](a: Vector3): boolean {
        return a.x === 0 && a.y === 0 && a.z === 0;
    }

    // Combined binary + unary on the same operator
    static ["-"](a: Vector3, b: Vector3): Vector3;
    static ["-"](a: Vector3): Vector3;
    static ["-"](a: Vector3, b?: Vector3): Vector3 {
        if (b) return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
        return new Vector3(-a.x, -a.y, -a.z);
    }
}
```


### Postfix Unary Operators

Postfix unary operators (`++`, `--`) are instance methods with no parameters. They mutate the object via `this` and must return `void`.

```typescript
class Counter {
    value = 0;

    ["++"](): void {
        this.value++;
    }
}
```


### Using Overloaded Operators Within Definitions

The transform only applies to **consuming code**, not to the overload definitions themselves. If you need to call an overloaded operator inside an overload body, call the method directly:

```typescript
class Expr {
    static ["-"](inner: Expr): Expr;
    static ["-"](lhs: Expr, rhs: Expr): Expr;
    static ["-"](lhs: Expr, rhs: number): Expr;
    static ["-"](lhs: number, rhs: Expr): Expr;
    static ["-"](lhs: Expr | number, rhs?: Expr | number): Expr {
        if (rhs === undefined) return new Expr.Neg(lhs as Expr);

        // Call the overload methods directly — don't use operator syntax here,
        // as the source transform has not yet run on this code.
        const l = typeof lhs === "number" ? new Expr.Num(lhs) : lhs;
        const r = typeof rhs === "number" ? Expr["-"](new Expr.Num(rhs)) : Expr["-"](rhs);
        return Expr["+"](l, r);
    }
}
```


## How It Works

`boperators` has a two-phase pipeline:

1. **Parse**: `OverloadStore` scans all source files for classes with operator-named methods and indexes them by `(operatorKind, lhsType, rhsType)`.
2. **Transform**: `OverloadInjector` finds binary and unary expressions, looks up matching overloads, and replaces them:
   - **Binary static**: `a + b` becomes `Vector3["+"](a, b)`
   - **Instance compound**: `a += b` becomes `a["+="](b)`
   - **Prefix unary**: `-a` becomes `Vector3["-"](a)`
   - **Postfix unary**: `x++` becomes `x["++"]( )`

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
