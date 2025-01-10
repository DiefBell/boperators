<center>

# boperators
### Operator Overloading for TypeScript

</center>

`boperators` is a package to allow you to "overload" operators (`+-/*`) in your TypeScript classes, similar to what a lot of other languages allow.
To define an operator overload, import an operator symbol, use it as the name for a property in your class, and define your overrides!

## Basic example

This uses an arrow function to overload adding two vectors together using `v1 + v2`, an anonymous function to overload adding a vector to the current one using `v3 += v4`, and a named function for multiplying by a number `v5 *= 10`. Note how the overload fields are arrays: you can define multiple overloads for different types, and `boperators` will then insert the correct one!

```typescript
import { PLUS, PLUS_EQUALS } from "boperators";

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
The CLI can be used to generate your JavaScript files 


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
| MODULE_EQUALS         | `%=`      | yes       |
| EQUALS                | `==`      | yes       |
| STRICT_EQUALS         | `===`     | yes       |
| NOT_EQUALS            | `!=`      | yes       |
| STRICT_NOT_EQUALS     | `!==`     | yes       |
| AND                   | `&&`      | yes       |
| AND_EQUALS            | `&&=`     | no        |
| OR                    | `\|\|`      | yes       |
| OR_EQUALS             | `\|\|=`     | no        |
| IN                    | `in`      | no        |
| INSTANCEOF            | `instanceof` | no     |

### InstanceOf
The `instanceof` overload is a special case. It's essentially just shorthand for a typeguard. Define it as any other typeguard function,
and `boperators` will work out which to use:
```typescript
readonly [INSTANCEOF] = [
    // Kinda contrived example
    function(this: Vector3): this is UnitVector {
        return this.magnitude === 1;
    }
];
```

## Creating Libraries with Overloads
Currently, doing this is completely untested. I think it'll work, but that's because currently we check every single dependency, including whatever's in `node_modules` (I think? Who knows.)

When creating a library that uses `boperators` and offers use of these overloads to your library's users, you'll need to add `boperators` as a **peer dependency**, not as a regular dependency.

## API
ToDo

## Planned Features; To-Do; Known Issues
- TypeScript Language Server plugin to sort intellisense!
- API
- Inheritance
- Ensure libraries work as expected
- Maybe make the overload field an object so overloads have names? For debugging?
- Write tests, sort CI
- Check how type unions work in the overloading
- Address inheritence when checking overload typings
- `instanceof` doesn't work yet




If you need to define an operator overload where the current class will be on the right-hand-side,
just put two parameters in your overload function with the type of the second being `this`.
```typescript
import * as bops from "boperators";

class Vector3 {
    [bops.DIVIDE]: {
        "Divide a scalar by this": function (lhs: number, rhs: this) {
            return new Vector3(lhs / rhs.x, lhs / rhs.y, lhs / rhs.z);
        }
    }
}
```

Once you've written your code, you can either compile it to a resolved TypeScript file (for debugging, or to directly run with `Bun`/`ts-node`),
or transpile it to JavaScript to run with NodeJS:
```sh
$> boperate src/**/*.ts --ts-out ./debug --js-out ./build --verbose
$> boperate src/**/*.ts -t ./debug -j ./debug -v
```

Boperators will also respect your `tsconfig.json` file for input and output directories if you specify a directory containing one:
```sh
$> boperate . --ts-out --js-out # tell it we want both TypeScript and JavaScript output, else it won't output any files and just does a dry run.
```


### Conflicts
When first parsing your operator overloads, if there are any overloads with matching types for the left- and right-hand side respectively then a warning will be shows.
If the operator overload is then needed anywhere, then no JavaScript can be generated. TypeScript will still be generated, which is helpful for debugging, but this also cannot be run.

If you have a conflict where both sides of your overload function have the same type, e.g. adding two `Vector3`s together then `this` will refer to the one on the left-hand side of the operator.
