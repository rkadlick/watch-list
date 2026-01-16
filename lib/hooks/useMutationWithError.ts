"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { FunctionReference } from "convex/server";

type MutationOptions = {
  successMessage?: string;

  /**
   * Custom error handler.
   * Return true to suppress default handling.
   */
  onError?: (error: Error) => boolean | void;
};

export function useMutationWithError<
  TMutation extends FunctionReference<"mutation">
>(
  mutation: TMutation,
  options?: MutationOptions
) {
  const mutationFn = useMutation(mutation);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (...args: Parameters<typeof mutationFn>) => {
      setIsLoading(true);

      try {
        const result = await mutationFn(...args);

        if (options?.successMessage) {
          toast.success(options.successMessage);
        }

        return result;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Unknown error");

        if (options?.onError?.(error)) {
          throw error;
        }

        handleConvexMutationError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    isLoading,
  };
}

function handleConvexMutationError(error: Error) {
	const message = error.message.toLowerCase();
  
	// Auth / permission
	if (
	  message.includes("auth") ||
	  message.includes("unauthorized") ||
	  message.includes("not authenticated")
	) {
	  toast.error("Authentication required", {
		description: "Please sign in and try again.",
	  });
	  return;
	}
  
	// Validation / bad input
	if (
	  message.includes("invalid") ||
	  message.includes("validation")
	) {
	  toast.error("Invalid input", {
		description: error.message,
	  });
	  return;
	}
  
	// Network / connectivity
	if (message.includes("network")) {
	  toast.error("Network error", {
		description:
		  "Please check your connection and try again.",
	  });
	  return;
	}
  
	// Fallback
	const errorCode = Math.floor(1000 + Math.random() * 9000);
  
	toast.error("Something went wrong", {
	  description: `Error Code: ${errorCode}`,
	});
  
	if (process.env.NODE_ENV === "development") {
	  // eslint-disable-next-line no-console
	  console.error("Convex mutation error:", error);
	}
  }