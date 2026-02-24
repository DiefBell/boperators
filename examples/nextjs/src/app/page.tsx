import { Vec2 } from "../Vec2";

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
const d = a * b; // Vec2 * Vec2 — component-wise
const e = a * 2; // Vec2 * number — scalar

export default function Home() {
	return (
		<main>
			<p>Vec2(1, 2) + Vec2(3, 4) = {c.toString()}</p>
			<p>Vec2(1, 2) * Vec2(3, 4) = {d.toString()}</p>
			<p>Vec2(1, 2) * 2 = {e.toString()}</p>
		</main>
	);
}
