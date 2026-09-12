import { metricHash, sanitizeAggregate } from "./egress.js";
import { compare, thresholdHash } from "./policy.js";
import {
  K_ANON,
  type HopJoinResult,
  type HopSnapshot,
  type PolicyCap,
  type PolicyTable,
  type ProtocolSnapshot,
  type QueryRequest,
} from "./types.js";

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function utilization(borrowUsd: number, depositUsd: number): number | null {
  if (depositUsd <= 0) return null;
  return borrowUsd / depositUsd;
}

function protocolUtilization(p: ProtocolSnapshot): number | null {
  return utilization(p.protocolBorrowUsd, p.protocolDepositUsd);
}

function ltvBucket(ltv: number): "<50%" | "50-75%" | ">75%" {
  if (ltv < 0.5) return "<50%";
  if (ltv <= 0.75) return "50-75%";
  return ">75%";
}

function maxLtvBucket(maxLtvPct: number): string {
  if (maxLtvPct < 50) return "<50";
  if (maxLtvPct < 75) return "50-75";
  if (maxLtvPct < 90) return "75-90";
  return ">=90";
}

function isLenderSide(side: string): boolean {
  const s = side.toUpperCase();
  return s === "COLLATERAL" || s === "LENDER";
}

function isBorrowerSide(side: string): boolean {
  return side.toUpperCase() === "BORROWER";
}

function tokenUsd(balance: string, priceUsd: string | null | undefined, decimals: unknown): number {
  const d = num(decimals);
  const raw = num(balance);
  const price = num(priceUsd);
  const denom = 10 ** d;
  if (denom <= 0) return 0;
  return (raw / denom) * price;
}

function observedForCap(cap: PolicyCap, snapshot: HopSnapshot): number | null {
  const protocols = cap.protocol
    ? snapshot.protocols.filter((p) => p.slug === cap.protocol || p.slug.startsWith(cap.protocol!))
    : snapshot.protocols;

  const utils = protocols
    .map(protocolUtilization)
    .filter((u): u is number => u !== null);
  const tvl = protocols.reduce((s, p) => s + p.protocolTvlUsd, 0);
  const liqCount = protocols.reduce((s, p) => s + p.liquidates.length, 0);
  const liqUsd = protocols.reduce(
    (s, p) => s + p.liquidates.reduce((n, ev) => n + num(ev.amountUSD), 0),
    0,
  );

  switch (cap.metric) {
    case "utilization": {
      if (utils.length === 0) return null;
      if ((cap.scope ?? "all") === "all") {
        if (utils.length < protocols.length) return null;
        return Math.min(...utils);
      }
      return Math.max(...utils);
    }
    case "combined_utilization": {
      const borrow = protocols.reduce((s, p) => s + p.protocolBorrowUsd, 0);
      const deposit = protocols.reduce((s, p) => s + p.protocolDepositUsd, 0);
      return utilization(borrow, deposit);
    }
    case "tvl_usd":
      return tvl;
    case "liquidations_count":
      return liqCount;
    case "liquidations_usd":
      return liqUsd;
  }
}

function marketParams(snapshot: HopSnapshot): Record<string, unknown> {
  return {
    protocols: snapshot.protocols.map((p) => {
      const util = protocolUtilization(p);
      const histogram: Record<string, number> = {};
      for (const m of p.markets) {
        const bucket = maxLtvBucket(num(m.maximumLTV));
        histogram[bucket] = (histogram[bucket] ?? 0) + 1;
      }
      return {
        slug: p.slug,
        schemaVersion: p.schemaVersion,
        block: p.block,
        market_count: p.markets.length,
        tvl_usd: p.protocolTvlUsd,
        borrow_usd: p.protocolBorrowUsd,
        deposit_usd: p.protocolDepositUsd,
        utilization: util,
        max_ltv_param_histogram: histogram,
      };
    }),
  };
}

function positionCounts(snapshot: HopSnapshot): Record<string, unknown> {
  return {
    protocols: snapshot.protocols.map((p) => {
      let lender = 0;
      let borrower = 0;
      for (const pos of p.positions) {
        if (isLenderSide(pos.side)) lender += 1;
        if (isBorrowerSide(pos.side)) borrower += 1;
      }
      return {
        slug: p.slug,
        schema_side_lender: "COLLATERAL",
        open_lender: lender,
        open_borrower: borrower,
      };
    }),
  };
}

function liquidations(snapshot: HopSnapshot): Record<string, unknown> {
  return {
    protocols: snapshot.protocols.map((p) => ({
      slug: p.slug,
      count: p.liquidates.length,
      usd: p.liquidates.reduce((s, ev) => s + num(ev.amountUSD), 0),
    })),
  };
}

function accountLtv(snapshot: HopSnapshot, k: number): {
  status: HopJoinResult["status"];
  aggregate?: Record<string, unknown>;
  k_anon: HopJoinResult["k_anon"];
} {
  const byAccount = new Map<string, { collateral: number; debt: number }>();

  for (const p of snapshot.protocols) {
    for (const pos of p.positions) {
      const accountId = pos.account?.id;
      if (!accountId) continue;
      const usd = tokenUsd(
        pos.balance,
        pos.market?.inputTokenPriceUSD,
        pos.market?.inputToken?.decimals,
      );
      const row = byAccount.get(accountId) ?? { collateral: 0, debt: 0 };
      if (isLenderSide(pos.side) && pos.isCollateral === true) {
        row.collateral += usd;
      }
      if (isBorrowerSide(pos.side)) {
        row.debt += usd;
      }
      byAccount.set(accountId, row);
    }
  }

  const bins: Record<"<50%" | "50-75%" | ">75%", number> = {
    "<50%": 0,
    "50-75%": 0,
    ">75%": 0,
  };

  for (const row of byAccount.values()) {
    if (row.collateral <= 0) continue;
    const ltv = row.debt / row.collateral;
    bins[ltvBucket(ltv)] += 1;
  }

  for (const count of Object.values(bins)) {
    if (count > 0 && count < k) {
      return {
        status: "k_anon_denied",
        k_anon: { result: "fail" },
      };
    }
  }

  return {
    status: "accept",
    aggregate: { bins, k, accounts_considered: "omitted" },
    k_anon: { result: "pass" },
  };
}

function policyCheck(
  snapshot: HopSnapshot,
  policy: PolicyTable,
): { breached: boolean; metric: string; observed: number } {
  for (const cap of policy.caps) {
    const observed = observedForCap(cap, snapshot);
    if (observed === null) continue;
    if (compare(cap.op, observed, cap.value)) {
      return { breached: true, metric: cap.metric, observed };
    }
  }
  const first = policy.caps[0];
  const observed = observedForCap(first, snapshot) ?? 0;
  return { breached: false, metric: first.metric, observed };
}

export function maxLag(snapshot: HopSnapshot): number {
  const head = snapshot.chainHead;
  if (!head) return 0;
  let lag = 0;
  for (const p of snapshot.protocols) {
    if (typeof p.block === "number") {
      lag = Math.max(lag, Math.abs(head - p.block));
    }
  }
  return lag;
}

export function joinAndAggregate(
  policy: PolicyTable,
  snapshot: HopSnapshot,
  request: QueryRequest,
): HopJoinResult {
  const graph = {
    deployments: snapshot.protocols.map((p) => ({
      id: p.deploymentId,
      slug: p.slug,
      schemaVersion: p.schemaVersion,
      subgraphVersion: p.subgraphVersion,
      block: p.block,
      blockTimestamp: p.blockTimestamp,
    })),
  };
  const policyMeta = {
    version: policy.version,
    threshold_hash: thresholdHash(policy),
  };

  const lag = maxLag(snapshot);
  if (lag > request.max_block_lag) {
    return {
      status: "stale",
      k_anon: { result: "not_applicable" },
      graph,
      policy: policyMeta,
    };
  }

  if (request.query === "account_ltv") {
    const ltv = accountLtv(snapshot, policy.k ?? K_ANON);
    return {
      status: ltv.status,
      aggregate: sanitizeAggregate(ltv.aggregate),
      k_anon: ltv.k_anon,
      graph,
      policy: policyMeta,
    };
  }

  let aggregate: Record<string, unknown>;
  switch (request.query) {
    case "market_params":
      aggregate = marketParams(snapshot);
      break;
    case "position_counts":
      aggregate = positionCounts(snapshot);
      break;
    case "liquidations":
      aggregate = liquidations(snapshot);
      break;
    case "policy_check": {
      const check = policyCheck(snapshot, policy);
      aggregate = {
        breached: check.breached,
        metric_hash: metricHash(check.metric),
        observed: check.observed,
        k_anon: "not_applicable",
        protocols: snapshot.protocols.map((p) => ({
          slug: p.slug,
          tvl_usd: p.protocolTvlUsd,
          utilization: protocolUtilization(p),
          liquidations: p.liquidates.length,
        })),
      };
      break;
    }
  }

  return {
    status: request.query === "policy_check" && aggregate.breached === true ? "reject" : "accept",
    aggregate: sanitizeAggregate(aggregate),
    k_anon: { result: "not_applicable" },
    graph,
    policy: policyMeta,
  };
}

export function dropAccountIds<T>(value: T): T {
  return value;
}
