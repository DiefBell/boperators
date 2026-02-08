<center>

# boperators
### Operator Overloading for TypeScript

</center>

`boperators` is a package to allow you to "overload" operators, e.g. -, *, +=, etc, in your TypeScript classes, similar to what a lot of other languages allow.
To define an operator overload, use the operator string as a computed property name in your class and define your overrides!

## Basic example

This uses an anonymous function to overload adding two vectors together using `v1 + v2`, and a named function for adding a vector to the current one using `v3 += v4` and multiplying by a number `v5 *= 10`. Note how the overload fields are arrays: you can define multiple overloads for different types, and `boperators` will then insert the correct one!

Arrow functions are not allowed in overloads, as they cannot bind `this` correctly for instance operators.

```typescript
class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    // Use the operator string as a computed property name
    static readonly ["+"] = [
        function(lhs: Vector3, rhs: Vector3): Vector3 {
            return new Vector3(lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z);
        },
    ];

    // Assignment operators use instance fields
    readonly ["+="] = [
        function(this: Vector3, rhs: Vector3): void {
            this.x += rhs.x;
            this.y += rhs.y;
            this.z += rhs.z;
        }
    ];

    readonly ["*="] = [
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
preload = ["./node_modules/boperators/src/plugin/boperators.plugin.ts"]
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
| --dry-run           | -d      | Preview only without writing JavaScript files.                |
| --error-on-warning  |         | Instead of showing a warning, error on conflicting overloads. |


## Supported Operators

| Operator  | Static    |
|-----------|-----------|
| `+`       | yes       |
| `+=`      | no        |
| `-`       | yes       |
| `-=`      | no        |
| `*`       | yes       |
| `*=`      | no        |
| `/`       | yes       |
| `/=`      | no        |
| `%`       | yes       |
| `%=`      | no        |
| `>`       | yes       |
| `>=`      | yes       |
| `<`       | yes       |
| `<=`      | yes       |
| `==`      | yes       |
| `===`     | yes       |
| `!=`      | yes       |
| `!==`     | yes       |
| `&&`      | yes       |
| `&&=`     | no        |
| `\|\|`    | yes       |
| `\|\|=`   | no        |
| `??`      | yes       |

## API
ToDo

## Planned Features; To-Do; Known Issues
- [ ] TypeScript Language Server plugin to sort intellisense!
- [ ] API
- [ ] Inheritance over overload properties.
- Ensure libraries work as expected
- Log function names, if named functions.
- Write tests, sort CI
- Check how type unions work in the overloading
- Address inheritence when checking overload typings
- Inline functions. Could allow `@inline` in the comments of a function? If `ts-morph` can read it.
- Use `.apply` to ensure instance functions are correctly bound?
- Option to use object instead of array of functions for even more verbose code output?
- Can we make class overload fields just `+=` etc WITHOUT being strings? And hide the error in the language server?
- [x] We should separate out the server and the main package into separate folders. That way we can transpile the package to CommonJS AND ESM, but transpile the language server plugin to CJS only. Also means we don't need the janky `Object.assign`.
- Check up inheritence tree when searching for matching overloads.

### Conflicts
When first parsing your operator overloads, if there are any overloads with matching types for the left- and right-hand side respectively then a warning will be shows.
If the operator overload is then needed anywhere, then no JavaScript can be generated. TypeScript will still be generated, which is helpful for debugging, but this also cannot be run.
