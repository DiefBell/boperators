import ts from "typescript";
import type { PropertyDeclaration } from "typescript";


export const isStaticPropertyDeclaration = (node: ts.Node): node is PropertyDeclaration =>
{
    if(!ts.isPropertyDeclaration(node)) {
        return false;
    }

    const modifiers = ts.getCombinedModifierFlags(node);
    if(!modifiers)
    {
        return false;
    }

    return (modifiers & ts.ModifierFlags.Static) !== 0;
}