<center>

# boperators
### Operator Overloading for TypeScript

</center>

`boperators` is a package to allow you to "overload" operators, e.g. -, *, +=, etc, in your TypeScript classes, similar to what a lot of other languages allow.
To define an operator overload, import an operator symbol, use it as the name for a property in your class, and define your overrides!

## Basic example

This uses an anonymous function to overload adding two vectors together using `v1 + v2`, and a named function for adding a vector to the current one using `v3 += v4` and multiplying by a number `v5 *= 10`. Note how the overload fields are arrays: you can define multiple overloads for different types, and `boperators` will then insert the correct one!

Arrow functions are not allowed in overloads, as they cannot bind `this` correctly for instance operators.

```typescript
import { PLUS, PLUS_EQUALS, MULTIPLY_EQUALS } from "boperators";

class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    // Note the use of square brackets!
    static readonly [PLUS] = [
        function(lhs: Vector3, rhs: Vector3): Vector3 {
            return new Vector3(lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z);
        },
    ];

    // Assignment operators use instance fields
    readonly [PLUS_EQUALS] = [
        function(this: Vector3, rhs: Vector3): void {
            this.x += rhs.x;
            this.y += rhs.y;
            this.z += rhs.z;
        }
    ];

    readonly [MULTIPLY_EQUALS] = [
        function multiplyByAScalar(this: Vector3, scalar: number): void {
            this.x *= scalar;
            this.y *= scalar;
            this.z *= scalar;
        }
    ];

    // Rest of the class...
}
```

## Bun Plugin
The easiest way to use `boperators` is as a plugin for Bun. To ensure that it is called each time you, add the plugin to your `bunfig.toml`:
```toml
preload = ["./node_modules/boperators/dist/plugin/index.js"]
```

## CLI

The CLI can be used to generate TypeScript files for debugging, further processing, or just running directly with a tool such as Bun or TS-Node.
```sh
$> boperate --ts-out ./debug
$> boperate -t ./debug -p ./tsconfig.custom.json
```

`boperators` will respect your `tsconfig.json` file for input and output directories, or you can specify a specific `tsconfig.json`:
```sh
$> boperate --ts-out --project ./tsconfig.custom.json
```

| Argument 	          | Aliases	| Description                                                   |
|-------------------- |--------	|---------------------------------------------------------------|
| --ts-out 	          | -t      | Output directory for TypeScript files.                        |
| --project	          | -p		| Path to `tsconfig` file to use.					            |
| --dry-run           | -d      | Preview only without writing files.                           |
| --error-on-warning  |         | Instead of showing a warning, error on conflicting overloads. |


## Supported Operators

| Symbol                  | Operator  | Static    |
|-------------------------|-----------|-----------|
| PLUS                    | `+`       | yes       |
| PLUS_EQUALS             | `+=`      | no        |
| MINUS                   | `-`       | yes       |
| MINUS_EQUALS            | `-=`      | no        |
| MULTIPLY                | `*`       | yes       |
| MULTIPLY_EQUALS         | `*=`      | no        |
| DIVIDE                  | `/`       | yes       |
| DIVIDE_EQUALS           | `/=`      | no        |
| MODULO                  | `%`       | yes       |
| MODULO_EQUALS           | `%=`      | no        |
| GREATER_THAN            | `>`       | yes       |
| GREATER_THAN_EQUAL_TO   | `>=`      | yes       |
| LESS_THAN               | `<`       | yes       |
| LESS_THAN_EQUAL_TO      | `<=`      | yes       |
| EQUALS                  | `==`      | yes       |
| STRICT_EQUALS           | `===`     | yes       |
| NOT_EQUALS              | `!=`      | yes       |
| STRICT_NOT_EQUALS       | `!==`     | yes       |
| AND                     | `&&`      | yes       |
| AND_EQUALS              | `&&=`     | no        |
| OR                      | `\|\|`    | yes       |
| OR_EQUALS               | `\|\|=`   | no        |
| NULLISH                 | `??`      | yes       |

## Creating Libraries with Overloads
Currently, doing this is completely untested. I think it'll work, but that's because currently we check every single dependency, including whatever's in `node_modules` (I think? Who knows.)

When creating a library that uses `boperators` and offers use of these overloads to your library's users, you'll need to add `boperators` as a **peer dependency**, not as a regular dependency, otherwise there's a risk of having two separate versions of `boperators` in the project and the operator Symbols won't be the same.

## API
ToDo

## Planned Features; To-Do; Known Issues
- TypeScript Language Server plugin to sort intellisense!
- API
- Inheritance
- Ensure libraries work as expected
- Log function names, if named functions.
- Write tests, sort CI
- Check how type unions work in the overloading
- Address inheritence when checking overload typings
- Inline functions. Could allow `@inline` in the comments of a function? If `ts-morph` can read it.
- Use `.apply` to ensure instance functions are correctly bound?
- Option to use object instead of array of functions for even more verbose code output?

### Conflicts
When first parsing your operator overloads, if there are any overloads with matching types for the left- and right-hand side respectively then a warning will be shows.
If the operator overload is then needed anywhere, then no JavaScript can be generated. TypeScript will still be generated, which is helpful for debugging, but this also cannot be run.
