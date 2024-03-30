import { BigNumber } from 'bignumber.js';
export interface GraphPoint {
  address: string;
  balance: string;
  weightBalance: string;
  timeWeightAmountIn: string;
  timeWeightAmountOut: string;
  project: string;
}
export interface GraphTotalPoint {
  id: string;
  project: string;
  totalBalance: string;
  totalWeightBalance: string;
  totalTimeWeightAmountIn: string;
  totalTimeWeightAmountOut: string;
}

async function main() {
  const address = process.argv[2];
  if (!address) {
    console.error('Address is required as a command line argument.');
    process.exit(1);
  }
  const [userPointData, totalPointsData] =
    await queryPointsRedistributedByAddress(address);
  const timestamp = (Date.now() / 1000) | 0;
  const userPoint = getPoints(userPointData, timestamp);
  const totalPoints = getTotalPoints(totalPointsData, timestamp);
  const totalRealPuffPoints = await getTotalPuffPoints();
  console.log('total puff zklink points ', totalRealPuffPoints.toString());

  console.log('-------------------');
  const finalPoint = BigNumber(userPoint.toString())
    .times(totalRealPuffPoints)
    .div(BigNumber(totalPoints.toString()));
  console.log("User's puff points ", finalPoint.toFixed(6));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function queryPointsRedistributedByAddress(
  address: string,
): Promise<[GraphPoint, GraphTotalPoint]> {
  const query = `
  {
    totalPoints(where:{project:"puffer-0x1b49ecf1a8323db4abf48b2f5efaa33f7ddab3fc"}){
      id
      project
      totalBalance
      totalWeightBalance
      totalTimeWeightAmountIn
      totalTimeWeightAmountOut
    }
    points(where: {project: "puffer-0x1b49ecf1a8323db4abf48b2f5efaa33f7ddab3fc", address: "${address}"}){
      address
      balance
      weightBalance
      timeWeightAmountIn
      timeWeightAmountOut
      project
    }
  }
    `;
  const data = await queryGraph(query);
  if (
    data &&
    data.data &&
    Array.isArray(data.data.points) &&
    data.data.points.length > 0 &&
    Array.isArray(data.data.totalPoints) &&
    data.data.totalPoints.length > 0
  ) {
    return [
      data.data.points[0] as GraphPoint,
      data.data.totalPoints[0] as GraphTotalPoint,
    ];
  }
  throw new Error('Failed to get points');
}
async function getTotalPuffPoints(): Promise<BigNumber> {
  const realData = await fetch(
    'https://quest-api.puffer.fi/puffer-quest/third/query_zklink_pufpoint',
    {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        'client-id': '08879426f59a4b038b7755b274bc19dc',
      },
    },
  );

  const pufReadData = await realData.json();
  if (
    pufReadData &&
    pufReadData.errno === 0 &&
    pufReadData.data &&
    pufReadData.data.pufeth_points_detail
  ) {
    return new BigNumber(
      pufReadData.data.pufeth_points_detail['latest_points'] as string,
    );
  }
  throw new Error('Failed to get puf points');
}

async function queryGraph(query: string) {
  const body = {
    query: query,
  };

  const response = await fetch(
    'https://graph.zklink.io/subgraphs/name/nova-point-redistribute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();
  return data;
}
function getPoints(points: GraphPoint, timestamp: number): bigint {
  return calcuPoint(
    points.weightBalance,
    points.timeWeightAmountIn,
    points.timeWeightAmountOut,
    timestamp,
  );
}
function getTotalPoints(
  totalPoints: GraphTotalPoint,
  timestamp: number,
): bigint {
  return calcuPoint(
    totalPoints.totalWeightBalance,
    totalPoints.totalTimeWeightAmountIn,
    totalPoints.totalTimeWeightAmountOut,
    timestamp,
  );
}
function calcuPoint(
  weightBalance: string,
  timeWeightAmountIn: string,
  timeWeightAmountOut: string,
  timestamp: number,
): bigint {
  return (
    BigInt(weightBalance) * BigInt(timestamp) -
    (BigInt(timeWeightAmountIn) - BigInt(timeWeightAmountOut))
  );
}
