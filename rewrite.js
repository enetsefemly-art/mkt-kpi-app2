const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walk(fullPath, callback);
      }
    } else {
      callback(fullPath);
    }
  }
}

walk('src', (fullPath) => {
  if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;

  content = content.replace(/\.eq\('workspace_id',\s*workspaceId\)/g, 
    ".match(shouldApplyUuidFilter(workspaceId) ? {workspace_id: workspaceId} : {})");
    
  content = content.replace(/\.eq\("workspace_id",\s*workspaceId\)/g, 
    ".match(shouldApplyUuidFilter(workspaceId) ? {workspace_id: workspaceId} : {})");
    
  content = content.replace(/\.eq\("workspace_id",\s*wsId\)/g, 
    ".match(shouldApplyUuidFilter(wsId) ? {workspace_id: wsId} : {})");

  content = content.replace(/\.eq\('workspace_id',\s*kpiWorkspaceId\)/g, 
    ".match(shouldApplyUuidFilter(kpiWorkspaceId) ? {workspace_id: kpiWorkspaceId} : {})");
    
  content = content.replace(/\.eq\('owner_id',\s*currentUserId\)/g, 
    ".match(shouldApplyUuidFilter(currentUserId) ? {owner_id: currentUserId} : {})");

  content = content.replace(/\.eq\('owner_id',\s*ownerFilter\)/g, 
    ".match(shouldApplyUuidFilter(ownerFilter) ? {owner_id: ownerFilter} : {})");
    
  content = content.replace(/\.eq\('kpi_id',\s*kpiId\)/g, 
    ".match(shouldApplyUuidFilter(kpiId) ? {kpi_id: kpiId} : {})");
    
  content = content.replace(/\.eq\('user_id',\s*user\.id\)/g, 
    ".match(shouldApplyUuidFilter(user.id) ? {user_id: user.id} : {})");

  content = content.replace(/\.eq\('user_id',\s*userId\)/g, 
    ".match(shouldApplyUuidFilter(userId) ? {user_id: userId} : {})");

  content = content.replace(/\.eq\('user_id',\s*kpi\.owner_id\)/g, 
    ".match(shouldApplyUuidFilter(kpi.owner_id) ? {user_id: kpi.owner_id} : {})");
    
  content = content.replace(/\.eq\('product_id',\s*productId\)/g, 
    ".match(shouldApplyUuidFilter(productId) ? {product_id: productId} : {})");
    
  content = content.replace(/\.eq\('initiative_id',\s*initiativeId\)/g, 
    ".match(shouldApplyUuidFilter(initiativeId) ? {initiative_id: initiativeId} : {})");

  if (content !== original) {
    if (!content.includes('shouldApplyUuidFilter')) {
       // Need to add import
       const importMatch = content.match(/import .* from '.*supabaseClient';/);
       if (importMatch) {
          content = content.replace(importMatch[0], importMatch[0] + "\nimport { shouldApplyUuidFilter } from './uuid';");
       } else {
          // just put it at the very top
          // Find path relative... actually we can just use absolute or relative. Let's just do it manually.
          if (fullPath.includes('src/lib/')) {
             content = "import { shouldApplyUuidFilter } from './uuid';\n" + content;
          } else if (fullPath.includes('src/app/app/')) {
             content = "import { shouldApplyUuidFilter } from '../../../../lib/uuid';\n" + content;
          } else if (fullPath.includes('src/app/')) {
             content = "import { shouldApplyUuidFilter } from '../../../lib/uuid';\n" + content;
          }
       }
    }
    fs.writeFileSync(fullPath, content);
    console.log('Modified', fullPath);
  }
});
