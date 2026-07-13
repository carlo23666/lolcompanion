/**
 * WinCon's original route-signal mark. Four candidate lines meet at one
 * decision node and one selected line leaves the node. Geometry stays simple
 * enough for the tray/app icon and deliberately avoids Riot-owned shapes.
 */
export default function BrandMark(props: {
  className?: string
  title?: string
}): React.JSX.Element {
  const title = props.title ?? 'WinCon'
  return (
    <svg
      className={props.className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="brand-route-gold" d="M4 9h13l13 16" />
      <path className="brand-route-signal" d="M4 55h13l13-16" />
      <path className="brand-route-muted" d="m36 24 11-13h13" />
      <path className="brand-route-muted" d="m36 40 11 13h13" />
      <path className="brand-route-gold" d="M36 32h19" />
      <path className="brand-arrow" d="m54 25 9 7-9 7Z" />
      <circle className="brand-node" cx="32" cy="32" r="6" />
      <circle className="brand-node-core" cx="32" cy="32" r="2" />
    </svg>
  )
}
