/**
 * Comprehensive operator overload E2E tests.
 *
 * Output uses GitHub Actions workflow commands so failures surface as
 * annotations in the Actions UI:
 *   ::group::<name> / ::endgroup::   → collapsible log sections
 *   ::error::<message>               → per-failure annotation (fails the step)
 *
 * Exit code 1 if any assertion fails.
 */

import { ColoredVec2 } from "./ColoredVec2";
import { Mat4 } from "./Mat4";
import { Vec2 } from "./Vec2";
import { Vec3 } from "./Vec3";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string, info?: string): void {
	if (condition) {
		console.log(`  ok  ${description}`);
		passed++;
	} else {
		const detail = info ? ` — ${info}` : "";
		console.log(`::error::FAIL: ${description}${detail}`);
		console.log(`  FAIL ${description}${detail}`);
		failed++;
	}
}

function assertEq<T>(actual: T, expected: T, description: string): void {
	const a = String(actual);
	const e = String(expected);
	assert(a === e, description, `expected "${e}", got "${a}"`);
}

// ─── Vec2 ─────────────────────────────────────────────────────────────────────

const v1 = new Vec2(1, 2);
const v2 = new Vec2(3, 4);
const v3 = new Vec2(5, 6);
const v0 = new Vec2(0, 0);

console.log("::group::Vec2 binary arithmetic");
assertEq(String(v1 + v2), "Vec2(4, 6)", "Vec2: +");
assertEq(String(v2 - v1), "Vec2(2, 2)", "Vec2: -");
assertEq(String(v1 * 3), "Vec2(3, 6)", "Vec2: * scalar");
assertEq(String(v2 / 2), "Vec2(1.5, 2)", "Vec2: / scalar");
assertEq(String(v2 % 3), "Vec2(0, 1)", "Vec2: % scalar"); // 3%3=0, 4%3=1
assertEq(String(v1 ** 3), "Vec2(1, 8)", "Vec2: ** scalar"); // 1³=1, 2³=8
console.log("::endgroup::");

console.log("::group::Vec2 comparison");
assertEq(v1 == new Vec2(1, 2), true, "Vec2: == equal value");
assertEq(v1 == v2, false, "Vec2: == different value");
assertEq(v1 === new Vec2(1, 2), true, "Vec2: === equal value");
assertEq(v1 === v2, false, "Vec2: === different value");
assertEq(v1 != v2, true, "Vec2: != different");
assertEq(v1 != new Vec2(1, 2), false, "Vec2: != equal");
assertEq(v1 !== v2, true, "Vec2: !== different");
assertEq(v1 !== new Vec2(1, 2), false, "Vec2: !== equal");
assertEq(v1 < v2, true, "Vec2: < (|v1|²=5 < |v2|²=25)");
assertEq(v2 < v1, false, "Vec2: < reversed");
// Vec2(1,2) and Vec2(2,1) both have |v|²=5 — tests the "or equal" boundary
assertEq(
	v1 <= new Vec2(2, 1),
	true,
	"Vec2: <= equal magnitude (different components)",
);
assertEq(v2 <= v1, false, "Vec2: <= false case (|v2|²=25 > |v1|²=5)");
assertEq(v2 > v1, true, "Vec2: >");
assertEq(v1 > v2, false, "Vec2: > reversed");
assertEq(
	v1 >= new Vec2(2, 1),
	true,
	"Vec2: >= equal magnitude (different components)",
);
assertEq(v1 >= v2, false, "Vec2: >= false case");
console.log("::endgroup::");

console.log("::group::Vec2 prefix unary");
assertEq(String(-v1), "Vec2(-1, -2)", "Vec2: unary -");
assertEq(String(+v1), "Vec2(1, 2)", "Vec2: unary + (copy)");
assertEq(!v0, true, "Vec2: ! zero vector");
assertEq(!v1, false, "Vec2: ! non-zero vector");
// ~ gives left-hand perpendicular: (x,y) → (-y,x)
assertEq(String(~v1), "Vec2(-2, 1)", "Vec2: ~ perpendicular");
assertEq(String(~v2), "Vec2(-4, 3)", "Vec2: ~ perpendicular (3,4)");
console.log("::endgroup::");

console.log("::group::Vec2 compound assignment");
let ca = new Vec2(10, 20);
ca += new Vec2(5, 10);
assertEq(String(ca), "Vec2(15, 30)", "Vec2: +=");
ca -= new Vec2(5, 10);
assertEq(String(ca), "Vec2(10, 20)", "Vec2: -=");
ca *= 3;
assertEq(String(ca), "Vec2(30, 60)", "Vec2: *=");
ca /= 6;
assertEq(String(ca), "Vec2(5, 10)", "Vec2: /=");
ca %= 3;
assertEq(String(ca), "Vec2(2, 1)", "Vec2: %="); // 5%3=2, 10%3=1
let cb = new Vec2(2, 3);
cb **= 2;
assertEq(String(cb), "Vec2(4, 9)", "Vec2: **="); // 2²=4, 3²=9
console.log("::endgroup::");

console.log("::group::Vec2 postfix unary");
let cc = new Vec2(5, 5);
cc++;
assertEq(String(cc), "Vec2(6, 6)", "Vec2: ++");
cc--;
assertEq(String(cc), "Vec2(5, 5)", "Vec2: --");
console.log("::endgroup::");

console.log("::group::Vec2 chaining and order of operations");
// Left-associative chaining
assertEq(String(v1 + v2 + v3), "Vec2(9, 12)", "Vec2: a+b+c (left-assoc)");
assertEq(String(v3 - v2 - v1), "Vec2(1, 0)", "Vec2: a-b-c (left-assoc)");
// Brackets vs natural precedence: * binds tighter than +
assertEq(String(v1 + v2 * 3), "Vec2(10, 14)", "Vec2: a+b*3 (* before +)");
assertEq(String((v1 + v2) * 3), "Vec2(12, 18)", "Vec2: (a+b)*3 (brackets)");
assertEq(String(v1 * 2 + v2 * 3), "Vec2(11, 16)", "Vec2: a*2+b*3");
// Unary chaining
assertEq(String(-(-v1)), "Vec2(1, 2)", "Vec2: -(-a) = a");
assertEq(String(-(v1 + v2)), "Vec2(-4, -6)", "Vec2: -(a+b)");
// ~ applied twice rotates 180°: ~~v = -v
assertEq(String(~~v1), "Vec2(-1, -2)", "Vec2: ~~a = -a");
// Mixed: negate then add
assertEq(String(-v1 + v2), "Vec2(2, 2)", "Vec2: -a+b");
// Division then add
assertEq(String(v2 / 2 + v1), "Vec2(2.5, 4)", "Vec2: a/2+b");
console.log("::endgroup::");

// ─── Vec3 ─────────────────────────────────────────────────────────────────────

// Standard basis vectors — perfect for cross product verification
const ex = new Vec3(1, 0, 0);
const ey = new Vec3(0, 1, 0);
const ez = new Vec3(0, 0, 1);
const w1 = new Vec3(2, 3, 4);
const w2 = new Vec3(5, 6, 7);

console.log("::group::Vec3 binary arithmetic");
assertEq(String(w1 + w2), "Vec3(7, 9, 11)", "Vec3: +");
assertEq(String(w2 - w1), "Vec3(3, 3, 3)", "Vec3: -");
assertEq(String(w1 * 2), "Vec3(4, 6, 8)", "Vec3: * scalar");
console.log("::endgroup::");

console.log("::group::Vec3 cross product (%)");
// Right-hand rule: x×y=z, y×z=x, z×x=y
assertEq(String(ex % ey), "Vec3(0, 0, 1)", "Vec3: x×y = z");
assertEq(String(ey % ez), "Vec3(1, 0, 0)", "Vec3: y×z = x");
assertEq(String(ez % ex), "Vec3(0, 1, 0)", "Vec3: z×x = y");
// Anti-commutativity: a×b = -(b×a)
assertEq(
	String(ey % ex),
	"Vec3(0, 0, -1)",
	"Vec3: y×x = -z (anti-commutative)",
);
// Cross product of parallel vectors is zero
assertEq(String(ex % ex), "Vec3(0, 0, 0)", "Vec3: a×a = 0");
// General case
assertEq(String(w1 % w2), "Vec3(-3, 6, -3)", "Vec3: general cross product");
console.log("::endgroup::");

console.log("::group::Vec3 comparison");
assertEq(w1 == new Vec3(2, 3, 4), true, "Vec3: == equal");
assertEq(w1 == w2, false, "Vec3: == different");
assertEq(w1 != w2, true, "Vec3: != different");
assertEq(w1 != new Vec3(2, 3, 4), false, "Vec3: != equal");
console.log("::endgroup::");

console.log("::group::Vec3 prefix unary");
assertEq(String(-w1), "Vec3(-2, -3, -4)", "Vec3: unary -");
assertEq(String(-(ex + ey)), "Vec3(-1, -1, 0)", "Vec3: -(a+b)");
console.log("::endgroup::");

console.log("::group::Vec3 compound assignment");
let cd = new Vec3(1, 2, 3);
cd += w1;
assertEq(String(cd), "Vec3(3, 5, 7)", "Vec3: +=");
cd -= w1;
assertEq(String(cd), "Vec3(1, 2, 3)", "Vec3: -=");
cd *= 3;
assertEq(String(cd), "Vec3(3, 6, 9)", "Vec3: *=");
console.log("::endgroup::");

console.log("::group::Vec3 postfix unary");
let ce = new Vec3(0, 0, 0);
ce++;
assertEq(String(ce), "Vec3(1, 1, 1)", "Vec3: ++");
console.log("::endgroup::");

console.log("::group::Vec3 chaining");
assertEq(String(ex + ey + ez), "Vec3(1, 1, 1)", "Vec3: a+b+c (left-assoc)");
assertEq(String(w1 + w2 - w1), "Vec3(5, 6, 7)", "Vec3: a+b-a = b");
// Cross product chaining (left-assoc): (ex×ey)×ey = ez×ey = Vec3(-1,0,0)
assertEq(
	String((ex % ey) % ey),
	"Vec3(-1, 0, 0)",
	"Vec3: (x×y)×y (left-assoc chain)",
);
console.log("::endgroup::");

// ─── Mat4 ─────────────────────────────────────────────────────────────────────

const I = Mat4.identity();
const T1 = Mat4.translation(1, 2, 3);
const T2 = Mat4.translation(4, 5, 6);
const origin = new Vec3(0, 0, 0);
const point = new Vec3(1, 2, 3);

console.log("::group::Mat4 * Mat4 (matrix multiply)");
// Identity × Identity = Identity
assertEq(I * I == I, true, "Mat4: I×I == I");
// Identity × T = T
assertEq(I * T1 == T1, true, "Mat4: I×T = T");
assertEq(T1 * I == T1, true, "Mat4: T×I = T");
// Composition of translations: T(1,2,3) × T(4,5,6) = T(5,7,9)
const T12 = T1 * T2;
assertEq(
	String(T12 * origin),
	"Vec3(5, 7, 9)",
	"Mat4: T(1,2,3)×T(4,5,6) applied to origin = (5,7,9)",
);
// Non-equal matrices
assertEq(T1 != T2, true, "Mat4: != different matrices");
console.log("::endgroup::");

console.log("::group::Mat4 * Vec3 (point transform)");
// Identity leaves point unchanged
assertEq(String(I * origin), "Vec3(0, 0, 0)", "Mat4: I×origin");
assertEq(String(I * point), "Vec3(1, 2, 3)", "Mat4: I×point unchanged");
// Pure translation
assertEq(
	String(Mat4.translation(10, 20, 30) * point),
	"Vec3(11, 22, 33)",
	"Mat4: translation(10,20,30) * (1,2,3)",
);
assertEq(
	String(T1 * origin),
	"Vec3(1, 2, 3)",
	"Mat4: T(1,2,3) applied to origin",
);
console.log("::endgroup::");

console.log("::group::Mat4 chaining and order of operations");
// Chaining: T1 * T2 * point  (left-associative: (T1*T2)*point)
// T1*T2 = T(5,7,9), applied to point(1,2,3) = (6,9,12)
assertEq(
	String(T1 * T2 * point),
	"Vec3(6, 9, 12)",
	"Mat4: T1*T2*point (left-assoc, Mat4×Mat4 then Mat4×Vec3)",
);
// Verify associativity: (T1*T2)*p == T1*(T2*p)
const lhs = String(T1 * T2 * point);
const rhs = String(T1 * (T2 * point));
assertEq(lhs, rhs, "Mat4: (T1*T2)*p == T1*(T2*p) (associativity)");
// The key chain: Mat4*Mat4 dispatches to overload [0], Mat4*Vec3 dispatches to overload [1]
// T1 * T2 → Mat4 (uses overload [0])
// Mat4 * point → Vec3 (uses overload [1])
assertEq(
	String(T1 * T2 * point),
	"Vec3(6, 9, 12)",
	"Mat4: explicit brackets (T1*T2)*point",
);
console.log("::endgroup::");

// ─── Inheritance ──────────────────────────────────────────────────────────────
//
// ColoredVec2 extends Vec2 and overrides only `+`.
// The OverloadStore walks the type chain [ColoredVec2 → Vec2] for every
// other operator, so they all fall back to Vec2's definitions.

const cv1 = new ColoredVec2(1, 2, "red");
const cv2 = new ColoredVec2(3, 4, "blue");
const cv3 = new ColoredVec2(5, 6, "green");

console.log("::group::Inheritance — overridden operator (+)");
// Exact subclass match → uses ColoredVec2's own overload
assertEq(
	String(cv1 + cv2),
	"ColoredVec2(4, 6, red+blue)",
	"Inheritance: + uses subclass overload",
);
// Chains still resolve via the subclass overload at every step
assertEq(
	String(cv1 + cv2 + cv3),
	"ColoredVec2(9, 12, red+blue+green)",
	"Inheritance: + chain uses subclass overload at each step",
);
console.log("::endgroup::");

console.log("::group::Inheritance — fallback to Vec2 overloads");
// - not overridden → type chain falls through to Vec2["-"][0], returns Vec2
assertEq(String(cv2 - cv1), "Vec2(2, 2)", "Inheritance: - falls back to Vec2");
// unary - not overridden
assertEq(
	String(-cv1),
	"Vec2(-1, -2)",
	"Inheritance: unary - falls back to Vec2",
);
// scalar * not overridden
assertEq(
	String(cv1 * 3),
	"Vec2(3, 6)",
	"Inheritance: * scalar falls back to Vec2",
);
// == not overridden — compares x,y only, color is irrelevant
assertEq(
	cv1 == new ColoredVec2(1, 2, "purple"),
	true,
	"Inheritance: == falls back to Vec2 (color ignored)",
);
assertEq(
	cv1 == cv2,
	false,
	"Inheritance: == falls back to Vec2 (different components)",
);
console.log("::endgroup::");

console.log("::group::Inheritance — mixed type (ColoredVec2 op Vec2)");
// LHS chain: [ColoredVec2, Vec2], RHS chain: [Vec2]
// ColoredVec2's + requires both sides to be ColoredVec2, so it is skipped.
// Falls through to Vec2["+"][0](cv1, v1), returning a plain Vec2.
assertEq(
	String(cv1 + v1),
	"Vec2(2, 4)",
	"Inheritance: ColoredVec2 + Vec2 falls back to Vec2's +",
);
console.log("::endgroup::");

console.log("::group::Inheritance — inherited postfix and compound assignment");
// ++ is inherited: boperators calls cv4["++"][0].call(cv4), which is Vec2's
// function and mutates .x and .y in place. cv4 is still a ColoredVec2 instance
// so toString() still includes the color.
let cv4 = new ColoredVec2(5, 5, "purple");
cv4++;
assertEq(
	String(cv4),
	"ColoredVec2(6, 6, purple)",
	"Inheritance: ++ inherited (mutates subclass in place)",
);
// += falls back to Vec2's += (Vec2 takes Vec2 RHS; ColoredVec2 extends Vec2 so
// the RHS type chain [ColoredVec2, Vec2] eventually matches Vec2+Vec2).
// Vec2's += only touches .x and .y, so .color is unchanged.
cv4 += new ColoredVec2(1, 1, "ignored");
assertEq(
	String(cv4),
	"ColoredVec2(7, 7, purple)",
	"Inheritance: += falls back to Vec2 (color unchanged)",
);
console.log("::endgroup::");

// ─── Summary ──────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
	process.exit(1);
}
