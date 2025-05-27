import { ZodError } from "zod";

export function formatValidationError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });

  return issues.join(", ");
}

export function handleValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return `Validation error: ${formatValidationError(error)}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown validation error";
}
