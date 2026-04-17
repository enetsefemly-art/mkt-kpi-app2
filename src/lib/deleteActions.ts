import { supabase } from "./supabaseClient";
import { logActivity } from "./activityLogger";

export async function deleteEntity(
  table: string,
  id: string,
  workspaceId: string,
  entityName: string = "entity"
) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  await logActivity({
    workspaceId,
    entityType: table,
    entityId: id,
    action: "delete",
    detail: { message: `Deleted ${entityName} with ID ${id}` }
  });
}
