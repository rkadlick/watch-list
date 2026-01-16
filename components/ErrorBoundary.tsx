"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorCode?: number;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Simple numeric error code — backend can map meaning
    const errorCode = Math.floor(1000 + Math.random() * 9000);

    return {
      hasError: true,
      error,
      errorCode,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sonner toast for visibility
    toast.error("An unexpected error occurred.", {
      description: `Error Code: ${this.state.errorCode}`,
    });

    // Placeholder for future logging service (Sentry, etc.)
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary caught an error:", error, info);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorCode: undefined,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">
          Something went wrong
        </h1>

        <p className="text-sm text-muted-foreground">
          An unexpected error occurred while loading the application.
        </p>

        {this.state.errorCode && (
          <p className="text-xs text-muted-foreground">
            Error Code: {this.state.errorCode}
          </p>
        )}

        <Button onClick={this.handleRetry}>
          Retry
        </Button>

        {process.env.NODE_ENV === "development" && this.state.error && (
          <pre className="mt-6 max-w-full overflow-auto rounded-md bg-muted p-4 text-left text-xs">
            {this.state.error.stack}
          </pre>
        )}
      </div>
    );
  }
}