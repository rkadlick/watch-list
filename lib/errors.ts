export type ErrorCategory =
  | "auth"
  | "network"
  | "validation"
  | "unknown";

export type AppError = {
  category: ErrorCategory;
  message: string;
  code?: string;
};

/**
 * Normalize unknown errors into a user-friendly shape.
 */
export function parseError(error: unknown): AppError {
  if (error instanceof Error) {
    return parseErrorMessage(error.message);
  }

  return {
    category: "unknown",
    message: "Something went wrong. Please try again.",
  };
}

export function parseErrorMessage(message: string): AppError {
	// Attempt to parse structured error
	try {
	  const parsed = JSON.parse(message);
  
	  if (
		typeof parsed === "object" &&
		parsed !== null &&
		typeof parsed.message === "string"
	  ) {
		return {
		  category: mapCategory(parsed.code),
		  message: parsed.message,
		  code:
			typeof parsed.code === "string"
			  ? parsed.code
			  : undefined,
		};
	  }
	} catch {
	  // Not JSON — continue
	}
  
	const lower = message.toLowerCase();
  
	if (
	  lower.includes("auth") ||
	  lower.includes("unauthorized") ||
	  lower.includes("not authenticated")
	) {
	  return {
		category: "auth",
		message: "Please sign in to continue.",
	  };
	}
  
	if (
	  lower.includes("network") ||
	  lower.includes("fetch")
	) {
	  return {
		category: "network",
		message:
		  "Network error. Please check your connection.",
	  };
	}
  
	if (
	  lower.includes("invalid") ||
	  lower.includes("validation")
	) {
	  return {
		category: "validation",
		message: message,
	  };
	}
  
	return {
	  category: "unknown",
	  message: "Something went wrong. Please try again.",
	};
  }


  function mapCategory(
	code?: string
  ): ErrorCategory {
	switch (code) {
	  case "NOT_AUTHENTICATED":
	  case "UNAUTHORIZED":
		return "auth";
	  case "VALIDATION_ERROR":
		return "validation";
	  default:
		return "unknown";
	}
  }