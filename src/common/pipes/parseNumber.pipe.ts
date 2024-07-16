import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class ParseNumberPipe implements PipeTransform<string, number> {
  private defaultValue: number;
  public constructor(value: number) {
    this.defaultValue = value;
  }
  transform(value: string): number {
    if (!value) {
      return this.defaultValue;
    }
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException(
        `Validation failed. "${value}" is not a number.`,
      );
    }
    return val;
  }
}
