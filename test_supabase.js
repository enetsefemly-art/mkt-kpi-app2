const fs = require('fs');

function replaceFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  let original = content;

  // Pattern: const { data: varName, error: errName } = await supabase.from('...').select('...').eq('workspace_id', workspaceId);
  // We want to replace it with:
  // let query_varName = supabase.from('...').select('...');
  // if (shouldApplyUuidFilter(workspaceId)) query_varName = query_varName.eq('workspace_id', workspaceId);
  // const { data: varName, error: errName } = await query_varName;
  // This is too hard to write regex for.

  // Alternative idea:
  // We can just add `.match(shouldApplyUuidFilter(workspaceId) ? {workspace_id: workspaceId} : {})`
  // Supabase supports `.match({...options})`. If the options object is empty, it doesn't filter!
  // Wait, does `.match({})` effectively skip filtering?
  // Let's check `shouldApplyUuidFilter` return value.
  
  content = content.replace(/\.eq\('workspace_id',\s*workspaceId\)/g, 
    ".match(shouldApplyUuidFilter(workspaceId) ? {workspace_id: workspaceId} : {})");
    
  content = content.replace(/\.eq\('owner_id',\s*currentUserId\)/g, 
    ".match(shouldApplyUuidFilter(currentUserId) ? {owner_id: currentUserId} : {})");

  content = content.replace(/\.eq\('owner_id',\s*ownerFilter\)/g, 
    ".match(shouldApplyUuidFilter(ownerFilter) ? {owner_id: ownerFilter} : {})");
    
  content = content.replace(/\.eq\("workspace_id",\s*workspaceId\)/g, 
    ".match(shouldApplyUuidFilter(workspaceId) ? {workspace_id: workspaceId} : {})");
    
  content = content.replace(/\.eq\("workspace_id",\s*wsId\)/g, 
    ".match(shouldApplyUuidFilter(wsId) ? {workspace_id: wsId} : {})");

  if (content !== original) {
    if (!content.includes('shouldApplyUuidFilter')) {
       // Need to add import
       const importMatch = content.match(/import .* from ['"](.*supabaseClient)['"];?/);
       if (importMatch) {
          content = content.replace(importMatch[0], importMatch[0] + "\nimport { shouldApplyUuidFilter } from './uuid';");
       } else {
          content = "import { shouldApplyUuidFilter } from '../../../lib/uuid';\n" + content;
       }
    }
    fs.writeFileSync(path, content);
    console.log('Modified', path);
  }
}

// Just checking if .match({}) works in supabase. Actually, `.match({})` is equivalent to no filters in some JS API, but to be safe:
// A safer pattern is overriding the `.eq` when invalid:
// supabase has `.is('workspace_id', null)` maybe? No, that also filters.
// What about replacing `workspaceId` with `workspaceId || '00000000-0000-0000-0000-000000000000'` everywhere?
// No, the user explicitly said "Nếu value là 'default' / 'all' / '' / undefined thì bỏ filter." - drop the filter completely.
