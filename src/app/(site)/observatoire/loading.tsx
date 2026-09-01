import { PageContainer } from "@/components/observatoire/page-container";
import { Skeleton, SkeletonText } from "@/components/ui";

export default function ObservatoireLoading() {
  return (
    <PageContainer className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <SkeletonText lines={2} className="max-w-2xl" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="h-[58vh] min-h-[380px] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Chargement de l&apos;observatoire…
      </span>
    </PageContainer>
  );
}
