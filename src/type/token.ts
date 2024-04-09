export class TotalSupply {
    public type: string;
    public hex: string;
}
export class Token {
    public l2Address: string;
    public l1Address: string;
    public networkKey: string;
    public symbol: string;
    public name: string;
    public decimals: number;
    public usdPrice: number;
    public liquidity: bigint;
    public iconURL: string;
    public tvl: number;
    public totalSupply: TotalSupply
}