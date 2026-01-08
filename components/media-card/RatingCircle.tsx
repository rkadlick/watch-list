"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

export function RatingCircle({
  score,
  maxScore = 10,
  size = 40,
}: {
  score: number;
  maxScore?: number;
  size?: number;
}) {
  const percentage = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const strokeDasharray = circumference;
  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  let color = "text-green-600";
  let strokeColor = "stroke-green-600";
  if (score < 4) {
    color = "text-red-600";
    strokeColor = "stroke-red-600";
  } else if (score < 7) {
    color = "text-yellow-600";
    strokeColor = "stroke-yellow-600";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative inline-flex items-center justify-center cursor-default"
            style={{ width: size, height: size }}
          >
            <svg
              className="transform -rotate-90"
              width={size}
              height={size}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - 4}
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-muted"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - 4}
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={strokeColor}
                style={{ transition: "stroke-dashoffset 0.3s ease" }}
              />
            </svg>
            <span className={`absolute text-xs font-semibold ${color}`}>
              {score.toFixed(1)}
            </span>
          </div>
        </TooltipTrigger>

        <TooltipContent side="top" align="center">
          TMDB Rating
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}