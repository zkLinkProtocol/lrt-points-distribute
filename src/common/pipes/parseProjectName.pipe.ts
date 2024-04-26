import { BadRequestException } from "@nestjs/common";
import { PipeTransform, Injectable } from "@nestjs/common";

interface ParamOptions {
  required?: boolean;
  each?: boolean;
  errorMessage?: string;
}

@Injectable()
export class ParseProjectNamePipe implements PipeTransform<string | string[]> {
  public readonly options: ParamOptions;

  constructor({
    required = true,
    each = false,
    errorMessage = "projectName required",
  }: ParamOptions = {}) {
    this.options = {
      required,
      each,
      errorMessage,
    };
  }

  public transform(value: string | string[]): string | string[] {
    if (!this.options.required && !value) {
      return value;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(this.options.errorMessage);
    }

    return value;
  }
}
