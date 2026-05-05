export function cleanUuid(value?: string | null) {
  if (!value || value === 'default' || value === 'all') return null;
  return value;
}

export function shouldApplyUuidFilter(value?: string | null) {
  return Boolean(value && value !== 'default' && value !== 'all');
}
