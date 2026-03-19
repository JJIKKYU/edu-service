export const dynamic = "force-dynamic";

import { MigrationBoard } from "@/components/migration/migration-board";
import {
  parseMigrationView,
} from "@/lib/migration-view";

interface MigrationPageProps {
  searchParams?: Promise<{ view?: string }>;
}

export default async function MigrationPage({
  searchParams,
}: MigrationPageProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = parseMigrationView(resolvedSearchParams?.view);
  return <MigrationBoard view={view} />;
}
