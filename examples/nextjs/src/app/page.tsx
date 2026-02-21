import { Vec2 } from "../Vec2";

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;

export default function Home() {
	return (
		<main>
			<p>Vec2(1, 2) + Vec2(3, 4) = {c.toString()}</p>
		</main>
	);
}
