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
    explorerApiUrl: EXPLORER_API_URL || 'http://localhost:3020',
  };
};
