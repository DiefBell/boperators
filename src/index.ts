import { init } from "./language-server-plugin";
import * as lib from "./lib"

export = Object.assign(init, lib) as typeof init & typeof lib;
