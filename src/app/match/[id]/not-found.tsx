import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MatchNotFound() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Match not found</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">
          This match doesn&apos;t exist or hasn&apos;t been analyzed yet.
        </p>
        <Link href="/">
          <Button>Back to Today&apos;s Fixtures</Button>
        </Link>
      </div>
    </div>
  );
}
