/** Messari Lending/CDP schema 3.1.0. Position.side is COLLATERAL | BORROWER (not LENDER). */

export const PROTOCOL_QUERY = /* GraphQL */ `
  query HopProtocol {
    _meta {
      deployment
      hasIndexingErrors
      block {
        number
        timestamp
      }
    }
    lendingProtocols {
      slug
      schemaVersion
      subgraphVersion
      methodologyVersion
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalDepositBalanceUSD
    }
  }
`;

export const MARKETS_QUERY = /* GraphQL */ `
  query HopMarkets($skip: Int!) {
    markets(first: 200, skip: $skip) {
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
      rates {
        side
        type
        rate
      }
    }
  }
`;

/** @deprecated use PROTOCOL_QUERY + MARKETS_QUERY */
export const SNAPSHOT_QUERY = PROTOCOL_QUERY;

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
      first: 200
      skip: $skip
      where: { timestamp_gte: $from, timestamp_lte: $to }
    ) {
      id
      amountUSD
      timestamp
    }
  }
`;
