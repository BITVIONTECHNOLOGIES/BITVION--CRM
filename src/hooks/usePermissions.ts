import { useAuth } from "@/context/AuthContext";
import { canDelete, canManageSettings, canManageTeam, canWrite } from "@/data/catalog";

export function usePermissions() {
  const { previewRole } = useAuth();
  return {
    role: previewRole,
    canWrite: canWrite(previewRole),
    canDelete: canDelete(previewRole),
    canManageTeam: canManageTeam(previewRole),
    canManageSettings: canManageSettings(previewRole),
  };
}
