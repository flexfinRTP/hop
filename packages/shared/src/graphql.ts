/** Messari Lending/CDP schema 3.1.0. Position.side is COLLATERAL | BORROWER (not LENDER). */

export const SNAPSHOT_QUERY = /* GraphQL */ `
  query HopSnapshot {
    _meta {
      block {
        number
        timestamp
      }
      hasIndexingErrors
    }
    lendingProtocols {
      id
      name
      slug
      schemaVersion
      subgraphVersion
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalDepositBalanceUSD
    }
    markets(first: 1000) {
      id
      name
      maximumLTV
      liquidationThreshold
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalDepositBalanceUSD
      inputToken {
        decimals
      }
      inputTokenPriceUSD
    }
  }
`;

export const POSITIONS_QUERY = /* GraphQL */ `
  query HopPositions($skip: Int!) {
    positions(
      first: 1000
      skip: $skip
      where: { or: [{ timestampClosed: null }, { timestampClosed: "0" }] }
    ) {
      id
      side
      isCollateral
      balance
      account {
        id
      }
      market {
        id
        inputToken {
          decimals
        }
        inputTokenPriceUSD
      }
    }
  }
`;

export const POSITIONS_QUERY_CLOSED_ZERO = /* GraphQL */ `
  query HopPositionsZero($skip: Int!) {
    positions(first: 1000, skip: $skip, where: { timestampClosed: "0" }) {
      id
      side
      isCollateral
      balance
      account {
        id
      }
      market {
        id
        inputToken {
          decimals
        }
        inputTokenPriceUSD
      }
    }
  }
`;

export const LIQUIDATES_QUERY = /* GraphQL */ `
  query HopLiquidates($from: BigInt!, $to: BigInt!, $skip: Int!) {
    liquidates(
      first: 1000
      skip: $skip
      where: { timestamp_gte: $from, timestamp_lte: $to }
    ) {
      id
      amountUSD
      timestamp
    }
  }
`;
