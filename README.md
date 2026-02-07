<center>

# boperators
### Operator Overloading for TypeScript

</center>

`boperators` is a package to allow you to "overload" operators, e.g. -, *, +=, etc, in your TypeScript classes, similar to what a lot of other languages allow.
To define an operator overload, import an operator symbol, use it as the name for a property in your class, and define your overrides!

## Basic example

This uses an arrow function to overload adding two vectors together using `v1 + v2`, an anonymous function to overload adding a vector to the current one using `v3 += v4`, and a named function for multiplying by a number `v5 *= 10`. Note how the overload fields are arrays: you can define multiple overloads for different types, and `boperators` will then insert the correct one!

```typescript
import { PLUS, PLUS_EQUALS, MULTIPLY_EQUALS } from "boperators";

class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    // Note the use of square brackets!
    static readonly [PLUS] = [
        (lhs: Vector3, rhs: Vector3): Vector3 => new Vector3(lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z),
    ];

    // Assignment operators use instance fields
    readonly [PLUS_EQUALS] = [
        function(rhs: Vector3): void {
            this.x += rhs.x;
            this.y += rhs.y;
            this.z += rhs.z;
        }
    ];

    readonly [MULTIPLY_EQUALS] = [
        function multiplyByAScalar(scalar: number) {
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

The CLI can be used to either generate out JavaScript files, or TypeScript files for debugging, futher processing, or just running directly with a tool such as Bun or TS-Node.
```sh
$> boperate src/**/*.ts --ts-out ./debug --js-out ./build --verbose
$> boperate src/**/*.ts -t ./debug -j ./debug -v
```

`boperators` will respect your `tsconfig.json` file for input and output directories, or you can specify a specific `tsconfig.json`:
```sh
# tell it we want to output files, else it won't output any files and just does a dry run.
$> boperate --ts-out --js-out --project ./tsconfig.custom.json 
```

| Argument 	          | Aliases	| Description                                                   |
|-------------------- |--------	|---------------------------------------------------------------|
| --ts-out 	          | -t      | Output directory for TypeScript files.                        |
| --js-out 	          | -j      | Output directory for transpiled JavaScript files.	            |
| --project	          | -p		| Path to `tsconfig` file to use.					            |
| --verbose           | -v		| Verbose output (not yet implemented.)				            |
| --error-on-conflict | -e      | Instead of showing a warning, error on conflicting overloads. |


## Supported Operators

| Symbol                | Operator  | Static    |
|-----------------------|-----------|-----------|
| PLUS                  | `+`       | yes       |
| PLUS_EQUALS           | `+=`      | no        |
| MINUS                 | `-`       | yes       |
| MINUS_EQUALS          | `-=`      | no        |
| MULTIPLY              | `*`       | yes       |
| MULTIPLY_EQUALS       | `*=`      | no        |
| DIVIDE                | `/`       | yes       |
| DIVIDE_EQUALS         | `/=`      | no        |
| GREATER_THAN          | `>`       | yes       |
| GREATER_THAN_EQUALS   | `>=`      | yes       |
| LESS_THAN             | `<`       | yes       |
| LESS_THAN_EQUALS      | `<=`      | yes       |
| MODULO                | `%`       | yes       |
| MODULO_EQUALS         | `%=`      | yes       |
| EQUALS                | `==`      | yes       |
| STRICT_EQUALS         | `===`     | yes       |
| NOT_EQUALS            | `!=`      | yes       |
| STRICT_NOT_EQUALS     | `!==`     | yes       |
| AND                   | `&&`      | yes       |
| AND_EQUALS            | `&&=`     | no        |
| OR                    | `\|\|`    | yes       |
| OR_EQUALS             | `\|\|=`   | no        |
```

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
- Inline function.
- Use `.apply` to ensure instance functions are correctly bound?

### Conflicts
When first parsing your operator overloads, if there are any overloads with matching types for the left- and right-hand side respectively then a warning will be shows.
If the operator overload is then needed anywhere, then no JavaScript can be generated. TypeScript will still be generated, which is helpful for debugging, but this also cannot be run.
