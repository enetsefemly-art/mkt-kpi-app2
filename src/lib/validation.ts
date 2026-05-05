export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateKpiForm(input: {
  owner_id: string;
  title: string;
  weight: number;
  month_key?: string;
  kpi_score_method?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.owner_id) errors.push("Owner is required.");
  if (!input.title || input.title.trim() === "") errors.push("Title is required.");
  if (input.weight <= 0 || input.weight > 100) errors.push("Weight must be greater than 0 and less than or equal to 100.");
  
  if (input.month_key) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month_key)) {
      errors.push("Month format must be YYYY-MM.");
    }
  }
  
  if (input.kpi_score_method) {
    if (!['aggregate_ratio', 'weighted_item_score'].includes(input.kpi_score_method)) {
      errors.push("Invalid KPI score method.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateKpiItemForm(
  input: {
    product_id: string;
    item_title: string;
    sub_weight: number;
    target?: number | null;
    manual_progress?: number | null;
    target_mode?: string;
  },
  kpiType: string
): ValidationResult {
  const errors: string[] = [];
  if (!input.product_id) errors.push("Product is required.");
  if (!input.item_title || input.item_title.trim() === "") errors.push("Item Title is required.");
  if (input.sub_weight <= 0 || input.sub_weight > 100) errors.push("Sub-weight must be greater than 0 and less than or equal to 100.");
  
  if (input.target_mode && !['fixed', 'cumulative'].includes(input.target_mode)) {
    errors.push("Target mode must be either 'fixed' or 'cumulative'.");
  }

  if (kpiType !== "strategic") {
    if (input.target !== undefined && input.target !== null && input.target < 0) {
      errors.push("Target must be greater than or equal to 0.");
    }
  } else {
    if (input.manual_progress !== undefined && input.manual_progress !== null) {
      if (input.manual_progress < 0 || input.manual_progress > 1) {
        errors.push("Manual progress must be between 0 and 1.");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateMonthKey(value: string): ValidationResult {
  const errors: string[] = [];
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!regex.test(value)) {
    errors.push("Month Key must be in YYYY-MM format.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateInitiativeForm(input: {
  title: string;
  owner_id: string;
  month_key: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.title || input.title.trim() === "") errors.push("Title is required.");
  if (!input.owner_id) errors.push("Owner is required.");
  
  const monthKeyValidation = validateMonthKey(input.month_key);
  if (!monthKeyValidation.valid) {
    errors.push(...monthKeyValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateTaskForm(input: {
  title: string;
  owner_id: string;
  due_date: string;
  status: string;
  blocker_reason?: string | null;
}): ValidationResult {
  const errors: string[] = [];
  if (!input.title || input.title.trim() === "") errors.push("Title is required.");
  if (!input.owner_id) errors.push("Owner is required.");
  if (!input.due_date) errors.push("Due Date is required.");
  
  if (input.status === "blocked") {
    if (!input.blocker_reason || input.blocker_reason.trim() === "") {
      errors.push("Blocker Reason is required when status is blocked.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateManualProgress(value: number): ValidationResult {
  const errors: string[] = [];
  if (value < 0 || value > 1) {
    errors.push("Manual progress must be between 0 and 1.");
  }
  return { valid: errors.length === 0, errors };
}
