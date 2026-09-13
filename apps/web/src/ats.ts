import "reflect-metadata";
import {
  ActivateInternalKycRequest,
  ApplyRolesRequest,
  Bond,
  ConnectRequest,
  ControlListRequest,
  Coupon,
  CreateBondRequest,
  FullRedeemAtMaturityRequest,
  GrantKycRequest,
  InitializationRequest,
  IssueRequest,
  Kyc,
  Management,
  Network,
  PauseRequest,
  ResolveLatestConfigVersionRequest,
  Role,
  Security,
  SetCouponRequest,
  SupportedWallets,
  TransferAndLockRequest,
} from "@hashgraph/asset-tokenization-sdk";
import { ATS_TESTNET, type AssetIntent, type AssetTransaction, type AtsStage } from "@hop/shared";

export type AtsRuntimeConfig = {
  configured: boolean;
  network: "hedera:testnet";
  chain_id: 296;
  factory_address: string | null;
  resolver_address: string | null;
  rpc_url: string;
  mirror_node_url: string;
  explorer_url: string;
  sdk_version: string | null;
  bond_config_id: string | null;
  bond_config_version: number;
};

export type AtsExecution = {
  walletAccount: string;
  assetContract: string;
  configVersion: number;
  transactions: Omit<AssetTransaction, "verified">[];
};

export type AtsFollowOn = {
  recipient?: string;
  issueAmount?: string;
  vcBase64?: string;
  freezeAmount?: string;
};

const ROLES = {
  issuer: "0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f",
  controlList: "0x6ed9a91e996c6475ecdc28ecbdbe9bd1122fc62b30cdbe6da8271884b51ec74d",
  locker: "0xd327cd9a2be405896f3d4584b3b437d798833cc4aa0aafb34c870659c0d47184",
  corporateActions: "0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd",
  pauser: "0x3cb8b459fdb6e7dc3d2a2aa529e530f885d45e03584adb438423209c86a2731f",
  kyc: "0x754f499f9fdfbb089d12bdec817a6863d593d8a3ea7f546c00a5cafd20957bfc",
  freeze: "0x71ae38482e1ab1c28e767d64766d686215b490c8c1bd7dfe6b101525187c2155",
  maturityRedeemer: "0x433f48f8aca23480f6ab07666cbc9131d32a0b4672033453f65e18f4dd390523",
} as const;

function mirrorNode(url: string) {
  return {
    name: "hedera-testnet",
    baseUrl: `${url.replace(/\/$/, "")}/api/v1/`,
    apiKey: "",
    headerName: "",
  };
}

function rpcNode(url: string) {
  return {
    name: "hedera-testnet-json-rpc",
    baseUrl: url,
    apiKey: "",
    headerName: "",
  };
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) {
    return String((value as { toString(): string }).toString());
  }
  return "";
}

function transactionId(response: unknown, stage: AtsStage): string {
  const row = response as { transactionId?: unknown };
  const id = stringValue(row?.transactionId);
  if (!id) throw new Error(`ats_${stage}_transaction_missing`);
  return id;
}

function currencyHex(currency: string): string {
  return `0x${[...currency]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")}`;
}

function walletAddress(initialization: unknown): string {
  const account = (initialization as {
    account?: {
      evmAddress?: unknown;
      id?: unknown;
      accountId?: unknown;
    };
  }).account;
  const address =
    stringValue(account?.evmAddress) ||
    stringValue(account?.id) ||
    stringValue(account?.accountId);
  if (!address) throw new Error("ats_wallet_account_missing");
  return address;
}

function securityIds(created: unknown): { securityId: string; assetContract: string } {
  const security = (created as {
    security?: { evmDiamondAddress?: unknown; diamondAddress?: unknown };
  }).security;
  const securityId =
    stringValue(security?.evmDiamondAddress) ||
    stringValue(security?.diamondAddress);
  const assetContract =
    stringValue(security?.diamondAddress) ||
    stringValue(security?.evmDiamondAddress);
  if (!securityId || !assetContract) throw new Error("ats_asset_contract_missing");
  return { securityId, assetContract };
}

async function initialize(config: AtsRuntimeConfig): Promise<string> {
  const factory = config.factory_address || ATS_TESTNET.factory;
  const resolver = config.resolver_address || ATS_TESTNET.resolver;
  if (!config.configured || !factory || !resolver) throw new Error("ats_unconfigured");
  const mirror = mirrorNode(config.mirror_node_url);
  const rpc = rpcNode(config.rpc_url);
  await Network.init(
    new InitializationRequest({
      network: "testnet",
      mirrorNode: mirror,
      rpcNode: rpc,
      events: {},
      configuration: {
        factoryAddress: factory,
        resolverAddress: resolver,
      },
      mirrorNodes: { nodes: [{ mirrorNode: mirror, environment: "testnet" }] },
      jsonRpcRelays: { nodes: [{ jsonRpcRelay: rpc, environment: "testnet" }] },
      factories: {
        factories: [{ factory, environment: "testnet" }],
      },
      resolvers: {
        resolvers: [{ resolver, environment: "testnet" }],
      },
    }),
  );
  const connected = await Network.connect(
    new ConnectRequest({
      network: "testnet",
      mirrorNode: mirror,
      rpcNode: rpc,
      wallet: SupportedWallets.METAMASK,
    }),
  );
  return walletAddress(connected);
}

async function latestBondConfigVersion(config: AtsRuntimeConfig): Promise<number> {
  const resolver = config.resolver_address || ATS_TESTNET.resolver;
  const configurationId = config.bond_config_id || ATS_TESTNET.bondConfigId;
  const resolved = await Management.resolveLatestConfigVersion(
    new ResolveLatestConfigVersionRequest({
      resolverAddress: resolver,
      configurationId,
    }),
  );
  const version = Number((resolved as { payload?: unknown }).payload);
  if (!Number.isInteger(version) || version < 1) throw new Error("ats_config_version_unresolved");
  return version;
}

function tx(
  stage: AtsStage,
  response: unknown,
): Omit<AssetTransaction, "verified"> {
  return { stage, transaction_id: transactionId(response, stage) };
}

function couponRequest(intent: AssetIntent, securityId: string) {
  const start = Math.floor(Date.parse(intent.terms.starting_date) / 1000);
  if (!Number.isFinite(start)) throw new Error("ats_coupon_start_invalid");
  const recordTimestamp = start + 86_400;
  return new SetCouponRequest({
    securityId,
    rate: String(intent.terms.coupon_rate_bps / 100),
    recordTimestamp: String(recordTimestamp),
    executionTimestamp: String(recordTimestamp + 86_400),
    startTimestamp: "0",
    endTimestamp: "86400",
    fixingTimestamp: String(start),
    rateStatus: 1,
  });
}

export async function executeAtsLifecycle(
  config: AtsRuntimeConfig,
  intent: AssetIntent,
  extras: AtsFollowOn,
): Promise<AtsExecution> {
  const walletAccount = await initialize(config);
  const configVersion = await latestBondConfigVersion(config);

  if (intent.action === "issue_and_lock") {
    return issueAndLock(config, intent, extras, walletAccount, configVersion);
  }

  const securityId = intent.asset_contract;
  if (!securityId) throw new Error("ats_asset_contract_required");
  const transactions: Omit<AssetTransaction, "verified">[] = [];

  if (intent.action === "coupon") {
    if (intent.terms.coupon_rate_bps <= 0) throw new Error("ats_coupon_rate_required");
    transactions.push(tx("coupon", await Coupon.setCoupon(couponRequest(intent, securityId))));
  } else if (intent.action === "redeem") {
    transactions.push(tx("redeem", await Bond.fullRedeemAtMaturity(
      new FullRedeemAtMaturityRequest({
        securityId,
        sourceId: extras.recipient || walletAccount,
      }),
    )));
  } else if (intent.action === "pause") {
    transactions.push(tx("pause", await Security.pause(new PauseRequest({ securityId }))));
  } else if (intent.action === "unpause") {
    transactions.push(tx("unpause", await Security.unpause(new PauseRequest({ securityId }))));
  } else {
    throw new Error("ats_action_not_supported");
  }

  return {
    walletAccount,
    assetContract: securityId,
    configVersion,
    transactions,
  };
}

async function issueAndLock(
  config: AtsRuntimeConfig,
  intent: AssetIntent,
  extras: AtsFollowOn,
  walletAccount: string,
  configVersion: number,
): Promise<AtsExecution> {
  const recipient = (extras.recipient ?? "").trim();
  const issueAmount = (extras.issueAmount ?? "").trim();
  if (!/^(0\.0\.\d+|0x[a-fA-F0-9]{40})$/.test(recipient)) {
    throw new Error("ats_recipient_invalid");
  }
  if (!/^\d+$/.test(issueAmount) || BigInt(issueAmount) <= 0n) {
    throw new Error("ats_issue_amount_invalid");
  }
  if (BigInt(issueAmount) > BigInt(intent.terms.max_supply)) {
    throw new Error("ats_issue_amount_exceeds_supply");
  }

  const start = Math.floor(Date.parse(intent.terms.starting_date) / 1000).toString();
  const maturity = Math.floor(Date.parse(intent.terms.maturity_date) / 1000).toString();
  const created = await Bond.create(
    new CreateBondRequest({
      name: intent.terms.name,
      symbol: intent.terms.symbol,
      isin: intent.terms.instrument_id,
      decimals: intent.terms.decimals,
      isWhiteList: intent.controls.controllist === "allowlist",
      erc20VotesActivated: false,
      isControllable: true,
      arePartitionsProtected: false,
      clearingActive: intent.controls.clearing,
      internalKycActivated: intent.controls.kyc,
      isMultiPartition: false,
      diamondOwnerAccount: walletAccount,
      currency: currencyHex(intent.terms.currency),
      numberOfUnits: intent.terms.max_supply,
      nominalValue: intent.terms.nominal_value,
      nominalValueDecimals: intent.terms.nominal_value_decimals,
      startingDate: start,
      maturityDate: maturity,
      regulationType: 0,
      regulationSubType: 0,
      isCountryControlListWhiteList: true,
      countries: "",
      info: `hop-evidence:${intent.evidence_id}`,
      configId: config.bond_config_id || ATS_TESTNET.bondConfigId,
      configVersion,
    }),
  );
  const { securityId, assetContract } = securityIds(created);
  const transactions: Omit<AssetTransaction, "verified">[] = [tx("factory", created)];

  const roleIds = [
    ROLES.issuer,
    ROLES.controlList,
    ROLES.locker,
    ROLES.corporateActions,
    ROLES.pauser,
    ROLES.freeze,
    ROLES.maturityRedeemer,
    ...(intent.controls.kyc ? [ROLES.kyc] : []),
  ];
  const roles = await Role.applyRoles(
    new ApplyRolesRequest({
      securityId,
      targetId: walletAccount,
      roles: roleIds,
      actives: roleIds.map(() => true),
    }),
  );
  transactions.push(tx("roles", roles));

  const complianceTargets = new Set([walletAccount, recipient]);
  for (const targetId of complianceTargets) {
    const control = await Security.addToControlList(
      new ControlListRequest({ securityId, targetId }),
    );
    transactions.push(tx("compliance", control));
  }

  if (intent.controls.kyc) {
    const activated = await Kyc.activateInternalKyc(
      new ActivateInternalKycRequest({ securityId }),
    );
    transactions.push(tx("kyc", activated));
    const vc = (extras.vcBase64 ?? "").trim();
    if (!vc) throw new Error("ats_kyc_vc_required");
    for (const targetId of complianceTargets) {
      const grant = await Kyc.grantKyc(
        new GrantKycRequest({
          securityId,
          targetId,
          vcBase64: vc,
        }),
      );
      transactions.push(tx("kyc", grant));
    }
  }

  const issue = await Security.issue(
    new IssueRequest({
      securityId,
      targetId: walletAccount,
      amount: issueAmount,
    }),
  );
  transactions.push(tx("issue", issue));

  const lifecycle = await Security.transferAndLock(
    new TransferAndLockRequest({
      securityId,
      targetId: recipient,
      amount: issueAmount,
      expirationDate: maturity,
    }),
  );
  transactions.push(tx("lifecycle", lifecycle));

  if (intent.terms.coupon_rate_bps > 0) {
    transactions.push(tx("coupon", await Coupon.setCoupon(couponRequest(intent, securityId))));
  }

  return { walletAccount, assetContract, configVersion, transactions };
}
