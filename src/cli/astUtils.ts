import ts from "typescript";
import type { MethodDeclaration } from "typescript";


export const isStaticMethodDeclaration = (node: ts.Node): node is MethodDeclaration =>
{
    if(!ts.isMethodDeclaration(node)) {
        return false;
    }

    const modifiers = ts.getCombinedModifierFlags(node);
    if(!modifiers)
    {
        return false;
    }

    return (modifiers & ts.ModifierFlags.Static) !== 0;
}