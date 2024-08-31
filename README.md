<center>

# boperators
### Operator Overloading for TypeScript

</center>

`boperators` is a package to allow you to "overload" operators (`+-/*`) in your TypeScript classes, similar to what a lot of other languages allow.
To define an operator overload, import an operator symbol, use it as the name for a property in your class, and define your overrides!

### Basic example

This uses an arrow function to overload adding another Vector3 to the current one:
```typescript
import { ADD } from "boperators";

class Vector3 {
    // Note the use of square brackets!
    [ADD]: {
        // name, helpful for deugging
        "Add another Vector3": (/* lhs: this */rhs: Vector3): Vector3 => new Vector3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z),
    }
    // rest of definition...
}
```

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
