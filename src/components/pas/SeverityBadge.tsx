import type { Severity } from '../../lib/pas/types';

const STYLES: Record<Severity, string> = {
  Low: 'bg-gray-100 text-gray-700 border-gray-200',
  Medium: 'bg-blue-100 text-blue-800 border-blue-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
};

const LABELS: Record<Severity, string> = {
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
  Critical: 'Nghiêm trọng',
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const style = STYLES[severity] || STYLES.Medium;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {LABELS[severity] || severity}
    </span>
  );
}
