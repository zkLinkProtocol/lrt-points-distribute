import { parse } from 'path';

export type NetworkKey = string;
export default async () => {
  const {
    PORT,
    BLOCKCHAIN_RPC_URL,
    DATA_FETCHER_URL,
    DATA_FETCHER_REQUEST_TIMEOUT,
    RPC_CALLS_DEFAULT_RETRY_TIMEOUT,
    RPC_CALLS_QUICK_RETRY_TIMEOUT,
    RPC_CALLS_CONNECTION_TIMEOUT,
    RPC_CALLS_CONNECTION_QUICK_TIMEOUT,

    EXPLORER_API_URL,

    WAIT_FOR_PUFF_INTERVAL,
    PUFF_POINTS_TOKEN_ADDRESS,
    PUFF_POINTS_UNIT_POINTS,
    PUFF_POINTS_UNIT_INTERVAL,
    WAIT_FOR_PUFF_RETRY,
    ENABLE_PUFF,

    RENZO_WAIT_FOR_RETRY,
    RENZO_WAIT_FOR_INTERVAL,
    RENZO_TOKEN_ADDRESS,
    RENZO_UNIT_POINTS,
    RENZO_UNIT_INTERVAL,
    ENABLE_RENZO,

    L1_ERC20_BRIDGE_ETHEREUM,
    L1_ERC20_BRIDGE_ARBITRUM,
    L1_ERC20_BRIDGE_LINEA,
    L1_ERC20_BRIDGE_BLAST,
  } = process.env;

  return {
    port: parseInt(PORT, 10) || 3001,
    blockchain: {
      rpcUrl: BLOCKCHAIN_RPC_URL || 'http://localhost:3050',
      rpcCallDefaultRetryTimeout:
        parseInt(RPC_CALLS_DEFAULT_RETRY_TIMEOUT, 10) || 30000,
      rpcCallQuickRetryTimeout:
        parseInt(RPC_CALLS_QUICK_RETRY_TIMEOUT, 10) || 500,
      rpcCallConnectionTimeout:
        parseInt(RPC_CALLS_CONNECTION_TIMEOUT, 10) || 20000,
      rpcCallConnectionQuickTimeout:
        parseInt(RPC_CALLS_CONNECTION_QUICK_TIMEOUT, 10) || 10000,
    },
    dataFetcher: {
      url: DATA_FETCHER_URL || 'http://localhost:3040',
      requestTimeout: parseInt(DATA_FETCHER_REQUEST_TIMEOUT, 10) || 120_000,
    },
    puffPoints: {
      waitForInterval: parseInt(WAIT_FOR_PUFF_INTERVAL, 10) || 10_000,
      waitForRetry: parseInt(WAIT_FOR_PUFF_RETRY, 10) || 10_000,
      tokenAddress:
        PUFF_POINTS_TOKEN_ADDRESS ||
        '0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3Fc',
      unitPoints: BigInt(PUFF_POINTS_UNIT_POINTS || '0') || 30n,
      unitInterval: parseInt(PUFF_POINTS_UNIT_INTERVAL, 10) || 3600_000,
    },
    renzo: {
      waitForRetry: parseInt(RENZO_WAIT_FOR_RETRY, 10) || 10_000,
      waitForInterval: parseInt(RENZO_WAIT_FOR_INTERVAL, 10) || 10_000,
      tokenAddress: (
        RENZO_TOKEN_ADDRESS ||
        '0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402,0xdA7Fa837112511F6E353091D7e388A4c45Ce7D6C'
      ).split(','),
      unitPoints: BigInt(RENZO_UNIT_POINTS || '0') || 1n,
      unitInterval: parseInt(RENZO_UNIT_INTERVAL, 10) || 3600_000,
    },
    enablePuff: ENABLE_PUFF === 'true',
    enableRenzo: ENABLE_RENZO === 'true',
    explorerApiUrl: EXPLORER_API_URL || 'http://localhost:3020',

    l1Erc20BridgeEthereum: L1_ERC20_BRIDGE_ETHEREUM || '',
    l1Erc20BridgeArbitrum: L1_ERC20_BRIDGE_ARBITRUM || '',
    l1Erc20BridgeLinea: L1_ERC20_BRIDGE_LINEA || '',
    l1Erc20BridgeBlast: L1_ERC20_BRIDGE_BLAST || '',
  };
};
