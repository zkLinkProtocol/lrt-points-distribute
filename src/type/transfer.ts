export class Transfer {
    public type: string;
    public blockNumber: number;
    public from: string;
    public to: string;
    public transactionHash?: string;
    public amount?: string;
    public tokenAddress: string;
    public gateway?: string;
    public timestamp: Date;
  }