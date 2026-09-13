const SRC = {
  graph: "/brand/partners/the-graph.svg",
  chainlink: "/brand/partners/chainlink.svg",
  hedera: "/brand/partners/hedera.svg",
  hcs: "/brand/partners/hedera.svg",
} as const;

export function RailLogo({
  id,
  label,
}: {
  id: keyof typeof SRC;
  label: string;
}) {
  return <img className="launch-stack-logo" src={SRC[id]} alt={label} />;
}
